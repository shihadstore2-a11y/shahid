import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * يخزّن chat_id الوجهة في internal_config.telegram_admin_chat_id
 * عبر RLS (الأدمن فقط).
 */
export const Route = createFileRoute("/api/telegram-set-chat-id")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            return jsonError("server misconfigured", 500);
          }

          const authHeader = request.headers.get("Authorization") ?? "";
          const token = authHeader.replace(/^Bearer\s+/i, "").trim();
          if (!token) return jsonError("unauthorized: missing token", 401);

          let body: { chat_id?: string | number } = {};
          try {
            body = await request.json();
          } catch {
            return jsonError("invalid json body", 400);
          }

          const raw = body.chat_id;
          if (raw === undefined || raw === null || raw === "") {
            return jsonError("chat_id required", 400);
          }
          const chatIdStr = String(raw).trim();
          // chat_id قد يكون سالب (مجموعات) — نسمح بإشارة - في البداية فقط
          if (!/^-?\d+$/.test(chatIdStr)) {
            return jsonError("chat_id must be a numeric value", 400);
          }

          const userClient = createClient<Database>(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            {
              auth: { persistSession: false, autoRefreshToken: false },
              global: { headers: { Authorization: `Bearer ${token}` } },
            }
          );

          // admin gate صريح
          const { data: userData, error: userErr } = await userClient.auth.getUser();
          if (userErr || !userData.user) return jsonError("unauthorized", 401);

          const { data: roleRow } = await userClient
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id)
            .eq("role", "admin")
            .maybeSingle();
          if (!roleRow) return jsonError("forbidden: admin only", 403);

          const { error } = await userClient
            .from("internal_config")
            .upsert(
              [{ key: "telegram_admin_chat_id", value: chatIdStr }],
              { onConflict: "key" }
            );

          if (error) {
            console.error("set-chat-id upsert error:", error);
            return jsonError(error.message, 403);
          }

          return new Response(
            JSON.stringify({ ok: true, chat_id: chatIdStr }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("telegram-set-chat-id error:", error);
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
