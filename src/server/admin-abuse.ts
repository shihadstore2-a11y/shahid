import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin, type DbClient } from "@/server/admin-auth";
import type { Database } from "@/integrations/supabase/types";
import { PLAN_BY_ID, type PlanId } from "@/lib/plan-catalog";

type Severity = "critical" | "high" | "medium" | "low";
type SignalCategory = "credits" | "video" | "quota" | "campaigns";

type ProfileLite = { id: string; email: string | null; store_name: string | null; plan: string | null };

type CreditRow = Pick<Database["public"]["Tables"]["credit_ledger"]["Row"], "id" | "user_id" | "amount" | "txn_type" | "created_at" | "metadata">;
type VideoRow = Pick<Database["public"]["Tables"]["video_jobs"]["Row"], "id" | "user_id" | "status" | "credits_charged" | "error_message" | "created_at" | "updated_at">;
type DailyUsageRow = Database["public"]["Tables"]["daily_text_usage"]["Row"];
type CampaignPackRow = Pick<Database["public"]["Tables"]["campaign_packs"]["Row"], "id" | "user_id" | "created_at" | "updated_at">;

export type AbuseSignal = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_store: string | null;
  plan: string | null;
  severity: Severity;
  category: SignalCategory;
  title: string;
  details: string;
  metric: string;
  action_hint: string;
  last_seen_at: string;
};

export type AbuseMonitorStats = {
  totalSignals: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  usersFlagged: number;
  creditsConsumed: number;
  videosCreated: number;
  refunds: number;
};

const inputSchema = z.object({
  windowHours: z.union([z.literal(24), z.literal(72), z.literal(168)]).default(24),
  severity: z.enum(["all", "critical", "high", "medium", "low"]).default("all"),
  limit: z.number().int().min(10).max(200).default(100),
});

function severityRank(severity: Severity) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[severity];
}

function addUserMetric<T extends { user_id: string }>(map: Map<string, T[]>, row: T) {
  const rows = map.get(row.user_id) ?? [];
  rows.push(row);
  map.set(row.user_id, rows);
}

function profileFor(map: Map<string, ProfileLite>, userId: string) {
  return map.get(userId) ?? { id: userId, email: null, store_name: null, plan: null };
}

function planFor(profile: ProfileLite) {
  return PLAN_BY_ID[(profile.plan as PlanId) || "free"] ?? PLAN_BY_ID.free;
}

function expectedVideoVolumeWindow(plan: ReturnType<typeof planFor>, windowHours: number) {
  const baselineByPlan: Record<PlanId, number> = {
    free: 2,
    starter: 10,
    growth: 24,
    pro: 48,
    business: 96,
  };
  return Math.max(baselineByPlan[plan.id], Math.ceil(windowHours / 24) * baselineByPlan[plan.id]);
}

function signal(base: Omit<AbuseSignal, "user_email" | "user_store" | "plan">, profiles: Map<string, ProfileLite>): AbuseSignal {
  const profile = profileFor(profiles, base.user_id);
  return {
    ...base,
    user_email: profile.email,
    user_store: profile.store_name,
    plan: profile.plan,
  };
}

