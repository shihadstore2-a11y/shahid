import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * توليد signed URL لعرض إيصال التحويل البنكي.
 *
 * - المستخدم العادي: يستطيع توليد URL لإيصاله الشخصي فقط (مسار يبدأ بـ user_id الخاص به)
 * - الأدمن: يستطيع توليد URL لأي إيصال
 * - مدة الصلاحية: 5 دقائق فقط (300 ثانية) لأن الإيصال يحتوي بيانات بنكية حساسة
 */
export const getReceiptSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      path: z
        .string()
        .min(1)
        .max(500)
        // مسار آمن: user_id/filename — لا يحتوي على .. أو أحرف خطرة
        .regex(/^[a-f0-9-]+\/[a-zA-Z0-9._-]+$/i, "Invalid receipt path"),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // التحقق من الصلاحية:
    // 1. إذا كان المسار يبدأ بـ user_id المستخدم → مسموح
    // 2. وإلا → التحقق من دور admin
    const pathOwnerId = data.path.split("/")[0];
    const isOwner = pathOwnerId === userId;

    if (!isOwner) {
      // التحقق من دور admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        throw new Response("Forbidden: Not authorized to view this receipt", {
          status: 403,
        });
      }
    }

    // توليد signed URL باستخدام service role (bucket خاص)
    const { data: signedData, error } = await supabaseAdmin.storage
      .from("payment-receipts")
      .createSignedUrl(data.path, 300); // 5 دقائق

    if (error || !signedData?.signedUrl) {
      throw new Response(`Failed to generate signed URL: ${error?.message ?? "unknown"}`, {
        status: 500,
      });
    }

    return {
      url: signedData.signedUrl,
      expiresIn: 300,
    };
  });

export const markSubscriptionReceiptUploaded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      requestId: z.string().uuid(),
      path: z
        .string()
        .min(1)
        .max(500)
        .regex(/^[a-f0-9-]+\/[a-f0-9-]+\.[a-z0-9]+$/i, "Invalid receipt path"),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const expectedPrefix = `${userId}/${data.requestId}.`;

    if (!data.path.startsWith(expectedPrefix)) {
      throw new Response("Forbidden: receipt path does not match request owner", { status: 403 });
    }

    const { data: requestRow, error: readError } = await supabase
      .from("subscription_requests")
      .select("id, user_id, status")
      .eq("id", data.requestId)
      .maybeSingle();

    if (readError) throw new Error(`Failed to verify subscription request: ${readError.message}`);
    if (!requestRow || requestRow.user_id !== userId) {
      throw new Response("Forbidden: subscription request not found for this user", { status: 403 });
    }
    if (requestRow.status === "activated") {
      throw new Error("لا يمكن تعديل إيصال طلب تم تفعيله مسبقاً");
    }

    const { error: updateError } = await supabaseAdmin
      .from("subscription_requests")
      .update({
        receipt_path: data.path,
        receipt_uploaded_at: new Date().toISOString(),
      })
      .eq("id", data.requestId)
      .eq("user_id", userId);

    if (updateError) throw new Error(`Failed to mark receipt uploaded: ${updateError.message}`);

    return { ok: true };
  });
