import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import * as React from "react";
import { render } from "@react-email/components";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SITE_NAME = "رِفد";
const SENDER_DOMAIN = "send.rifd.site";
const FROM_ADDRESS = `${SITE_NAME} <noreply@notify.send.rifd.site>`;
const QUEUE_NAME = "transactional_emails";

/**
 * Server function — enqueues the welcome email immediately after signup
 * via the Lovable Email queue (pgmq). The process-email-queue dispatcher
 * picks it up within 5 seconds and sends via Lovable Email API.
 *
 * SECURITY: identity (userId + email) is derived ONLY from the verified
 * Supabase JWT via `requireSupabaseAuth`. The optional `fullName` input
 * is the only client-supplied field and is sanitized.
 *
 * Idempotent: uses message_id `welcome-{userId}` and skips if already logged.
 */
export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName?: string }) => ({
    fullName:
      typeof input?.fullName === "string"
        ? input.fullName.trim().slice(0, 120)
        : undefined,
  }))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as {
      userId: string;
      claims: { email?: string };
    };
    const trustedEmail = (claims?.email ?? "").toString().trim().toLowerCase();
    if (!trustedEmail) {
      console.error("send-welcome: no email in verified JWT claims");
      return { status: "no_verified_email" as const };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error("send-welcome: missing SUPABASE_URL/SERVICE_ROLE_KEY");
      return { status: "config_error" as const };
    }

    const supabase = createClient<any>(supabaseUrl, serviceKey);
    const messageId = `welcome-${userId}`;
    const email = trustedEmail;

    // suppression check
    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (suppressed) return { status: "suppressed" as const };

    // idempotency check
    const { data: existing } = await supabase
      .from("email_send_log")
      .select("id, status")
      .eq("message_id", messageId)
      .in("status", ["sent", "pending"])
      .maybeSingle();
    if (existing) return { status: "duplicate" as const };

    const template = TEMPLATES["welcome"];
    if (!template) {
      console.error("send-welcome: template not registered");
      return { status: "no_template" as const };
    }

    try {
      const element = React.createElement(template.component, {
        fullName: data.fullName,
      });
      const html = await render(element);
      const text = await render(element, { plainText: true });
      const subject =
        typeof template.subject === "function"
          ? template.subject({ fullName: data.fullName })
          : template.subject;

      // Log pending
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "welcome",
        recipient_email: email,
        status: "pending",
        metadata: { source: "signup_trigger" },
      });

      const { error: enqueueError } = await supabase.rpc("enqueue_email", {
        queue_name: QUEUE_NAME,
        payload: {
          to: email,
          from: FROM_ADDRESS,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: "transactional",
          label: "welcome",
          idempotency_key: messageId,
          message_id: messageId,
          queued_at: new Date().toISOString(),
        },
      });

      if (enqueueError) {
        const errMsg = String(enqueueError.message ?? enqueueError).slice(0, 1000);
        console.error("send-welcome: enqueue failed", { messageId, errMsg });
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: "welcome",
          recipient_email: email,
          status: "failed",
          error_message: errMsg,
          metadata: { source: "signup_trigger" },
        });
        return { status: "enqueue_failed" as const, error: errMsg };
      }

      console.log("send-welcome: enqueued", { messageId });
      return { status: "queued" as const, messageId };
    } catch (err: any) {
      const errMsg = String(err?.message ?? err).slice(0, 1000);
      console.error("send-welcome: failed", { messageId, errMsg });
      return { status: "send_failed" as const, error: errMsg };
    }
  });
