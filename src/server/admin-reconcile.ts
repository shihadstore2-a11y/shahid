/**
 * Admin Reconcile — يستدعي RPC reconcile_usage_logs (SECURITY DEFINER)
 * لمزامنة عدّادات usage_logs مع generations الفعلية.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/server/admin-auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DbClient = SupabaseClient<Database>;

export type ReconcileRow = {
  user_id: string;
  month: string;
  old_text_count: number;
  new_text_count: number;
  old_image_count: number;
  new_image_count: number;
  text_diff: number;
  image_diff: number;
};

export type ReconcileResult = {
  month: string;
  users_corrected: number;
  total_text_diff: number;
  total_image_diff: number;
  rows: ReconcileRow[];
};

const inputSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export const reconcileUsageLogs = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input ?? {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<ReconcileResult> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    // RPC غير معرّف في types المُولّدة بعد، لذا نستخدم cast آمن
    const { data: rows, error } = await (supabase.rpc as unknown as (
      fn: string,
      args: { _month: string | null }
    ) => Promise<{ data: ReconcileRow[] | null; error: { message: string } | null }>)(
      "reconcile_usage_logs",
      { _month: data.month ?? null }
    );

    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const total_text_diff = list.reduce((s, r) => s + r.text_diff, 0);
    const total_image_diff = list.reduce((s, r) => s + r.image_diff, 0);
    // شهر الرياض كـ fallback (يطابق منطق الـRPC)
    const riyadhMonth = (() => {
      const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
    const month = list[0]?.month ?? data.month ?? riyadhMonth;

    return {
      month,
      users_corrected: list.length,
      total_text_diff,
      total_image_diff,
      rows: list,
    };
  });
