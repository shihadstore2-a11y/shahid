/**
 * POST /api/public/contact-submit
 *
 * نقطة استقبال نموذج "تواصل معنا" — عامة (بدون تسجيل دخول).
 *
 * طبقات الحماية:
 *  1. Honeypot field (`website`) — إذا مُلئ → 400 بدون أي تخزين أو تنبيه.
 *  2. Zod validation صارمة (طول، صيغة، تنظيف) — لمنع DoS وحقن.
 *  3. Rate limit بحدّ 5 رسائل/ساعة لكل IP عبر `demo_rate_limits` (مُعاد استخدامها).
 *  4. تخزين في `contact_submissions` بـ `supabaseAdmin` (RLS تسمح للـservice_role فقط).
 *  5. تنبيه Telegram للأدمن (best-effort — لا يُفشل الطلب).
 *  6. إرسال بريد تأكيد للعميل عبر Lovable Email (best-effort).
 *
 * ⚠️ best-effort = نُسجّل فشل التنبيه/البريد لكن نُعيد للعميل success إذا حُفظ في DB.
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ───────────────────────────── Validation ─────────────────────────────
const ContactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "الاسم قصير جداً")
    .max(80, "الاسم طويل جداً"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("بريد إلكتروني غير صالح")
    .max(254),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("")),
  subject: z
    .string()
    .trim()
    .min(3, "الموضوع قصير جداً")
    .max(120, "الموضوع طويل جداً"),
  message: z
    .string()
    .trim()
    .min(10, "الرسالة قصيرة جداً")
    .max(2000, "الرسالة طويلة جداً"),
  // Honeypot — يجب أن يكون فارغاً دائماً
  website: z.string().max(0).optional().or(z.literal("")),
});

// ───────────────────────────── Helpers ─────────────────────────────
function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

const RATE_LIMIT_PER_HOUR = 5;

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  if (ip === "unknown") return { allowed: true, remaining: RATE_LIMIT_PER_HOUR };
  try {
    const { data, error } = await supabaseAdmin.rpc("consume_demo_token", {
      _ip: `contact:${ip}`,
      _limit: RATE_LIMIT_PER_HOUR,
    });
    if (error) {
      console.warn("[contact-submit] rate-limit check failed", error.message);
      return { allowed: true, remaining: RATE_LIMIT_PER_HOUR };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: row?.allowed ?? true,
      remaining: row?.remaining ?? 0,
    };
  } catch (err) {
    console.warn("[contact-submit] rate-limit RPC threw", err);
    return { allowed: true, remaining: RATE_LIMIT_PER_HOUR };
  }
}

async function notifyTelegram(payload: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  id: string;
}) {
  const secret = process.env.NOTIFY_WEBHOOK_SECRET;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!secret || !adminChatId) return;

  // We send Telegram directly (not through notify-telegram-admin which is for subscriptions)
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) return;

  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const lines = [
    "📩 <b>رسالة تواصل جديدة</b>",
    "",
    `<b>الاسم:</b> ${escape(payload.name)}`,
    `<b>الإيميل:</b> ${escape(payload.email)}`,
    payload.phone ? `<b>الجوال:</b> ${escape(payload.phone)}` : null,
    `<b>الموضوع:</b> ${escape(payload.subject)}`,
    "",
    `<b>الرسالة:</b>`,
    escape(payload.message).slice(0, 1000),
    "",
    `🆔 <code>${payload.id}</code>`,
  ].filter(Boolean);

  try {
    await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.warn("[contact-submit] telegram notify failed", err);
  }
}

async function sendConfirmationEmail(args: {
  to: string;
  name: string;
  subject: string;
  message: string;
  id: string;
}) {
  // إعادة استخدام بنية Lovable Email — نستدعي الـserver route مباشرة من الخادم
  // عبر URL داخلي. نمرّر service-role-style header؟ لا — البنية تتطلب JWT.
  // الحل: نُدخل في pgmq queue مباشرة باستخدام enqueue_email RPC.
  try {
    const { error } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        templateName: "contact-confirmation",
        recipientEmail: args.to,
        idempotencyKey: `contact-confirm-${args.id}`,
        templateData: {
          fullName: args.name,
          subject: args.subject,
          message: args.message,
        },
      },
    });
    if (error) {
      console.warn("[contact-submit] enqueue_email failed", error.message);
    }
  } catch (err) {
    console.warn("[contact-submit] enqueue threw", err);
  }
}

// ───────────────────────────── Route ─────────────────────────────
export const Route = createFileRoute("/api/public/contact-submit")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
          },
        }),

      POST: async ({ request }) => {
        const respond = (status: number, body: Record<string, unknown>) =>
          new Response(JSON.stringify(body), {
            status,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return respond(400, { error: "invalid_json" });
        }

        const parsed = ContactSchema.safeParse(raw);
        if (!parsed.success) {
          return respond(400, {
            error: "validation_failed",
            issues: parsed.error.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
          });
        }

        const data = parsed.data;

        // 1. Honeypot — إذا الحقل المخفي مُلئ، نرفض الطلب حسب معيار QA V9
        if (data.website && data.website.length > 0) {
          console.warn("[contact-submit] honeypot tripped", { ip: getClientIp(request) });
          return respond(400, { error: "bot_detected" });
        }

        // 2. Rate limit
        const ip = getClientIp(request);
        const rl = await checkRateLimit(ip);
        if (!rl.allowed) {
          return respond(429, {
            error: "rate_limited",
            message: "تجاوزت الحد المسموح (5 رسائل/ساعة). حاول لاحقاً.",
          });
        }

        // 3. Insert
        const ipHash = ip !== "unknown" ? hashIp(ip) : null;
        const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("contact_submissions")
          .insert({
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            subject: data.subject,
            message: data.message,
            ip_hash: ipHash,
            user_agent: userAgent,
            status: "new",
          })
          .select("id")
          .single();

        if (insertErr || !inserted) {
          console.error("[contact-submit] insert failed", insertErr);
          return respond(500, { error: "insert_failed" });
        }

        const id = inserted.id;

        // 4 + 5. Best-effort notify + email (parallel, errors swallowed)
        await Promise.allSettled([
          notifyTelegram({
            id,
            name: data.name,
            email: data.email,
            phone: data.phone || undefined,
            subject: data.subject,
            message: data.message,
          }),
          sendConfirmationEmail({
            to: data.email,
            name: data.name,
            subject: data.subject,
            message: data.message,
            id,
          }),
        ]);

        return respond(200, {
          ok: true,
          id,
          remaining: rl.remaining,
        });
      },
    },
  },
});
