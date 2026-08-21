/**
 * /api/public/hooks/phase1-daily-report
 *
 * Cron يومي 05:00 UTC (= 08:00 Riyadh) — يجمع KPIs آخر 24 ساعة من المرحلة 1
 * ويرسل ملخصاً Telegram للأدمن. محمي بـ NOTIFY_WEBHOOK_SECRET.
 */
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function sendTelegram(chatId: string, html: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) {
    throw new Error("Telegram credentials not configured");
  }
  const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram failed [${res.status}]: ${JSON.stringify(data)}`);
  }
}

type Job = {
  id: string;
  status: string;
  refund_ledger_id: string | null;
  error_category: string | null;
  metadata: { provider_attempts?: Array<{ provider?: string; ok?: boolean }> } | null;
};

export const Route = createFileRoute("/api/public/hooks/phase1-daily-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const expected = process.env.NOTIFY_WEBHOOK_SECRET;
          if (!expected) {
            return new Response(JSON.stringify({ error: "server misconfigured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          const provided = request.headers.get("x-webhook-secret");
          if (!provided || !safeEqualStrings(provided, expected)) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

          // 1) Jobs window
          const { data: jobsData, error: jobsErr } = await supabaseAdmin
            .from("video_jobs")
            .select("id, status, refund_ledger_id, error_category, metadata, created_at")
            .gte("created_at", since24h);
          if (jobsErr) throw new Error(`jobs query failed: ${jobsErr.message}`);
          const jobs = (jobsData ?? []) as Job[];
          const total = jobs.length;
          const refunded = jobs.filter((j) => j.refund_ledger_id != null).length;
          const completed = jobs.filter((j) => j.status === "completed").length;
          const failed = jobs.filter((j) => j.status === "failed").length;
          const refundRate = total === 0 ? 0 : (refunded / total) * 100;

          // 2) Fallbacks
          let withFb = 0;
          let okFb = 0;
          for (const j of jobs) {
            const att = j.metadata?.provider_attempts ?? [];
            if (att.length > 1) {
              withFb += 1;
              if (j.status === "completed") okFb += 1;
            }
          }
          const fbRate = withFb === 0 ? 0 : (okFb / withFb) * 100;

          // 3) Top errors
          const errMap = new Map<string, number>();
          for (const j of jobs) {
            if (!j.error_category) continue;
            errMap.set(j.error_category, (errMap.get(j.error_category) ?? 0) + 1);
          }
          const topErrors = Array.from(errMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

          // 4) Bonus stats
          const { data: bonusRaw } = await supabaseAdmin.rpc("get_launch_bonus_stats");
          const bonus = (bonusRaw as Array<{ total_granted: number; remaining: number; cap: number }> | null)?.[0] ?? {
            total_granted: 0,
            remaining: 100,
            cap: 100,
          };

          // 5) Subscription requests today
          const { count: newReqs } = await supabaseAdmin
            .from("subscription_requests")
            .select("id", { count: "exact", head: true })
            .gte("created_at", since24h);
          const { count: activatedToday } = await supabaseAdmin
            .from("subscription_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "activated")
            .gte("activated_at", since24h);

          // 6) Wave B — Onboarding & Badges (24س)
          const { count: wizardStarted24h } = await supabaseAdmin
            .from("onboarding_events")
            .select("id", { count: "exact", head: true })
            .eq("event_type", "started")
            .gte("created_at", since24h);
          const { count: wizardCompleted24h } = await supabaseAdmin
            .from("onboarding_events")
            .select("id", { count: "exact", head: true })
            .eq("event_type", "wizard_completed")
            .gte("created_at", since24h);
          const wizardCompletionRate = !wizardStarted24h || wizardStarted24h === 0
            ? 0
            : ((wizardCompleted24h ?? 0) / wizardStarted24h) * 100;

          const { data: badgesRaw } = await supabaseAdmin
            .from("user_badges")
            .select("badge_type")
            .gte("awarded_at", since24h);
          const badges = (badgesRaw ?? []) as Array<{ badge_type: string }>;
          const bText = badges.filter((b) => b.badge_type === "first_text").length;
          const bImage = badges.filter((b) => b.badge_type === "first_image").length;
          const bVideo = badges.filter((b) => b.badge_type === "first_video").length;
          const bActive = badges.filter((b) => b.badge_type === "active_store").length;

          const healthyRefund = refundRate < 15;
          const healthyFb = withFb === 0 || fbRate >= 95;
          const healthyOnboarding = wizardCompletionRate >= 75 || (wizardStarted24h ?? 0) === 0;

          const lines = [
            `📊 <b>تقرير يومي — مراقبة المرحلة 1</b>`,
            `<i>${new Date().toLocaleString("ar-SA")}</i>`,
            "",
            `🎬 <b>الفيديو (24س)</b>`,
            `• إجمالي المهام: ${total}`,
            `• مكتمل: ${completed} · فشل: ${failed} · مرتجع: ${refunded}`,
            `• معدل الـRefund: <b>${refundRate.toFixed(1)}%</b> ${healthyRefund ? "✅" : "⚠️ تجاوز الحد!"}`,
            "",
            `🔁 <b>Fallback المزوّدين</b>`,
            `• مهام احتاجت بديلاً: ${withFb}`,
            `• نجاح بعد البديل: ${okFb} (${fbRate.toFixed(1)}%) ${healthyFb ? "✅" : "⚠️"}`,
            "",
            `💼 <b>الاشتراكات</b>`,
            `• طلبات جديدة: ${newReqs ?? 0}`,
            `• تفعيلات اليوم: ${activatedToday ?? 0}`,
            "",
            `🚀 <b>Onboarding & First-Win (24س)</b>`,
            `• بدأ الـWizard: ${wizardStarted24h ?? 0}`,
            `• أكمل الـWizard: ${wizardCompleted24h ?? 0} (${wizardCompletionRate.toFixed(1)}%) ${healthyOnboarding ? "✅" : "⚠️"}`,
            `• شارات أُمنحت: نص ${bText} · صورة ${bImage} · فيديو ${bVideo}`,
            `• 🏆 متجر نشط: ${bActive}`,
            "",
            `🏅 <b>مكافأة الإطلاق</b>`,
            `• مُنحت لـ ${bonus.total_granted}/${bonus.cap} عضو مؤسس`,
            `• المتبقي: ${bonus.remaining} مقعد`,
          ];

          if (topErrors.length > 0) {
            lines.push("", `⚠️ <b>أعلى الأخطاء</b>`);
            for (const [cat, n] of topErrors) {
              lines.push(`• ${cat}: ${n}`);
            }
          }

          lines.push(
            "",
            `🔗 <a href="https://rifd.lovable.app/admin/phase1-monitor">فتح لوحة المراقبة</a>`
          );

          const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
          if (!adminChatId) {
            return new Response(JSON.stringify({ error: "TELEGRAM_ADMIN_CHAT_ID missing" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          await sendTelegram(adminChatId, lines.join("\n"));

          return new Response(
            JSON.stringify({
              ok: true,
              sent: true,
              metrics: {
                total_jobs: total,
                refund_rate_pct: Math.round(refundRate * 10) / 10,
                fallback_success_pct: Math.round(fbRate * 10) / 10,
                bonus_granted: bonus.total_granted,
                new_requests: newReqs ?? 0,
                activated_today: activatedToday ?? 0,
                wizard_started_24h: wizardStarted24h ?? 0,
                wizard_completed_24h: wizardCompleted24h ?? 0,
                wizard_completion_pct: Math.round(wizardCompletionRate * 10) / 10,
                badges_24h: { first_text: bText, first_image: bImage, first_video: bVideo, active_store: bActive },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