export const getAbuseMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ stats: AbuseMonitorStats; signals: AbuseSignal[]; generatedAt: string }> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const since = new Date(Date.now() - data.windowHours * 60 * 60 * 1000).toISOString();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });

    const [ledgerResult, videoResult, usageResult, campaignResult] = await Promise.all([
      supabaseAdmin
        .from("credit_ledger")
        .select("id, user_id, amount, txn_type, created_at, metadata")
        .gte("created_at", since)
        .in("txn_type", ["consume_video", "refund", "admin_adjust"])
        .order("created_at", { ascending: false })
        .limit(1000),
      supabaseAdmin
        .from("video_jobs")
        .select("id, user_id, status, credits_charged, error_message, created_at, updated_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabaseAdmin
        .from("daily_text_usage")
        .select("user_id, day, text_count, image_count, updated_at")
        .eq("day", today)
        .limit(1000),
      supabaseAdmin
        .from("campaign_packs")
        .select("id, user_id, created_at, updated_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    if (ledgerResult.error) throw new Error(`فشل قراءة دفتر النقاط: ${ledgerResult.error.message}`);
    if (videoResult.error) throw new Error(`فشل قراءة مهام الفيديو: ${videoResult.error.message}`);
    if (usageResult.error) throw new Error(`فشل قراءة الاستخدام اليومي: ${usageResult.error.message}`);
    if (campaignResult.error) throw new Error(`فشل قراءة حزم الحملات: ${campaignResult.error.message}`);

    const ledgerRows = (ledgerResult.data ?? []) as CreditRow[];
    const videoRows = (videoResult.data ?? []) as VideoRow[];
    const usageRows = (usageResult.data ?? []) as DailyUsageRow[];
    const campaignRows = (campaignResult.data ?? []) as CampaignPackRow[];

    const userIds = Array.from(new Set([
      ...ledgerRows.map((r) => r.user_id),
      ...videoRows.map((r) => r.user_id),
      ...usageRows.map((r) => r.user_id),
      ...campaignRows.map((r) => r.user_id),
    ]));

    const { data: profiles, error: profilesError } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, email, store_name, plan").in("id", userIds)
      : { data: [] as ProfileLite[], error: null };
    if (profilesError) throw new Error(`فشل قراءة ملفات المستخدمين: ${profilesError.message}`);
    const profileMap = new Map(((profiles ?? []) as ProfileLite[]).map((profile) => [profile.id, profile]));

    const ledgerByUser = new Map<string, CreditRow[]>();
    const videosByUser = new Map<string, VideoRow[]>();
    const campaignsByUser = new Map<string, CampaignPackRow[]>();
    ledgerRows.forEach((row) => addUserMetric(ledgerByUser, row));
    videoRows.forEach((row) => addUserMetric(videosByUser, row));
    campaignRows.forEach((row) => addUserMetric(campaignsByUser, row));

    const signals: AbuseSignal[] = [];

    for (const [uid, rows] of ledgerByUser) {
      const profile = profileFor(profileMap, uid);
      const plan = planFor(profile);
      const consumed = rows.filter((row) => row.txn_type === "consume_video").reduce((sum, row) => sum + Math.abs(row.amount), 0);
      const refunds = rows.filter((row) => row.txn_type === "refund").length;
      const adminAdjustAbs = rows.filter((row) => row.txn_type === "admin_adjust").reduce((sum, row) => sum + Math.abs(row.amount), 0);
      const last = rows[0]?.created_at ?? since;
      const highCreditThreshold = Math.max(300, Math.round(plan.monthlyCredits * 0.18));
      const criticalCreditThreshold = Math.max(900, Math.round(plan.monthlyCredits * 0.35));

      if (consumed >= criticalCreditThreshold) {
        signals.push(signal({ id: `credits-spike-${uid}`, user_id: uid, severity: "critical", category: "credits", title: "استهلاك نقاط فيديو مرتفع جداً", details: `استهلك المستخدم ${consumed} نقطة فيديو خلال ${data.windowHours} ساعة، بما يتجاوز نمط باقة ${plan.name}.`, metric: `${consumed} نقطة`, action_hint: "راجع الفيديوهات الناتجة، مصدر الشحن، واحتمال مشاركة الحساب.", last_seen_at: last }, profileMap));
      } else if (consumed >= highCreditThreshold) {
        signals.push(signal({ id: `credits-high-${uid}`, user_id: uid, severity: "high", category: "credits", title: "استهلاك نقاط فيديو مرتفع", details: `استهلاك يتجاوز عتبة المراقبة التشغيلية لباقته خلال نافذة قصيرة.`, metric: `${consumed} نقطة`, action_hint: "راقب الحساب قبل أي ضبط يدوي أو زيادة حدود.", last_seen_at: last }, profileMap));
      }

      if (refunds >= 3) {
        signals.push(signal({ id: `refund-loop-${uid}`, user_id: uid, severity: refunds >= 5 ? "high" : "medium", category: "credits", title: "تكرار استرداد نقاط", details: `تم رصد ${refunds} عمليات استرداد خلال النافذة المحددة.`, metric: `${refunds} استرداد`, action_hint: "افحص أخطاء المزود، جودة المدخلات، واحتمال تكرار محاولات فاشلة.", last_seen_at: last }, profileMap));
      }

      if (adminAdjustAbs >= 200) {
        signals.push(signal({ id: `admin-adjust-${uid}`, user_id: uid, severity: "medium", category: "credits", title: "ضبط يدوي كبير للنقاط", details: "وجود تعديلات يدوية كبيرة يستدعي مراجعة السبب وسجل التدقيق.", metric: `${adminAdjustAbs} نقطة`, action_hint: "طابق السبب في سجل التدقيق مع طلب العميل أو قرار الإدارة.", last_seen_at: last }, profileMap));
      }
    }

    for (const [uid, rows] of videosByUser) {
      const profile = profileFor(profileMap, uid);
      const plan = planFor(profile);
      const processing = rows.filter((row) => row.status === "processing").length;
      const failedOrRefunded = rows.filter((row) => row.status === "failed" || row.status === "refunded").length;
      const created = rows.length;
      const last = rows[0]?.updated_at ?? rows[0]?.created_at ?? since;
      const expectedVolumeWindow = expectedVideoVolumeWindow(plan, data.windowHours);

      if (processing >= 2) {
        signals.push(signal({ id: `video-concurrency-${uid}`, user_id: uid, severity: "high", category: "video", title: "وصول حد مهام الفيديو المتزامنة", details: "الحساب يلامس حد المعالجة المتزامنة وقد يسبب ضغط تكلفة أو انتظار طويل.", metric: `${processing} قيد المعالجة`, action_hint: "انتظر اكتمال المهام وافحص مدة المعالجة قبل رفع الحدود.", last_seen_at: last }, profileMap));
      }
      if (created > expectedVolumeWindow) {
        signals.push(signal({ id: `video-volume-${uid}`, user_id: uid, severity: created >= expectedVolumeWindow * 2 ? "high" : "medium", category: "video", title: "حجم مهام فيديو أعلى من نمط الباقة", details: `تم إنشاء ${created} مهام فيديو خلال النافذة المحددة مقابل نمط تشغيلي متوقع ${expectedVolumeWindow} لباقته.`, metric: `${created} فيديو`, action_hint: "راجع ملاءمة الباقة وتحقق من عدم وجود أتمتة غير مقصودة.", last_seen_at: last }, profileMap));
      }
      if (failedOrRefunded >= 3) {
        signals.push(signal({ id: `video-failures-${uid}`, user_id: uid, severity: "medium", category: "video", title: "فشل/استرداد فيديو متكرر", details: "نسبة الفشل قد تعني Prompt غير مناسب أو مشكلة مزود أو استخدام تجريبي مكثف.", metric: `${failedOrRefunded} حالة`, action_hint: "افتح إدارة الفيديو وراجع error_message وآخر prompt قبل أي إجراء.", last_seen_at: last }, profileMap));
      }
    }

    for (const row of usageRows) {
      const profile = profileFor(profileMap, row.user_id);
      const plan = planFor(profile);
      const textRatio = plan.dailyTextCap > 0 ? row.text_count / plan.dailyTextCap : 0;
      const imageRatio = plan.dailyImageCap > 0 ? row.image_count / plan.dailyImageCap : 0;
      if (textRatio >= 0.85 || imageRatio >= 0.85) {
        const severity: Severity = textRatio >= 1 || imageRatio >= 1 ? "high" : "medium";
        signals.push(signal({ id: `daily-quota-${row.user_id}`, user_id: row.user_id, severity, category: "quota", title: "اقتراب أو تجاوز استخدام يومي كثيف", details: `الاستخدام اليومي يقترب من حدود باقة ${plan.name} أو يتجاوز النمط الطبيعي.`, metric: `${row.text_count}/${plan.dailyTextCap} نص · ${row.image_count}/${plan.dailyImageCap} صورة`, action_hint: "راجع الخطة الحالية ونمط الجلسة قبل اعتبارها إساءة.", last_seen_at: row.updated_at }, profileMap));
      }
    }

    for (const [uid, rows] of campaignsByUser) {
      if (rows.length >= 20) {
        signals.push(signal({ id: `campaign-burst-${uid}`, user_id: uid, severity: rows.length >= 40 ? "medium" : "low", category: "campaigns", title: "إنشاء Campaign Packs بكثافة", details: "إنشاء عدد كبير من الحزم خلال نافذة قصيرة قد يشير لاختبار آلي أو استخدام غير طبيعي.", metric: `${rows.length} حزمة`, action_hint: "راجع جودة الحزم، ولا تتدخل إن كان الاستخدام ضمن عميل نشط مشروع.", last_seen_at: rows[0]?.created_at ?? since }, profileMap));
      }
    }

    const filteredSignals = signals
      .filter((item) => data.severity === "all" || item.severity === data.severity)
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at))
      .slice(0, data.limit);

    const stats: AbuseMonitorStats = {
      totalSignals: signals.length,
      critical: signals.filter((item) => item.severity === "critical").length,
      high: signals.filter((item) => item.severity === "high").length,
      medium: signals.filter((item) => item.severity === "medium").length,
      low: signals.filter((item) => item.severity === "low").length,
      usersFlagged: new Set(signals.map((item) => item.user_id)).size,
      creditsConsumed: ledgerRows.filter((row) => row.txn_type === "consume_video").reduce((sum, row) => sum + Math.abs(row.amount), 0),
      videosCreated: videoRows.length,
      refunds: ledgerRows.filter((row) => row.txn_type === "refund").length,
    };

    return { stats, signals: filteredSignals, generatedAt: new Date().toISOString() };
  });
