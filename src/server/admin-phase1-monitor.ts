/**
 * Admin Phase 1 Monitor — server function يجمع KPIs المرحلة الأولى:
 *  - معدل الـrefund اليومي (هدف <15%)
 *  - عدد fallbacks ناجحة بين المزودين
 *  - حالة kill-switch الحالية لكل مزود
 *  - نسبة Free → Paid conversion
 *  - أعلى 5 error_categories
 *  - Launch Bonus stats (المستفيدون / المتبقي من 100)
 *
 * محمي بـrequireSupabaseAuth + assertAdmin. يستخدم authenticated client
 * (RLS-scoped) — كل الجداول المُستعلَم عنها تسمح للأدمن بالقراءة الكاملة.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, type DbClient } from "@/server/admin-auth";

export type Phase1Monitor = {
  generated_at: string;
  window_hours: 24;
  refund: {
    total_jobs: number;
    refunded_jobs: number;
    refund_rate_pct: number;
    target_pct: 15;
    is_healthy: boolean;
  };
  providers: Array<{
    provider: string;
    enabled: boolean;
    priority: number;
    success_24h: number;
    fail_24h: number;
    fail_rate_pct: number;
    last_failure_at: string | null;
    kill_switch_active: boolean;
  }>;
  fallbacks: {
    jobs_with_fallback: number;
    successful_fallback: number;
    fallback_success_rate_pct: number;
  };
  conversion: {
    free_users: number;
    paid_users: number;
    conversion_rate_pct: number;
  };
  top_errors: Array<{ category: string; count: number; pct: number }>;
  launch_bonus: {
    total_granted: number;
    remaining: number;
    cap: number;
  };
  wave_b: {
    funnel: Array<{ step: number; users_started: number; users_completed: number; completion_rate_pct: number }>;
    badges_24h: { first_text: number; first_image: number; first_video: number; active_store: number };
    onboarding_completed_7d: number;
    onboarding_started_7d: number;
    completion_rate_pct: number;
  };
  wave_c1: {
    total_views: number;
    annual_toggles: number;
    plan_clicks: number;
    cta_clicks: number;
    conversions: number;
    cta_click_rate_pct: number;
    annual_share_pct: number;
    top_plan: string;
  };
  wave_c2: {
    window_days: number;
    per_day: Array<{
      day: number;
      sent: number;
      skipped: number;
      opened: number;
      clicked: number;
      open_rate: number;
      click_rate: number;
    }>;
    totals: { sent: number; opened: number; clicked: number };
    overall_open_rate_pct: number;
    overall_click_rate_pct: number;
  };
  wave_c3: {
    referrals_total: number;
    referrals_qualified: number;
    active_codes: number;
    k_factor: number;
    annual_upgrade_shown: number;
    annual_upgrade_clicked: number;
    annual_upgrade_upgraded: number;
    annual_click_rate_pct: number;
  };
};

type AttemptEntry = { provider?: string; ok?: boolean; status?: string };

export const getPhase1Monitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Phase1Monitor> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const adb = supabase as unknown as {
      from: (t: string) => any;
      rpc: (name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };

    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    // 1) Refund metrics (24h)
    const { data: jobsRaw } = await adb
      .from("video_jobs")
      .select("id, status, refund_ledger_id, error_category, metadata, created_at")
      .gte("created_at", since24h);

    const jobs = (jobsRaw ?? []) as Array<{
      id: string;
      status: string;
      refund_ledger_id: string | null;
      error_category: string | null;
      metadata: Record<string, unknown> | null;
    }>;
    const totalJobs = jobs.length;
    const refundedJobs = jobs.filter((j) => j.refund_ledger_id != null).length;
    const refundRate = totalJobs === 0 ? 0 : (refundedJobs / totalJobs) * 100;

    // 2) Provider configs + fail_24h
    const { data: providersRaw } = await adb
      .from("video_provider_configs")
      .select("provider_key, enabled, priority")
      .order("priority", { ascending: false });

    const providers: Phase1Monitor["providers"] = [];
    const providerKeys = ((providersRaw ?? []) as Array<{ provider_key: string; enabled: boolean; priority: number }>);

    for (const p of providerKeys) {
      // count success/fail from job metadata.provider_attempts
      let success = 0;
      let fail = 0;
      let lastFailureAt: string | null = null;
      for (const job of jobs) {
        const attempts = (job.metadata?.provider_attempts as AttemptEntry[] | undefined) ?? [];
        for (const a of attempts) {
          if (a.provider !== p.provider_key) continue;
          if (a.ok) success += 1;
          else fail += 1;
        }
      }
      const total = success + fail;
      const failRate = total === 0 ? 0 : (fail / total) * 100;

      // kill switch event still open?
      const { data: ks } = await adb
        .from("provider_kill_switch_events")
        .select("triggered_at, restored_at")
        .eq("provider_key", p.provider_key)
        .order("triggered_at", { ascending: false })
        .limit(1);
      const ksRow = (ks as Array<{ triggered_at: string; restored_at: string | null }> | null)?.[0];
      const killActive = Boolean(ksRow && ksRow.restored_at == null);

      providers.push({
        provider: p.provider_key,
        enabled: p.enabled,
        priority: p.priority,
        success_24h: success,
        fail_24h: fail,
        fail_rate_pct: Math.round(failRate * 10) / 10,
        last_failure_at: lastFailureAt,
        kill_switch_active: killActive,
      });
    }

    // 3) Fallbacks: jobs where provider_attempts has >1 entries and final ok
    let jobsWithFallback = 0;
    let successfulFallback = 0;
    for (const job of jobs) {
      const attempts = (job.metadata?.provider_attempts as AttemptEntry[] | undefined) ?? [];
      if (attempts.length > 1) {
        jobsWithFallback += 1;
        if (job.status === "completed") successfulFallback += 1;
      }
    }
    const fallbackRate = jobsWithFallback === 0 ? 0 : (successfulFallback / jobsWithFallback) * 100;

    // 4) Conversion (lifetime — proxy)
    const { count: freeCount } = await adb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("plan", "free");
    const { count: paidCount } = await adb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .neq("plan", "free");
    const totalUsers = (freeCount ?? 0) + (paidCount ?? 0);
    const convRate = totalUsers === 0 ? 0 : ((paidCount ?? 0) / totalUsers) * 100;

    // 5) Top error categories (24h)
    const errorCounts = new Map<string, number>();
    for (const j of jobs) {
      if (!j.error_category) continue;
      errorCounts.set(j.error_category, (errorCounts.get(j.error_category) ?? 0) + 1);
    }
    const totalErrors = Array.from(errorCounts.values()).reduce((a, b) => a + b, 0);
    const topErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({
        category,
        count,
        pct: totalErrors === 0 ? 0 : Math.round((count / totalErrors) * 1000) / 10,
      }));

    // 6) Launch bonus stats
    const { data: bonusData } = await adb.rpc("get_launch_bonus_stats");
    const bonusRow = (bonusData as Array<{ total_granted: number; remaining: number; cap: number }> | null)?.[0] ?? {
      total_granted: 0,
      remaining: 100,
      cap: 100,
    };

    // 7) Wave B — onboarding funnel + badges
    type FunnelRow = {
      total_started: number | string;
      step1_completed: number | string;
      step2_completed: number | string;
      step3_completed: number | string;
      wizard_completed: number | string;
      autogen_succeeded: number | string;
      autogen_failed: number | string;
      active_store_badges: number | string;
    };
    const { data: funnelRaw } = await adb.rpc("get_onboarding_funnel", { _days: 7 });
    const funnelRow = ((funnelRaw as FunnelRow[] | null) ?? [])[0];
    const totalStarted = Number(funnelRow?.total_started ?? 0);
    const step1 = Number(funnelRow?.step1_completed ?? 0);
    const step2 = Number(funnelRow?.step2_completed ?? 0);
    const step3 = Number(funnelRow?.step3_completed ?? 0);
    const wizardCompleted = Number(funnelRow?.wizard_completed ?? 0);
    // (autogen_succeeded / autogen_failed متاحة في funnelRow لاستخدام مستقبلي)
    const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);
    const funnel = [
      { step: 1, users_started: totalStarted, users_completed: step1, completion_rate_pct: pct(step1, totalStarted) },
      { step: 2, users_started: step1, users_completed: step2, completion_rate_pct: pct(step2, step1) },
      { step: 3, users_started: step2, users_completed: step3, completion_rate_pct: pct(step3, step2) },
    ];

    const { data: badgesRaw } = await adb
      .from("user_badges")
      .select("badge_type")
      .gte("awarded_at", since24h);
    const badgesArr = (badgesRaw ?? []) as Array<{ badge_type: string }>;
    const badges24h = {
      first_text: badgesArr.filter((b) => b.badge_type === "first_text").length,
      first_image: badgesArr.filter((b) => b.badge_type === "first_image").length,
      first_video: badgesArr.filter((b) => b.badge_type === "first_video").length,
      active_store: badgesArr.filter((b) => b.badge_type === "active_store").length,
    };

    const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count: started7d } = await adb
      .from("onboarding_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "started")
      .gte("created_at", since7d);
    const completed7d = wizardCompleted;
    const completionRate = pct(completed7d, started7d ?? 0);

    // Wave C1 — Pricing Funnel (آخر 7 أيام)
    type PricingFunnelRow = {
      total_views: number | string | null;
      annual_toggles: number | string | null;
      plan_clicks: number | string | null;
      cta_clicks: number | string | null;
      conversions: number | string | null;
      cta_click_rate_pct: number | string | null;
      annual_share_pct: number | string | null;
      top_plan: string | null;
    };
    const { data: pricingRaw } = await adb.rpc("get_pricing_funnel", { _days: 7 });
    const pricingRow = ((pricingRaw as PricingFunnelRow[] | null) ?? [])[0];

    return {
      generated_at: new Date().toISOString(),
      window_hours: 24,
      refund: {
        total_jobs: totalJobs,
        refunded_jobs: refundedJobs,
        refund_rate_pct: Math.round(refundRate * 10) / 10,
        target_pct: 15,
        is_healthy: refundRate < 15,
      },
      providers,
      fallbacks: {
        jobs_with_fallback: jobsWithFallback,
        successful_fallback: successfulFallback,
        fallback_success_rate_pct: Math.round(fallbackRate * 10) / 10,
      },
      conversion: {
        free_users: freeCount ?? 0,
        paid_users: paidCount ?? 0,
        conversion_rate_pct: Math.round(convRate * 10) / 10,
      },
      top_errors: topErrors,
      launch_bonus: bonusRow,
      wave_b: {
        funnel,
        badges_24h: badges24h,
        onboarding_completed_7d: completed7d ?? 0,
        onboarding_started_7d: started7d ?? 0,
        completion_rate_pct: completionRate,
      },
      wave_c1: {
        total_views: Number(pricingRow?.total_views ?? 0),
        annual_toggles: Number(pricingRow?.annual_toggles ?? 0),
        plan_clicks: Number(pricingRow?.plan_clicks ?? 0),
        cta_clicks: Number(pricingRow?.cta_clicks ?? 0),
        conversions: Number(pricingRow?.conversions ?? 0),
        cta_click_rate_pct: Number(pricingRow?.cta_click_rate_pct ?? 0),
        annual_share_pct: Number(pricingRow?.annual_share_pct ?? 0),
        top_plan: pricingRow?.top_plan ?? "—",
      },
      wave_c2: await (async () => {
        const { data: actRaw } = await adb.rpc("get_email_activation_funnel", { _days: 30 });
        const root = (actRaw ?? {}) as {
          window_days?: number;
          per_day?: Array<{
            day: number; sent: number; skipped: number; opened: number; clicked: number;
            open_rate: number | string; click_rate: number | string;
          }>;
          totals?: { sent: number; opened: number; clicked: number };
        };
        const totals = root.totals ?? { sent: 0, opened: 0, clicked: 0 };
        const sent = Number(totals.sent ?? 0);
        const opened = Number(totals.opened ?? 0);
        const clicked = Number(totals.clicked ?? 0);
        return {
          window_days: Number(root.window_days ?? 30),
          per_day: (root.per_day ?? []).map((r) => ({
            day: Number(r.day),
            sent: Number(r.sent),
            skipped: Number(r.skipped),
            opened: Number(r.opened),
            clicked: Number(r.clicked),
            open_rate: Number(r.open_rate),
            click_rate: Number(r.click_rate),
          })),
          totals: { sent, opened, clicked },
          overall_open_rate_pct: sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0,
          overall_click_rate_pct: sent > 0 ? Math.round((clicked / sent) * 1000) / 10 : 0,
        };
      })(),
      wave_c3: await (async () => {
        const { data: refRaw } = await adb.rpc("get_referral_stats", { _days: 30 });
        const r = (refRaw ?? {}) as Record<string, unknown>;
        const ann = (r.annual_upgrade ?? {}) as Record<string, unknown>;
        return {
          referrals_total: Number(r.referrals_total ?? 0),
          referrals_qualified: Number(r.referrals_qualified ?? 0),
          active_codes: Number(r.active_codes ?? 0),
          k_factor: Number(r.k_factor ?? 0),
          annual_upgrade_shown: Number(ann.shown ?? 0),
          annual_upgrade_clicked: Number(ann.clicked ?? 0),
          annual_upgrade_upgraded: Number(ann.upgraded ?? 0),
          annual_click_rate_pct: Number(ann.click_rate_pct ?? 0),
        };
      })(),
    };
  });
