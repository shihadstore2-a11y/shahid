import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";

export type DbClient = SupabaseClient<Database>;

export async function assertAdmin(_db: DbClient, userId: string): Promise<void> {
  // استخدم service_role client لتجاوز RLS عند التحقق من الصلاحية
  const { data: roleRow, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    console.error("Admin role verification failed", { userId, message: error.message });
    throw new Error("تعذر التحقق من الصلاحيات حالياً");
  }
  if (!roleRow) throw new Error("هذه الصفحة للأدمن فقط");
}

export async function logAdminAudit(params: {
  adminId: string;
  action: string;
  targetTable: string;
  targetId: string | null;
  before?: Json | null;
  after?: Json | null;
  metadata?: Json | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    admin_user_id: params.adminId,
    action: params.action,
    target_table: params.targetTable,
    target_id: params.targetId,
    before_value: params.before ?? null,
    after_value: params.after ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("Admin audit log insert failed", {
      action: params.action,
      targetTable: params.targetTable,
      targetId: params.targetId,
      message: error.message,
    });
  }
}
