/**
 * Admin Analytics — server function يعيد KPIs + breakdowns للأدمن.
 * محمي بـrequireSupabaseAuth + فحص دور admin يدوياً (RLS على user_roles + has_role).
 *
 * يستخدم الـauthenticated client (RLS-scoped). الـadmin يستطيع قراءة كل
 * subscription_requests + كل profiles عبر سياسات admin الموجودة. أمّا
 * generations/usage_logs فالـRLS لا تسمح للأدمن بقراءة بيانات الآخرين، لذا
 * نستخدم RPC SECURITY DEFINER عند الحاجة لاحقاً. هنا نكتفي بما يستطيع
 * المستخدم العادي قراءته + يحسب الأرقام التجميعية على مستوى الخادم.
 *
 * ملاحظة: لقراءة أرقام شاملة عبر كل المستخدمين بحاجة admin RLS بsubعد. سنطلب
 * من الأدمن سياسة قراءة admin على generations + usage_logs (موصى).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, type DbClient } from "@/server/admin-auth";
import { currentRiyadhMonth } from "@/lib/usage-month";

export type AdminAnalytics = {
  month: string;
  totals: {
    users: number;
    onboarded_users: number;
    active_subscribers: number;
    generations_this_month: number;
    cost_usd_this_month: number;
    avg_cost_per_active_user: number;
  };
  data_quality: {
    users_with_whatsapp: number;
    whatsapp_pct: number;
    users_with_full_profile: number;
    full_profile_pct: number;
  };
  top_users: Array<{
    user_id: string;
    email: string | null;
    store_name: string | null;
    plan: string;
    generations: number;
    total_tokens: number;
    cost_usd: number;
  }>;
  daily_generations: Array<{ day: string; text: number; image: number }>;
  by_model: Array<{ model: string; count: number; cost_usd: number }>;
  funnel: {
    signed_up: number;
    onboarded: number;
    first_generation: number;
    paid: number;
  };
};

export const getAdminAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAnalytics> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const month = currentRiyadhMonth();
    const [year, mon] = month.split("-").map((n) => parseInt(n, 10));
    const startUtc = new Date(Date.UTC(year, mon - 1, 1, -3, 0, 0));
    const endUtc = new Date(Date.UTC(year, mon, 1, -3, 0, 0));

    // نستخدم الـauthenticated client — يعمل بفضل سياسات admin RLS على
    // profiles/subscription_requests/generations/usage_logs.
    const adb = supabase;

    const [
      profilesAll,
      activeSubs,
      monthGens,
      thirtyDayGens,
      firstGenUsers,
    ] = await Promise.all([
      adb.from("profiles").select("id, email, store_name, plan, onboarded, created_at, whatsapp, product_type, audience, tone"),
      adb
        .from("subscription_requests")
        .select("user_id")
        .eq("status", "activated")
        .gte("activated_until", new Date().toISOString()),
      adb
        .from("generations")
        .select("user_id, type, total_tokens, estimated_cost_usd, model_used, created_at")
        .gte("created_at", startUtc.toISOString())
        .lt("created_at", endUtc.toISOString()),
      adb
        .from("generations")
        .select("type, created_at")
        .gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
      adb.from("generations").select("user_id"),
    ]);

    if (profilesAll.error) throw new Error(profilesAll.error.message);
    if (activeSubs.error) throw new Error(activeSubs.error.message);
    if (monthGens.error) throw new Error(monthGens.error.message);
    if (thirtyDayGens.error) throw new Error(thirtyDayGens.error.message);
    if (firstGenUsers.error) throw new Error(firstGenUsers.error.message);

    const profiles = profilesAll.data ?? [];
    const profilesById = new Map(profiles.map((p) => [p.id, p]));
    const activeSubSet = new Set((activeSubs.data ?? []).map((r) => r.user_id));

    // KPIs
    let totalCost = 0;
    const userAgg = new Map<
      string,
      { generations: number; tokens: number; cost: number }
    >();
    const modelAgg = new Map<string, { count: number; cost: number }>();

    for (const g of monthGens.data ?? []) {
      const c = Number(g.estimated_cost_usd ?? 0);
      totalCost += c;
      const u = userAgg.get(g.user_id) ?? { generations: 0, tokens: 0, cost: 0 };
      u.generations += 1;
      u.tokens += g.total_tokens ?? 0;
      u.cost += c;
      userAgg.set(g.user_id, u);

      const m = g.model_used ?? "unknown";
      const ma = modelAgg.get(m) ?? { count: 0, cost: 0 };
      ma.count += 1;
      ma.cost += c;
      modelAgg.set(m, ma);
    }

    const top_users = Array.from(userAgg.entries())
      .map(([user_id, agg]) => {
        const p = profilesById.get(user_id);
        return {
          user_id,
          email: p?.email ?? null,
          store_name: p?.store_name ?? null,
          plan: p?.plan ?? "free",
          generations: agg.generations,
          total_tokens: agg.tokens,
          cost_usd: Math.round(agg.cost * 1_000_000) / 1_000_000,
        };
      })
      .sort((a, b) => b.cost_usd - a.cost_usd)
      .slice(0, 10);

    // Daily generations (آخر 30 يوم)
    const dailyMap = new Map<string, { text: number; image: number }>();
    for (const g of thirtyDayGens.data ?? []) {
      const day = g.created_at.slice(0, 10);
      const cur = dailyMap.get(day) ?? { text: 0, image: 0 };
      if (g.type === "text") cur.text += 1;
      else cur.image += 1;
      dailyMap.set(day, cur);
    }
    const daily_generations = Array.from(dailyMap.entries())
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day));

    const by_model = Array.from(modelAgg.entries())
      .map(([model, v]) => ({
        model,
        count: v.count,
        cost_usd: Math.round(v.cost * 1_000_000) / 1_000_000,
      }))
      .sort((a, b) => b.cost_usd - a.cost_usd);

    const usersWithFirstGen = new Set(
      (firstGenUsers.data ?? []).map((r) => r.user_id)
    );
    const onboardedCount = profiles.filter((p) => p.onboarded).length;

    const totals = {
      users: profiles.length,
      onboarded_users: onboardedCount,
      active_subscribers: activeSubSet.size,
      generations_this_month: monthGens.data?.length ?? 0,
      cost_usd_this_month: Math.round(totalCost * 1_000_000) / 1_000_000,
      avg_cost_per_active_user:
        userAgg.size > 0
          ? Math.round((totalCost / userAgg.size) * 1_000_000) / 1_000_000
          : 0,
    };

    const funnel = {
      signed_up: profiles.length,
      onboarded: onboardedCount,
      first_generation: usersWithFirstGen.size,
      paid: activeSubSet.size,
    };

    const usersWithWhatsapp = profiles.filter((p) => !!p.whatsapp && p.whatsapp.trim().length > 0).length;
    const usersWithFullProfile = profiles.filter(
      (p) => !!p.store_name && !!p.whatsapp && !!p.product_type && !!p.audience && !!p.tone
    ).length;
    const data_quality = {
      users_with_whatsapp: usersWithWhatsapp,
      whatsapp_pct: profiles.length > 0 ? Math.round((usersWithWhatsapp / profiles.length) * 1000) / 10 : 0,
      users_with_full_profile: usersWithFullProfile,
      full_profile_pct: profiles.length > 0 ? Math.round((usersWithFullProfile / profiles.length) * 1000) / 10 : 0,
    };

    return {
      month,
      totals,
      data_quality,
      top_users,
      daily_generations,
      by_model,
      funnel,
    };
  });
