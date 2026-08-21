/**
 * /api/public/hooks/check-stale-subscriptions
 *
 * Cron يومي 09:00 UTC — يفحص طلبات الاشتراك المعلّقة منذ >24 ساعة
 * ويرسل تنبيه Telegram للأدمن إن وُجدت. يحترم cooldown 24 ساعة.
 */
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 ساعة
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function sendTelegramAlert(chatId: string, html: string) {
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

type StaleRow = {
  id: string;
  plan: string;
  billing_cycle: string;
  status: string;
  email: string;
  whatsapp: string;
  store_name: string | null;
  hours_old: number;
  created_at: string;
};

export const Route = createFileRoute("/api/public/hooks/check-stale-subscriptions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const expectedSecret = process.env.NOTIFY_WEBHOOK_SECRET;
          if (!expectedSecret) {
            return new Response(JSON.stringify({ error: "server misconfigured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          const provided = request.headers.get("x-webhook-secret");
          if (!provided || !safeEqualStrings(provided, expectedSecret)) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 1. جلب الطلبات المعلّقة
          const { data: stale, error: staleErr } = await supabaseAdmin.rpc(
            "get_stale_subscription_requests" as never
          );
          if (staleErr) {
            return new Response(
              JSON.stringify({ error: "fetch failed", detail: staleErr.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
          const rows = (stale as StaleRow[] | null) ?? [];
          if (rows.length === 0) {
            return new Response(
              JSON.stringify({ ok: true, alerted: false, reason: "no stale requests" }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          // 2. cooldown check
          const stateAny = supabaseAdmin as unknown as {
            from: (t: string) => {
              select: (cols: string) => {
                eq: (col: string, val: number) => {
                  maybeSingle: () => Promise<{ data: { last_alert_at?: string } | null }>;
                };
              };
              update: (v: Record<string, unknown>) => {
                eq: (col: string, val: number) => Promise<{ error: unknown }>;
              };
            };
          };
          const { data: state } = await stateAny
            .from("stale_subs_alert_state")
            .select("last_alert_at")
            .eq("id", 1)
            .maybeSingle();

          const now = Date.now();
          if (state?.last_alert_at) {
            const elapsed = now - new Date(state.last_alert_at).getTime();
            if (elapsed < ALERT_COOLDOWN_MS) {
              return new Response(
                JSON.stringify({
                  ok: true,
                  alerted: false,
                  reason: "rate limited",
                  cooldown_remaining_ms: ALERT_COOLDOWN_MS - elapsed,
                  pending_count: rows.length,
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            }
          }

          // 3. بناء الرسالة
          const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
          if (!adminChatId) {
            return new Response(
              JSON.stringify({ error: "TELEGRAM_ADMIN_CHAT_ID missing" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          const oldest = rows[0];
          const lines = [
            `⏰ <b>تنبيه: ${rows.length} طلب اشتراك معلّق &gt;24 ساعة</b>`,
            "",
            `<b>الأقدم:</b> ${oldest.plan} (${oldest.billing_cycle}) منذ ${oldest.hours_old} ساعة`,
            `📧 ${oldest.email}`,
            `📱 ${oldest.whatsapp}`,
            "",
            `<b>الإجمالي حسب الخطة:</b>`,
          ];
          const byPlan = rows.reduce<Record<string, number>>((acc, r) => {
            acc[r.plan] = (acc[r.plan] ?? 0) + 1;
            return acc;
          }, {});
          for (const [plan, n] of Object.entries(byPlan)) {
            lines.push(`• ${plan}: ${n}`);
          }
          lines.push("", `🔗 <a href="https://rifd.lovable.app/admin/subscriptions">فتح لوحة الطلبات</a>`);

          await sendTelegramAlert(adminChatId, lines.join("\n"));

          // 4. تحديث state
          await stateAny
            .from("stale_subs_alert_state")
            .update({
              last_alert_at: new Date().toISOString(),
              last_alert_count: rows.length,
              updated_at: new Date().toISOString(),
            })
            .eq("id", 1);

          return new Response(
            JSON.stringify({ ok: true, alerted: true, count: rows.length }),
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
