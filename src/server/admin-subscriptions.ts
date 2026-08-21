import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin, logAdminAudit, type DbClient } from "@/server/admin-auth";
import type { Database, Json } from "@/integrations/supabase/types";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_request_status"];

export type AdminSubscriptionRequest = {
  id: string;
  user_id: string;
  plan: "starter" | "growth" | "pro" | "business";
  billing_cycle: string;
  store_name: string | null;
  whatsapp: string;
  email: string;
  payment_method: string | null;
  notes: string | null;
  admin_notes: string | null;
  status: SubscriptionStatus;
  receipt_path: string | null;
  receipt_uploaded_at: string | null;
  activated_at: string | null;
  activated_until: string | null;
  created_at: string;
};

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "contacted", "activated", "rejected", "expired"]),
  adminNotes: z.string().max(500).optional(),
});

export const listAdminSubscriptionRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ requests: AdminSubscriptionRequest[] }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data, error } = await supabaseAdmin
      .from("subscription_requests")
      .select("id, user_id, plan, billing_cycle, store_name, whatsapp, email, payment_method, notes, admin_notes, status, receipt_path, receipt_uploaded_at, activated_at, activated_until, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`فشل تحميل طلبات الاشتراك: ${error.message}`);
    return { requests: (data ?? []) as AdminSubscriptionRequest[] };
  });

export const updateAdminSubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true; activated_until: string | null }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data: current, error: currentError } = await supabaseAdmin
      .from("subscription_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (currentError) throw new Error(`فشل قراءة الطلب الحالي: ${currentError.message}`);
    if (!current) throw new Error("طلب الاشتراك غير موجود");

    const updates: Partial<typeof current> = { status: data.status };
    if (data.adminNotes !== undefined) updates.admin_notes = data.adminNotes;

    if (data.status === "activated") {
      if (!current.receipt_path) throw new Error("لا يمكن تفعيل الاشتراك قبل رفع إيصال الدفع");
      const now = new Date();
      const until = new Date(now);
      if (current.billing_cycle === "yearly") until.setFullYear(until.getFullYear() + 1);
      else until.setMonth(until.getMonth() + 1);
      updates.activated_at = now.toISOString();
      updates.activated_until = until.toISOString();
    }

    const before = {
      status: current.status,
      admin_notes: current.admin_notes,
      activated_at: current.activated_at,
      activated_until: current.activated_until,
    };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("subscription_requests")
      .update(updates)
      .eq("id", data.id)
      .select("status, admin_notes, activated_at, activated_until")
      .single();
    if (updateError) throw new Error(`فشل تحديث الطلب: ${updateError.message}`);

    await logAdminAudit({
      adminId: userId,
      action: data.status === "activated" ? "activate_subscription" : data.status === "rejected" ? "reject_subscription" : data.status === "contacted" ? "contact_subscription" : "update_subscription_status",
      targetTable: "subscription_requests",
      targetId: data.id,
      before: before as Json,
      after: updated as Json,
      metadata: { email: current.email, plan: current.plan, billing_cycle: current.billing_cycle } as Json,
    });

    return { ok: true, activated_until: updated?.activated_until ?? null };
  });