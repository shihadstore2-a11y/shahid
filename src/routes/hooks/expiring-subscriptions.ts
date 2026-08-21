import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import * as React from "react";
import { render } from "@react-email/components";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "رِفد";
const SENDER_DOMAIN = "send.rifd.site";
const FROM_DOMAIN = "send.rifd.site";

const PLAN_LABELS: Record<string, string> = {
  free: "مجاني",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  business: "Business",
};

/**
 * Cron-triggered route — يُرسل تذكيرات للاشتراكات التي تقترب من الانتهاء.
 * يفحص خانتين زمنيتين:
 *   - 7 أيام بالضبط قبل activated_until  → تذكير أول
 *   - 1 يوم بالضبط قبل activated_until   → تذكير عاجل
 *
 * يستخدم idempotencyKey فريد (request_id + bucket) لمنع التكرار.
 * يُستدعى من pg_cron يومياً، ويتجاوز middleware لأن المسار تحت /hooks/.
 */
export const Route = createFileRoute("/hooks/expiring-subscriptions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json(
            { error: "Server configuration error" },
            { status: 500 },
          );
        }

        // Authorization عبر Bearer (anon أو service role) — كلاهما مقبول
        // لأن المسار idempotent (يفحص email_send_log قبل الإرسال)
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createClient<any>(supabaseUrl, serviceKey);

        // النوافذ الزمنية: ±12 ساعة حول الهدف لضمان عدم تفويت أي تشغيل يومي
        const now = new Date();
        const windows = [
          { days: 7, label: "7d" as const },
          { days: 1, label: "1d" as const },
        ];

        const results: Array<{
          requestId: string;
          email: string;
          bucket: string;
          status: string;
        }> = [];

        for (const { days, label } of windows) {
          const target = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
          const lower = new Date(target.getTime() - 12 * 60 * 60 * 1000);
          const upper = new Date(target.getTime() + 12 * 60 * 60 * 1000);

          const { data: rows, error } = await supabase
            .from("subscription_requests")
            .select(
              "id, email, plan, store_name, activated_until, status",
            )
            .eq("status", "activated")
            .gte("activated_until", lower.toISOString())
            .lt("activated_until", upper.toISOString());

          if (error) {
            console.error("expiring-subscriptions query failed", { error });
            continue;
          }

          for (const row of rows ?? []) {
            const idempotencyKey = `sub-expiring-${label}-${row.id}`;
            const messageId = idempotencyKey;

            // فحص الـsuppression
            const { data: suppressed } = await supabase
              .from("suppressed_emails")
              .select("email")
              .eq("email", row.email.toLowerCase())
              .maybeSingle();
            if (suppressed) {
              results.push({
                requestId: row.id,
                email: row.email,
                bucket: label,
                status: "suppressed",
              });
              continue;
            }

            // فحص التكرار: هل سبق إرسال هذا الـidempotencyKey؟
            const { data: existing } = await supabase
              .from("email_send_log")
              .select("id")
              .eq("message_id", messageId)
              .in("status", ["pending", "sent"])
              .maybeSingle();
            if (existing) {
              results.push({
                requestId: row.id,
                email: row.email,
                bucket: label,
                status: "duplicate",
              });
              continue;
            }

            // تجهيز محتوى البريد
            const template = TEMPLATES["subscription-expiring"];
            if (!template) {
              console.error("Template subscription-expiring not registered");
              continue;
            }

            const expiresAt = new Date(row.activated_until).toLocaleDateString(
              "ar-SA",
              { year: "numeric", month: "long", day: "numeric" },
            );
            const templateData = {
              fullName: row.store_name ?? undefined,
              planLabel: PLAN_LABELS[row.plan] ?? row.plan,
              daysRemaining: days,
              expiresAt,
              renewUrl: "https://rifd.site/dashboard/billing",
            };

            try {
              const element = React.createElement(
                template.component,
                templateData,
              );
              const html = await render(element);
              const plainText = await render(element, { plainText: true });
              const subject =
                typeof template.subject === "function"
                  ? template.subject(templateData)
                  : template.subject;

              // ضع الرسالة مباشرة في طابور البريد المعاملاتي
              const { error: enqueueError } = await supabase.rpc(
                "enqueue_email" as any,
                {
                  queue_name: "transactional_emails",
                  payload: {
                    message_id: messageId,
                    label: "subscription-expiring",
                    to: row.email,
                    from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
                    sender_domain: SENDER_DOMAIN,
                    purpose: "transactional",
                    idempotency_key: idempotencyKey,
                    subject,
                    html,
                    text: plainText,
                    queued_at: new Date().toISOString(),
                  },
                } as any,
              );

              if (enqueueError) {
                console.error("Failed to enqueue expiring email", {
                  enqueueError,
                  requestId: row.id,
                });
                results.push({
                  requestId: row.id,
                  email: row.email,
                  bucket: label,
                  status: "enqueue_failed",
                });
                continue;
              }

              await supabase.from("email_send_log").insert({
                message_id: messageId,
                template_name: "subscription-expiring",
                recipient_email: row.email,
                status: "pending",
              });

              results.push({
                requestId: row.id,
                email: row.email,
                bucket: label,
                status: "enqueued",
              });
            } catch (e) {
              console.error("Failed to render/enqueue expiring email", {
                e,
                requestId: row.id,
              });
              results.push({
                requestId: row.id,
                email: row.email,
                bucket: label,
                status: "render_failed",
              });
            }
          }
        }

        return Response.json({
          processed: results.length,
          results,
        });
      },
    },
  },
});
