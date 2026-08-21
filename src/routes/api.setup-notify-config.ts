import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * يُستدعى من لوحة الأدمن لتخزين webhook URL + secret في internal_config.
 * يستخدم جلسة المستخدم (Bearer token) — RLS يضمن أن الأدمن فقط يقدر يكتب.
 */
export const Route = createFileRoute("/api/setup-notify-config")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
          const NOTIFY_WEBHOOK_SECRET = process.env.NOTIFY_WEBHOOK_SECRET;

          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            return jsonError("server misconfigured (supabase env)", 500);
          }
          if (!NOTIFY_WEBHOOK_SECRET) {
            return jsonError("NOTIFY_WEBHOOK_SECRET missing on server", 500);
          }

          const authHeader = request.headers.get("Authorization") ?? "";
          const token = authHeader.replace(/^Bearer\s+/i, "").trim();
          if (!token) return jsonError("unauthorized: missing token", 401);

          // عميل Supabase موقّع باسم المستخدم — RLS تنطبق
          const userClient = createClient<Database>(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            {
              auth: { persistSession: false, autoRefreshToken: false },
              global: { headers: { Authorization: `Bearer ${token}` } },
            }
          );

          // admin gate صريح — قبل أي عملية كتابة
          const { data: userData, error: userErr } = await userClient.auth.getUser();
          if (userErr || !userData.user) return jsonError("unauthorized", 401);

          const { data: roleRow } = await userClient
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id)
            .eq("role", "admin")
            .maybeSingle();
          if (!roleRow) return jsonError("forbidden: admin only", 403);

          // RLS على internal_config تسمح للأدمن فقط — هذا تأكيد إضافي
          const origin = new URL(request.url).origin;
          const webhookUrl = `${origin}/api/notify-telegram-admin`;

          const { error } = await userClient
            .from("internal_config")
            .upsert(
              [
                { key: "notify_webhook_url", value: webhookUrl },
                { key: "notify_webhook_secret", value: NOTIFY_WEBHOOK_SECRET },
              ],
              { onConflict: "key" }
            );

          if (error) {
            console.error("setup-notify-config upsert error:", error);
            // لو RLS رفض، Supabase ترجع رسالة واضحة
            return jsonError(error.message, 403);
          }

          return new Response(
            JSON.stringify({ ok: true, webhookUrl }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("setup-notify-config error:", error);
          return jsonError(
            error instanceof Error ? error.message : "unknown",
            500
          );
        }
      },
    },
  },
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
