/**
 * إحصائيات اختبار A/B — تُقرأ من جانب الخادم بعد التحقق من دور admin.
 * يحلّ محل الاستعلام المباشر السابق من جانب العميل (defense-in-depth).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, type DbClient } from "@/server/admin-auth";

export type AbStats = {
  views: number;
  cta_clicks: number;
  demo_tries: number;
  brief_starts: number;
  unique_sessions: number;
  cta_rate: number;
  brief_start_rate: number;
  demo_rate: number;
};

export type AbTestResults = {
  experiment: string;
  total_rows: number;
  A: AbStats;
  B: AbStats;
};

const EMPTY: AbStats = {
  views: 0,
  cta_clicks: 0,
  demo_tries: 0,
  brief_starts: 0,
  unique_sessions: 0,
  cta_rate: 0,
  brief_start_rate: 0,
  demo_rate: 0,
};

function calcStats(
  rows: Array<{ variant: string; event_type: string; session_id: string }>,
): AbStats {
  const sessions = new Set(rows.map((r) => r.session_id));
  const views = rows.filter((r) => r.event_type === "view").length;
  const cta_clicks = rows.filter((r) => r.event_type === "cta_click").length;
  const demo_tries = rows.filter((r) => r.event_type === "demo_try").length;
  const brief_starts = rows.filter((r) => r.event_type === "submit").length;
  return {
    views,
    cta_clicks,
    demo_tries,
    brief_starts,
    unique_sessions: sessions.size,
    cta_rate: views > 0 ? (cta_clicks / views) * 100 : 0,
    brief_start_rate: views > 0 ? (brief_starts / views) * 100 : 0,
    demo_rate: views > 0 ? (demo_tries / views) * 100 : 0,
  };
}

export const getAbTestResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { experiment?: string }) => ({
    experiment:
      typeof input?.experiment === "string" && input.experiment.length <= 64
        ? input.experiment
        : "hero_hook",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const { data: rows, error } = await supabase
      .from("ab_test_events")
      .select("variant, event_type, session_id")
      .eq("experiment", data.experiment)
      .limit(10000);

    if (error) throw new Error(`فشل قراءة نتائج التجربة: ${error.message}`);

    const list = (rows ?? []) as Array<{
      variant: string;
      event_type: string;
      session_id: string;
    }>;
    const aRows = list.filter((r) => r.variant === "A");
    const bRows = list.filter((r) => r.variant === "B");

    const result: AbTestResults = {
      experiment: data.experiment,
      total_rows: list.length,
      A: aRows.length ? calcStats(aRows) : EMPTY,
      B: bRows.length ? calcStats(bRows) : EMPTY,
    };
    return result;
  });
