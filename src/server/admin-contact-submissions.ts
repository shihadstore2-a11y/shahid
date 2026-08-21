/**
 * إدارة رسائل التواصل (Admin only) — server functions
 *
 * يعتمد على `requireSupabaseAuth` + `assertAdmin` للحماية الصارمة.
 * يستخدم `supabaseAdmin` (service-role) للتجاوز الآمن لـRLS بعد التحقق من الدور،
 * لأن RLS الحالي يسمح للأدمن لكنه يحتاج لـauth.uid() متصل بطريقة معينة عبر JWT.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin, logAdminAudit, type DbClient } from "@/server/admin-auth";
import { z } from "zod";

// ───────────────── Types ─────────────────
export type ContactStatus = "new" | "contacted" | "closed";

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: ContactStatus;
  created_at: string;
  updated_at: string;
  ip_hash: string | null;
  user_agent: string | null;
};

export type ContactSubmissionsList = {
  rows: ContactSubmission[];
  total: number;
  counts: { new: number; contacted: number; closed: number };
};

// ───────────────── List ─────────────────
const ListInput = z.object({
  status: z.enum(["new", "contacted", "closed", "all"]).optional().default("all"),
  q: z.string().trim().max(120).optional().default(""),
  limit: z.number().int().min(1).max(200).optional().default(100),
});

export const getContactSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<ContactSubmissionsList> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    // Counts (deduplicated, simple)
    const countsRes = await supabaseAdmin
      .from("contact_submissions")
      .select("status", { count: "exact", head: false });
    const allRows = (countsRes.data ?? []) as Array<{ status: string }>;
    const counts = {
      new: allRows.filter((r) => r.status === "new").length,
      contacted: allRows.filter((r) => r.status === "contacted").length,
      closed: allRows.filter((r) => r.status === "closed").length,
    };

    let q = supabaseAdmin
      .from("contact_submissions")
      .select(
        "id, name, email, phone, subject, message, status, created_at, updated_at, ip_hash, user_agent",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.q && data.q.length > 0) {
      const safe = data.q.replace(/[%_]/g, "\\$&");
      q = q.or(
        `name.ilike.%${safe}%,email.ilike.%${safe}%,subject.ilike.%${safe}%`,
      );
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(`فشل قراءة الرسائل: ${error.message}`);

    return {
      rows: (rows ?? []) as ContactSubmission[],
      total: allRows.length,
      counts,
    };
  });

// ───────────────── Update status ─────────────────
const UpdateInput = z.object({
  id: z.string().uuid("معرّف غير صالح"),
  status: z.enum(["new", "contacted", "closed"]),
});

export const updateContactStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data: before, error: beforeError } = await supabaseAdmin
      .from("contact_submissions")
      .select("id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (beforeError) throw new Error(`فشل قراءة الحالة الحالية: ${beforeError.message}`);
    if (!before) throw new Error("الرسالة غير موجودة");

    const { error } = await supabaseAdmin
      .from("contact_submissions")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(`فشل التحديث: ${error.message}`);

    await logAdminAudit({
      adminId: userId,
      action: "update_contact_status",
      targetTable: "contact_submissions",
      targetId: data.id,
      before: { status: before.status },
      after: { status: data.status },
      metadata: { changed: before.status !== data.status },
    });

    return { ok: true as const };
  });

// ───────────────── New count (for sidebar badge) ─────────────────
export const getNewContactCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ count: number }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);
    const { count } = await supabaseAdmin
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    return { count: count ?? 0 };
  });
