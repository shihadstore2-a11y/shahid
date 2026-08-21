/**
 * OCR Receipt Hook (authenticated fire-and-forget)
 *
 * يُستدعى من واجهة العميل بعد رفع الإيصال، ويشترط JWT صالحاً وملكية الطلب.
 *
 * النتيجة تُكتب في `subscription_requests.admin_notes` لمراجعة الأدمن.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { PLAN_BY_ID, type PlanId } from "@/lib/plan-catalog";
import { extractReceiptInsights, buildOcrAdminNote } from "@/server/receipt-ocr";

const RECEIPT_BUCKET = "payment-receipts";
const SIGNED_URL_TTL_SECONDS = 300; // 5 دقائق فقط — كافٍ لاستدعاء AI

export const Route = createFileRoute("/api/public/hooks/ocr-receipt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            request_id?: string;
          };
          const requestId = body.request_id;
          if (!requestId || typeof requestId !== "string" || requestId.length > 64) {
            return new Response(JSON.stringify({ error: "invalid request_id" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const supabaseUrl = process.env.SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!supabaseUrl || !serviceKey) {
            return new Response(
              JSON.stringify({ error: "server misconfigured" }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
          const admin = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          const { data: switchEnabled } = await admin.rpc("operational_switch_enabled", { _key: "ocr_receipt_enabled" });
          if (switchEnabled === false) {
            return new Response(JSON.stringify({ ok: false, reason: "ocr_disabled" }), {
              status: 202,
              headers: { "Content-Type": "application/json" },
            });
          }

          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
          if (!token) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { data: authData, error: authError } = await admin.auth.getUser(token);
          const callerId = authData.user?.id;
          if (authError || !callerId) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 1. اقرأ الطلب وتأكد من ملكيته قبل تشغيل OCR
          const { data: req, error: reqErr } = await admin
            .from("subscription_requests")
            .select(
              "id, user_id, plan, billing_cycle, receipt_path, admin_notes, status, ocr_processed_at, ocr_receipt_path"
            )
            .eq("id", requestId)
            .eq("user_id", callerId)
            .maybeSingle();

          if (reqErr || !req || !req.receipt_path) {
            return new Response(
              JSON.stringify({ ok: false, reason: "no_receipt" }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // 2. لا تكرّر OCR إن كانت النتيجة موجودة
          if (req.ocr_processed_at && req.ocr_receipt_path === req.receipt_path) {
            return new Response(
              JSON.stringify({ ok: true, reason: "already_processed" }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // 3. وقّع رابطاً قصير العمر للملف
          const { data: signed, error: signErr } = await admin.storage
            .from(RECEIPT_BUCKET)
            .createSignedUrl(req.receipt_path, SIGNED_URL_TTL_SECONDS);

          if (signErr || !signed?.signedUrl) {
            return new Response(
              JSON.stringify({ ok: false, reason: "sign_failed" }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // 4. استنتج نوع الملف من الامتداد
          const ext = (req.receipt_path.split(".").pop() ?? "").toLowerCase();
          const mimeType =
            ext === "pdf"
              ? "application/pdf"
              : ext === "png"
                ? "image/png"
                : ext === "webp"
                  ? "image/webp"
                  : "image/jpeg";

          // 5. شغّل OCR
          const insights = await extractReceiptInsights(
            signed.signedUrl,
            mimeType
          );

          // 6. احسب السعر المتوقّع
          const expected =
            req.billing_cycle === "yearly"
              ? PLAN_BY_ID[req.plan as PlanId]?.yearlyPriceSar ?? 0
              : PLAN_BY_ID[req.plan as PlanId]?.monthlyPriceSar ?? 0;

          // 7. اكتب الملاحظة (Append إن وُجدت ملاحظة سابقة)
          const newNote = buildOcrAdminNote(insights, expected);
          const finalNotes = req.admin_notes
            ? `${req.admin_notes}\n\n${newNote}`
            : newNote;

          await admin
            .from("subscription_requests")
            .update({ admin_notes: finalNotes, ocr_processed_at: new Date().toISOString(), ocr_receipt_path: req.receipt_path, ocr_status: insights.ok ? "processed" : "review_needed", ocr_error: insights.ok ? null : insights.error ?? "ocr_uncertain" })
            .eq("id", requestId);

          return new Response(
            JSON.stringify({ ok: true, processed: insights.ok }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("ocr-receipt error:", error);
          return new Response(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : "unknown",
            }),
            {
              status: 200, // fire-and-forget — لا نُرجع 500
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
