import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import * as React from "react";
import { render } from "@react-email/components";
import { TEMPLATES } from "@/lib/email-templates/registry";

/**
 * Wave C2 — Activation Email Sequence
 * يومياً 09:00 Riyadh عبر pg_cron → /api/public/hooks/activation-sequence
 *
 * 5 مراحل (Day 0/1/3/7/14) مع segmentation بالشارات:
 *   Day 0  → activation-day0  (بعد إكمال wizard، إذا لم تُمنح شارة active_store)
 *   Day 1  → onboarding-day1   (إذا لم تُمنح شارة first_text)
 *   Day 3  → onboarding-tip-day3 (إذا لم يُكمل onboarding)
 *   Day 7  → onboarding-day7   (إذا لم تُمنح شارة first_image)
 *   Day 14 → activation-day14  (إذا لا يزال على free plan)
 *
 * كل إيميل يُسجَّل في activation_email_log (مع skipped + skip_reason)
 * لقياس open/click rates عبر RPC get_email_activation_funnel.
 */

const SITE_NAME = "رِفد";
const SENDER_DOMAIN = "send.rifd.site";
const FROM_ADDRESS = `${SITE_NAME} <noreply@notify.send.rifd.site>`;
const QUEUE_NAME = "transactional_emails";

type DayConfig = {
  day: 0 | 1 | 3 | 7 | 14;
  template: string;
  /** الشارة التي إذا مُنحت يُتخطّى الإيميل (segmentation). */
  skipIfBadge?: "first_text" | "first_image" | "first_video" | "active_store";
  /** يُرسَل فقط إن كان onboarded=false. */
  requireNotOnboarded?: boolean;
  /** يُرسَل فقط إن كان plan='free'. */
  requireFreePlan?: boolean;
  /** Day 0 يعتمد على onboarding_completed_at، البقية على created_at. */
  anchor: "created_at" | "onboarding_completed_at";
};

const SEQUENCE: DayConfig[] = [
  { day: 0, template: "activation-day0", skipIfBadge: "active_store", anchor: "onboarding_completed_at" },
  { day: 1, template: "onboarding-day1", skipIfBadge: "first_text", anchor: "created_at" },
  { day: 3, template: "onboarding-tip-day3", requireNotOnboarded: true, anchor: "created_at" },
  { day: 7, template: "onboarding-day7", skipIfBadge: "first_image", anchor: "created_at" },
  { day: 14, template: "activation-day14", requireFreePlan: true, anchor: "created_at" },
];

export const Route = createFileRoute("/api/public/hooks/activation-sequence")({
  server: {
    handlers: {
      POST: async () => {
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: "missing_config" }, { status: 500 });
        }

        const supabase = createClient<any>(supabaseUrl, serviceKey);
        const now = new Date();
        const results: Array<{ user_id: string; day: number; status: string }> = [];

        for (const cfg of SEQUENCE) {
          const target = new Date(now.getTime() - cfg.day * 24 * 60 * 60 * 1000);
          const lower = new Date(target.getTime() - 12 * 60 * 60 * 1000);
          const upper = new Date(target.getTime() + 12 * 60 * 60 * 1000);

          let q = supabase
            .from("profiles")
            .select("id, email, full_name, store_name, onboarded, plan, created_at, onboarding_completed_at")
            .gte(cfg.anchor, lower.toISOString())
            .lt(cfg.anchor, upper.toISOString())
            .not("email", "is", null);

          if (cfg.requireNotOnboarded) q = q.eq("onboarded", false);
          if (cfg.requireFreePlan) q = q.eq("plan", "free");

          const { data: rows, error } = await q;
          if (error) {
            console.error(`day-${cfg.day} query failed`, error);
            continue;
          }

          for (const row of rows ?? []) {
            const status = await processRow(supabase, cfg, row);
            results.push({ user_id: row.id, day: cfg.day, status });
          }
        }

        return Response.json({ processed: results.length, results });
      },
    },
  },
});

async function processRow(
  supabase: ReturnType<typeof createClient<any>>,
  cfg: DayConfig,
  row: {
    id: string;
    email: string;
    full_name: string | null;
    store_name: string | null;
  },
): Promise<string> {
  // إيدمبوتنسي: لا نُرسل نفس اليوم لنفس المستخدم مرتين
  const { data: existing } = await supabase
    .from("activation_email_log")
    .select("id, skipped")
    .eq("user_id", row.id)
    .eq("day_marker", cfg.day)
    .maybeSingle();
  if (existing) return existing.skipped ? "already_skipped" : "already_sent";

  // Segmentation: تخطّ إذا الشارة المطلوبة موجودة
  if (cfg.skipIfBadge) {
    const { data: badge } = await supabase
      .from("user_badges")
      .select("id")
      .eq("user_id", row.id)
      .eq("badge_type", cfg.skipIfBadge)
      .maybeSingle();
    if (badge) {
      await supabase.from("activation_email_log").insert({
        user_id: row.id,
        day_marker: cfg.day,
        template_name: cfg.template,
        recipient_email: row.email,
        skipped: true,
        skip_reason: `badge_${cfg.skipIfBadge}_already_awarded`,
      });
      return "skipped_badge";
    }
  }

  // Suppression check
  const { data: suppressed } = await supabase
    .from("suppressed_emails")
    .select("email")
    .eq("email", row.email.toLowerCase())
    .maybeSingle();
  if (suppressed) {
    await supabase.from("activation_email_log").insert({
      user_id: row.id,
      day_marker: cfg.day,
      template_name: cfg.template,
      recipient_email: row.email,
      skipped: true,
      skip_reason: "suppressed",
    });
    return "skipped_suppressed";
  }

  const template = TEMPLATES[cfg.template];
  if (!template) {
    console.error(`template ${cfg.template} not registered`);
    return "no_template";
  }

  const templateData: Record<string, unknown> = {
    fullName: row.full_name ?? undefined,
    storeName: row.store_name ?? undefined,
  };

  try {
    const element = React.createElement(template.component, templateData);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = typeof template.subject === "function" ? template.subject(templateData) : template.subject;
    const messageId = `activation-day${cfg.day}-${row.id}`;

    // Log في email_send_log + activation_email_log
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: cfg.template,
      recipient_email: row.email,
      status: "pending",
    });

    const { error: enqueueErr } = await supabase.rpc("enqueue_email", {
      queue_name: QUEUE_NAME,
      payload: {
        to: row.email,
        from: FROM_ADDRESS,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: cfg.template,
        idempotency_key: messageId,
        message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueErr) {
      console.error("enqueue failed", enqueueErr);
      return "enqueue_failed";
    }

    await supabase.from("activation_email_log").insert({
      user_id: row.id,
      day_marker: cfg.day,
      template_name: cfg.template,
      recipient_email: row.email,
    });

    return "queued";
  } catch (e) {
    console.error("render exception", { day: cfg.day, e });
    return "render_failed";
  }
}
