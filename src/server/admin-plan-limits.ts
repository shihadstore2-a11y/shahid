/**
 * Admin Plan Limits — تحديث `plan_limits` مع validation + audit log.
 * كلّ التعديلات تُسجَّل في `admin_audit_log` بقيم before/after.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAdminAudit, type DbClient } from "@/server/admin-auth";

export type PlanLimitRow = {
  plan: "free" | "starter" | "growth" | "pro" | "business";
  kind: "text" | "image";
  monthly_limit: number;
  updated_at: string;
};

type JsonVal = string | number | boolean | null | JsonVal[] | { [k: string]: JsonVal };

export type AuditLogRow = {
  id: string;
  admin_user_id: string;
  admin_email: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  before_value: JsonVal | null;
  after_value: JsonVal | null;
  created_at: string;
};

export const listPlanLimits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanLimitRow[]> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("plan_limits")
      .select("plan, kind, monthly_limit, updated_at")
      .order("plan")
      .order("kind");
    if (error) throw new Error(error.message);
    return (data ?? []) as PlanLimitRow[];
  });

const updateSchema = z.object({
  plan: z.enum(["free", "starter", "growth", "pro", "business"]),
  kind: z.enum(["text", "image"]),
  monthly_limit: z.number().int().min(0).max(1_000_000),
});

export const updatePlanLimit = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    // قراءة القيمة الحالية للـaudit
    const { data: before, error: selErr } = await supabase
      .from("plan_limits")
      .select("plan, kind, monthly_limit")
      .eq("plan", data.plan)
      .eq("kind", data.kind)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);

    const { error: upErr } = await supabase
      .from("plan_limits")
      .upsert(
        {
          plan: data.plan,
          kind: data.kind,
          monthly_limit: data.monthly_limit,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "plan,kind" }
      );
    if (upErr) throw new Error(`فشل التحديث: ${upErr.message}`);

    await logAdminAudit({
      adminId: userId,
      action: before ? "update_plan_limit" : "create_plan_limit",
      targetTable: "plan_limits",
      targetId: `${data.plan}:${data.kind}`,
      before: before ?? null,
      after: { ...data },
      metadata: {
        plan: data.plan,
        kind: data.kind,
        previous_limit: before?.monthly_limit ?? null,
        new_limit: data.monthly_limit,
      },
    });

    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditLogRow[]> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data, error } = await supabase
      .from("admin_audit_log")
      .select("id, admin_user_id, action, target_table, target_id, before_value, after_value, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const adminIds = Array.from(new Set((data ?? []).map((r) => r.admin_user_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", adminIds.length > 0 ? adminIds : ["00000000-0000-0000-0000-000000000000"]);
    const emailById = new Map((profs ?? []).map((p) => [p.id, p.email]));

    return (data ?? []).map((r) => ({
      ...r,
      admin_email: emailById.get(r.admin_user_id) ?? null,
    })) as AuditLogRow[];
  });
