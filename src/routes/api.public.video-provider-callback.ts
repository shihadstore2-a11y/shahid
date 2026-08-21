import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

const CALLBACK_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Video-Callback-Signature, X-Video-Callback-Timestamp",
  "Access-Control-Max-Age": "86400",
} as const;

const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

const CallbackSchema = z.object({
  jobId: z.string().uuid(),
  providerKey: z.string().trim().min(2).max(80).optional(),
  status: z.enum(["completed", "failed"]),
  resultUrl: z.string().trim().url().max(2000).optional(),
  errorMessage: z.string().trim().max(500).optional(),
  providerJobId: z.string().trim().max(180).optional(),
});

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CALLBACK_HEADERS },
  });
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifySignature(rawBody: string, signature: string | null, timestamp: string | null) {
  const secret = process.env.VIDEO_PROVIDER_CALLBACK_SECRET;
  if (!secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > SIGNATURE_TOLERANCE_MS) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const normalized = signature?.replace(/^sha256=/i, "") ?? "";
  return Boolean(normalized) && safeEqual(normalized, expected);
}

function isCallbackAllowed(job: { provider: string; metadata: Json | null }) {
  const metadata = (job.metadata as Record<string, unknown> | null) ?? {};
  return metadata.allow_provider_callback === true;
}

function appendCallbackAttempt(metadata: Record<string, unknown>, params: { provider: string; ok: boolean; status: string; error?: string }) {
  const attempts = Array.isArray(metadata.provider_attempts) ? metadata.provider_attempts : [];
  return {
    ...metadata,
    provider_attempts: [...attempts, { ...params, finished_at: new Date().toISOString(), source: "provider_callback" }],
    last_attempt_at: new Date().toISOString(),
  };
}

export const Route = createFileRoute("/api/public/video-provider-callback")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CALLBACK_HEADERS }),
      POST: async ({ request }) => {
        const rawBody = await request.text();
        if (!verifySignature(rawBody, request.headers.get("x-video-callback-signature"), request.headers.get("x-video-callback-timestamp"))) {
          return json(401, { error: "unauthorized" });
        }

        let body: unknown;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return json(400, { error: "invalid_json" });
        }

        const parsed = CallbackSchema.safeParse(body);
        if (!parsed.success) return json(400, { error: "validation_failed", issues: parsed.error.issues.map((issue) => issue.path.join(".")) });
        if (parsed.data.status === "completed" && !parsed.data.resultUrl) return json(400, { error: "result_url_required" });
        if (parsed.data.status === "failed" && !parsed.data.errorMessage) return json(400, { error: "error_message_required" });

        const { data: job, error: readError } = await supabaseAdmin.from("video_jobs").select("*").eq("id", parsed.data.jobId).maybeSingle();
        if (readError) return json(500, { error: "read_failed" });
        if (!job) return json(404, { error: "job_not_found" });
        if (job.status !== "processing") return json(200, { ok: true, ignored: true, status: job.status });
        if (!isCallbackAllowed(job) || (parsed.data.providerKey && parsed.data.providerKey !== job.provider)) return json(403, { error: "callback_not_allowed_for_job" });

        const metadataBase = (job.metadata as Record<string, unknown> | null) ?? {};
        const metadata = {
          ...appendCallbackAttempt(metadataBase, {
            provider: job.provider,
            ok: parsed.data.status === "completed",
            status: `callback_${parsed.data.status}`,
            error: parsed.data.errorMessage,
          }),
          callback_received_at: new Date().toISOString(),
          callback_status: parsed.data.status,
        };

        if (parsed.data.status === "completed") {
          const { data: updated, error } = await supabaseAdmin
            .from("video_jobs")
            .update({
              status: "completed",
              result_url: parsed.data.resultUrl,
              provider_job_id: parsed.data.providerJobId ?? job.provider_job_id,
              completed_at: new Date().toISOString(),
              error_message: null,
              metadata: metadata as Json,
            })
            .eq("id", job.id)
            .eq("status", "processing")
            .select("id, status")
            .single();
          if (error || !updated) return json(500, { error: "update_failed" });
          return json(200, { ok: true, jobId: updated.id, status: updated.status });
        }

        const { data: refundId, error: refundError } = job.ledger_id
          ? await supabaseAdmin.rpc("refund_credits", { _ledger_id: job.ledger_id, _reason: "video_provider_callback_failed" })
          : { data: null, error: null };
        if (refundError && !/already_refunded/i.test(refundError.message)) return json(500, { error: "refund_failed" });

        const { data: updated, error } = await supabaseAdmin
          .from("video_jobs")
          .update({
            status: "refunded",
            refund_ledger_id: (refundId as string | null) ?? job.refund_ledger_id,
            provider_job_id: parsed.data.providerJobId ?? job.provider_job_id,
            error_message: parsed.data.errorMessage,
            metadata: metadata as Json,
          })
          .eq("id", job.id)
          .select("id, status")
          .single();
        if (error || !updated) return json(500, { error: "update_failed" });
        return json(200, { ok: true, jobId: updated.id, status: updated.status });
      },
    },
  },
});