/**
 * Admin Audit Log — قراءة سجل تعديلات الأدمن مع فلترة (action/target_table/تاريخ).
 * محمي بـrequireSupabaseAuth + فحص دور admin.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, type DbClient } from "@/server/admin-auth";

type JsonVal = string | number | boolean | null | JsonVal[] | { [k: string]: JsonVal };

export type AuditEntry = {
  id: string;
  admin_user_id: string;
  admin_email: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  before_value: JsonVal | null;
  after_value: JsonVal | null;
  metadata: JsonVal | null;
  created_at: string;
};

export type AuditFacets = {
  actions: string[];
  tables: string[];
};

const filterSchema = z.object({
  action: z.string().min(1).max(64).optional(),
  target_table: z.string().min(1).max(64).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const listAdminAudit = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => filterSchema.parse(input ?? {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ entries: AuditEntry[]; facets: AuditFacets }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    let q = supabase
      .from("admin_audit_log")
      .select(
        "id, admin_user_id, action, target_table, target_id, before_value, after_value, metadata, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);

    if (data.action) q = q.eq("action", data.action);
    if (data.target_table) q = q.eq("target_table", data.target_table);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // اجلب facets منفصلة (كل القيم بدون فلتر) لإظهار خيارات في الـUI
    const { data: facetRows, error: facetErr } = await supabase
      .from("admin_audit_log")
      .select("action, target_table")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (facetErr) throw new Error(facetErr.message);

    const actions = Array.from(new Set((facetRows ?? []).map((r) => r.action))).sort();
    const tables = Array.from(new Set((facetRows ?? []).map((r) => r.target_table))).sort();

    // معرّفات الأدمن لجلب البريد
    const adminIds = Array.from(new Set((rows ?? []).map((r) => r.admin_user_id)));
    const { data: profs } = adminIds.length
      ? await supabase.from("profiles").select("id, email").in("id", adminIds)
      : { data: [] as { id: string; email: string | null }[] };
    const emailById = new Map((profs ?? []).map((p) => [p.id, p.email]));

    const entries: AuditEntry[] = (rows ?? []).map((r) => ({
      id: r.id,
      admin_user_id: r.admin_user_id,
      admin_email: emailById.get(r.admin_user_id) ?? null,
      action: r.action,
      target_table: r.target_table,
      target_id: r.target_id,
      before_value: r.before_value as JsonVal | null,
      after_value: r.after_value as JsonVal | null,
      metadata: r.metadata as JsonVal | null,
      created_at: r.created_at,
    }));

    return { entries, facets: { actions, tables } };
  });
