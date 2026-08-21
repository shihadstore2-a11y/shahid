import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

type TgChat = {
  chat_id: number;
  type: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  title?: string;
};

type BotInfo = {
  id?: number;
  username?: string;
  first_name?: string;
};

/**
 * يحذف الـ webhook (إن وُجد) ثم يقرأ آخر التحديثات من البوت
 * ويستخرج المحادثات الفريدة. كذلك يعيد بيانات البوت من getMe.
 * محمي: لا يعمل إلا للمستخدم admin.
 */
export const Route = createFileRoute("/api/telegram-discover-chats")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;

          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            return jsonError("server misconfigured (supabase env)", 500);
          }
          if (!LOVABLE_API_KEY) return jsonError("LOVABLE_API_KEY missing", 500);
          if (!TELEGRAM_API_KEY) return jsonError("TELEGRAM_API_KEY missing", 500);

          const authHeader = request.headers.get("Authorization") ?? "";
          const token = authHeader.replace(/^Bearer\s+/i, "").trim();
          if (!token) return jsonError("unauthorized: missing token", 401);

          const userClient = createClient<Database>(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            {
              auth: { persistSession: false, autoRefreshToken: false },
              global: { headers: { Authorization: `Bearer ${token}` } },
            }
          );

          const { data: userData, error: userErr } = await userClient.auth.getUser();
          if (userErr || !userData.user) return jsonError("unauthorized", 401);

          const { data: roleRow } = await userClient
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id)
            .eq("role", "admin")
            .maybeSingle();

          if (!roleRow) return jsonError("forbidden: admin only", 403);

          const tgHeaders = {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TELEGRAM_API_KEY,
            "Content-Type": "application/json",
          };

          // 1) deleteWebhook (آمن — لو ما في webhook ما يصير شيء)
          //    drop_pending_updates=false عشان نحافظ على آخر الرسائل
          await fetch(`${GATEWAY_URL}/deleteWebhook`, {
            method: "POST",
            headers: tgHeaders,
            body: JSON.stringify({ drop_pending_updates: false }),
          }).catch(() => null);

          // 2) getMe
          let bot: BotInfo = {};
          try {
            const meRes = await fetch(`${GATEWAY_URL}/getMe`, {
              method: "POST",
              headers: tgHeaders,
              body: JSON.stringify({}),
            });
            const meData = await meRes.json();
            if (meRes.ok && meData.ok) {
              bot = {
                id: meData.result?.id,
                username: meData.result?.username,
                first_name: meData.result?.first_name,
              };
            }
          } catch {
            // ignore — لن يفشل بسبب getMe
          }

          // 3) getUpdates
          const tgRes = await fetch(`${GATEWAY_URL}/getUpdates`, {
            method: "POST",
            headers: tgHeaders,
            body: JSON.stringify({ timeout: 0, allowed_updates: ["message"] }),
          });

          const tgData = await tgRes.json();
          if (!tgRes.ok || !tgData.ok) {
            return jsonError(
              `getUpdates failed [${tgRes.status}]: ${JSON.stringify(tgData)}`,
              502
            );
          }

          const updates: Array<{ message?: { chat?: TgChat & { id: number } } }> =
            tgData.result ?? [];
          const chatsMap = new Map<number, TgChat>();

          for (const u of updates) {
            const chat = u.message?.chat;
            if (!chat || typeof chat.id !== "number") continue;
            if (chatsMap.has(chat.id)) continue;
            chatsMap.set(chat.id, {
              chat_id: chat.id,
              type: chat.type,
              first_name: chat.first_name,
              last_name: chat.last_name,
              username: chat.username,
              title: chat.title,
            });
          }

          const chats = Array.from(chatsMap.values());

          return new Response(
            JSON.stringify({
              ok: true,
              chats,
              bot,
              updates_count: updates.length,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("telegram-discover-chats error:", error);
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
