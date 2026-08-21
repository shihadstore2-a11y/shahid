import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";

export type DbClient = SupabaseClient<Database>;

export async function assertAdmin(db: DbClient, userId: string): Promise<void> {
  const { data, error } = await db.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error) {
    console.error("Admin role verification failed", { userId, message: error.message });
    throw new Error("تعذر التحقق من الصلاحيات حالياً");
  }
  if (data !== true) throw new Error("هذه الصفحة للأدمن فقط");
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
