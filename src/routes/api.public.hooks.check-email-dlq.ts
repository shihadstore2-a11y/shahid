/**
 * /api/public/hooks/check-email-dlq
 *
 * Cron-triggered (every 10 min) endpoint that:
 * 1. Verifies the shared webhook secret (HMAC-style timing-safe compare).
 * 2. Calls `check_email_dlq_health()` via service role.
 * 3. If `total_dlq > THRESHOLD` AND last alert was > 1 hour ago,
 *    sends a Telegram message to the admin and updates `dlq_alert_state`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DLQ_ALERT_THRESHOLD = 5;
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
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

export const Route = createFileRoute("/api/public/hooks/check-email-dlq")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const expectedSecret = process.env.NOTIFY_WEBHOOK_SECRET;
          if (!expectedSecret) {
            console.error("check-email-dlq: NOTIFY_WEBHOOK_SECRET missing");
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

          // 1. Fetch DLQ health
          const { data: health, error: healthErr } = await supabaseAdmin.rpc(
            "check_email_dlq_health" as never
          );
          if (healthErr) {
            console.error("check-email-dlq health error:", healthErr);
            return new Response(
              JSON.stringify({ error: "health check failed", detail: healthErr.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          const h = (health as Record<string, unknown>) ?? {};
          const totalDlq = Number(h.total_dlq ?? 0);
          const authDlq = Number(h.auth_dlq ?? 0);
          const transDlq = Number(h.transactional_dlq ?? 0);
          const authPending = Number(h.auth_pending ?? 0);
          const transPending = Number(h.transactional_pending ?? 0);

          if (totalDlq <= DLQ_ALERT_THRESHOLD) {
            return new Response(
              JSON.stringify({
                ok: true,
                alerted: false,
                reason: "below threshold",
                health: h,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          // 2. Rate-limit check
          const stateAny = supabaseAdmin as unknown as {
            from: (t: string) => {
              select: (cols: string) => {
                eq: (col: string, val: number) => {
                  maybeSingle: () => Promise<{ data: { last_alert_at?: string } | null }>;
                };
              };
            };
          };
          const { data: state } = await stateAny
            .from("dlq_alert_state")
            .select("last_alert_at, last_alert_count")
            .eq("id", 1)
            .maybeSingle();

          const lastAlertAt = state?.last_alert_at;
          const now = Date.now();
          if (lastAlertAt) {
            const elapsed = now - new Date(lastAlertAt).getTime();
            if (elapsed < ALERT_COOLDOWN_MS) {
              return new Response(
                JSON.stringify({
                  ok: true,
                  alerted: false,
                  reason: "rate limited",
                  cooldown_remaining_ms: ALERT_COOLDOWN_MS - elapsed,
                  health: h,
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            }
          }

          // 3. Send Telegram alert
          const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
          if (!adminChatId) {
            return new Response(
              JSON.stringify({ error: "TELEGRAM_ADMIN_CHAT_ID missing" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          const html = [
            "🚨 <b>تنبيه: تراكم في طابور البريد الفاشل</b>",
            "",
            `<b>إجمالي DLQ:</b> ${totalDlq}`,
            `• Auth DLQ: ${authDlq}`,
            `• Transactional DLQ: ${transDlq}`,
            "",
            `<b>قيد المعالجة:</b>`,
            `• Auth pending: ${authPending}`,
            `• Transactional pending: ${transPending}`,
            "",
            `🔗 <a href="https://refd.lovable.app/admin/email-monitor">فتح لوحة مراقبة البريد</a>`,
          ].join("\n");

          await sendTelegramAlert(adminChatId, html);

          // 4. Update alert state (table not yet in generated types — cast)
          const adminAny = supabaseAdmin as unknown as {
            from: (t: string) => {
              update: (v: Record<string, unknown>) => {
                eq: (col: string, val: number) => Promise<{ error: unknown }>;
              };
            };
          };
          await adminAny
            .from("dlq_alert_state")
            .update({
              last_alert_at: new Date().toISOString(),
              last_alert_count: totalDlq,
              updated_at: new Date().toISOString(),
            })
            .eq("id", 1);

          return new Response(
            JSON.stringify({ ok: true, alerted: true, total_dlq: totalDlq, health: h }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (err) {
          console.error("check-email-dlq fatal:", err);
          return new Response(
            JSON.stringify({
              error: err instanceof Error ? err.message : "unknown error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
