import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const PLAN_LABELS: Record<string, string> = {
  free: "مجاني",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  business: "Business",
};

const CYCLE_LABELS: Record<string, string> = {
  monthly: "شهري",
  yearly: "سنوي",
};

const PAYMENT_LABELS: Record<string, string> = {
  bank_transfer_sa: "تحويل بنكي",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار ⏳",
  contacted: "تم التواصل",
  activated: "مفعّل ✅",
  rejected: "مرفوض",
  expired: "منتهي",
};

function escapeHtml(text: string | null | undefined): string {
  if (text === null || text === undefined || text === "") return "—";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendTelegramMessage(chatId: string, html: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;

  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY is not configured");

  const response = await fetch(`${GATEWAY_URL}/sendMessage`, {
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

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(
      `Telegram sendMessage failed [${response.status}]: ${JSON.stringify(data)}`
    );
  }
  return data;
}

type NotifyBody = {
  test?: boolean;
  chat_id?: string;
  admin_chat_id?: string;
  request_id?: string;
  request?: {
    plan?: string;
    billing_cycle?: string;
    store_name?: string | null;
    email?: string;
    whatsapp?: string;
    payment_method?: string | null;
    status?: string;
    notes?: string | null;
  };
};

export const Route = createFileRoute("/api/notify-telegram-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const expectedSecret = process.env.NOTIFY_WEBHOOK_SECRET;
          if (!expectedSecret) {
            console.error("NOTIFY_WEBHOOK_SECRET not configured");
            return new Response(
              JSON.stringify({ error: "server misconfigured" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          const providedSecret = request.headers.get("x-webhook-secret");
          if (!providedSecret || !safeEqualStrings(providedSecret, expectedSecret)) {
            console.warn("notify-telegram-admin: invalid secret");
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          let body: NotifyBody = {};
          try {
            body = await request.json();
          } catch {
            return new Response(
              JSON.stringify({ error: "invalid json body" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // وضع الاختبار
          if (body.test === true) {
            const chatId = body.chat_id ?? body.admin_chat_id ?? process.env.TELEGRAM_ADMIN_CHAT_ID;
            if (!chatId) {
              return new Response(
                JSON.stringify({ error: "chat_id required for test" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }
            await sendTelegramMessage(
              chatId,
              "✅ <b>اختبار قناة الإشعارات</b>\n\nالاتصال يعمل بشكل صحيح."
            );
            return new Response(JSON.stringify({ ok: true, test: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // وضع الإشعار الفعلي — البيانات تأتي من الـwebhook في الـbody
          const adminChatId = body.admin_chat_id ?? process.env.TELEGRAM_ADMIN_CHAT_ID;
          if (!adminChatId) {
            return new Response(
              JSON.stringify({ error: "admin_chat_id missing" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const req = body.request ?? {};
          const planLabel = req.plan ? (PLAN_LABELS[req.plan] ?? req.plan) : "—";
          const cycleLabel = req.billing_cycle
            ? (CYCLE_LABELS[req.billing_cycle] ?? req.billing_cycle)
            : "—";
          const paymentLabel = req.payment_method
            ? (PAYMENT_LABELS[req.payment_method] ?? req.payment_method)
            : "—";
          const statusLabel = req.status
            ? (STATUS_LABELS[req.status] ?? req.status)
            : "—";

          const waDigits = (req.whatsapp || "").replace(/\D/g, "");
          const waLink = waDigits ? `https://wa.me/${waDigits}` : null;
          const adminLink = "https://refd.lovable.app/admin/subscriptions";

          const lines: string[] = [
            "🆕 <b>طلب اشتراك جديد</b>",
            "",
            `<b>الخطة:</b> ${escapeHtml(planLabel)} (${escapeHtml(cycleLabel)})`,
            `<b>المتجر:</b> ${escapeHtml(req.store_name)}`,
            `<b>الإيميل:</b> ${escapeHtml(req.email)}`,
            `<b>واتساب:</b> ${escapeHtml(req.whatsapp)}`,
            `<b>طريقة الدفع:</b> ${escapeHtml(paymentLabel)}`,
            `<b>الحالة:</b> ${escapeHtml(statusLabel)}`,
          ];

          if (req.notes) {
            lines.push("", `📝 <b>ملاحظات العميل:</b>\n${escapeHtml(req.notes)}`);
          }

          lines.push("");
          lines.push(`🔗 <a href="${adminLink}">فتح لوحة الأدمن</a>`);
          if (waLink) {
            lines.push(`💬 <a href="${waLink}">محادثة العميل عبر واتساب</a>`);
          }

          await sendTelegramMessage(adminChatId, lines.join("\n"));

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("notify-telegram-admin error:", error);
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "unknown error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
