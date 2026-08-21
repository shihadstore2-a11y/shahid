import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const OLD_DOMAINS = ["rifd.club", "rifd.tech"];

// قائمة الصفحات المنشورة للفحص
const PAGES_TO_SCAN = [
  "/",
  "/about",
  "/pricing",
  "/legal/privacy",
  "/legal/refund",
  "/legal/terms",
  "/vs-chatgpt",
];

const PUBLIC_BASE = "https://rifd.lovable.app";

type DbHit = { table: string; column: string; count: number };
type HtmlHit = { url: string; matches: Record<string, number> };

async function scanDatabase(
  supabaseAdmin: any
): Promise<{ hits: DbHit[]; total: number }> {
  const checks = [
    { table: "profiles", column: "email" },
    { table: "subscription_requests", column: "email" },
    { table: "email_send_log", column: "recipient_email" },
    { table: "suppressed_emails", column: "email" },
  ];

  const hits: DbHit[] = [];
  let total = 0;

  for (const { table, column } of checks) {
    for (const domain of OLD_DOMAINS) {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select("*", { count: "exact", head: true })
        .ilike(column, `%${domain}%`);

      if (error) {
        console.error(`scan error ${table}.${column}:`, error.message);
        continue;
      }
      if ((count ?? 0) > 0) {
        hits.push({ table, column: `${column} ~ ${domain}`, count: count ?? 0 });
        total += count ?? 0;
      }
    }
  }

  return { hits, total };
}

async function scanPublishedHtml(): Promise<{ hits: HtmlHit[]; total: number }> {
  const hits: HtmlHit[] = [];
  let total = 0;

  for (const path of PAGES_TO_SCAN) {
    try {
      const res = await fetch(`${PUBLIC_BASE}${path}`, {
        headers: { "Accept-Encoding": "identity" },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const matches: Record<string, number> = {};
      for (const domain of OLD_DOMAINS) {
        const re = new RegExp(domain.replace(".", "\\."), "g");
        const found = html.match(re)?.length ?? 0;
        if (found > 0) matches[domain] = found;
      }
      if (Object.keys(matches).length > 0) {
        hits.push({ url: path, matches });
        total += Object.values(matches).reduce((a, b) => a + b, 0);
      }
    } catch (e) {
      console.error(`html scan error ${path}:`, (e as Error).message);
    }
  }

  return { hits, total };
}

export const Route = createFileRoute("/hooks/domain-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ---- Auth: قبول إما (1) JWT أدمن من واجهة الأدمن، أو (2) NOTIFY_WEBHOOK_SECRET من cron ----
        // (السابق كان يعتمد على anon key وهو مكشوف في الـ bundle — ثغرة HOOKS_ANON_KEY_AUTH)
        const supabaseUrl = process.env.SUPABASE_URL!;
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const webhookSecret = process.env.NOTIFY_WEBHOOK_SECRET;

        const authHeader = request.headers.get("authorization");
        const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
        const providedWebhookSecret = request.headers.get("x-webhook-secret");

        let authorized = false;

        // مسار 1: webhook secret من cron (يُحدَّث الـ cron لاحقاً ليستخدم x-webhook-secret)
        if (
          webhookSecret &&
          providedWebhookSecret &&
          providedWebhookSecret === webhookSecret
        ) {
          authorized = true;
        }

        // مسار 2: JWT أدمن من admin UI
        if (!authorized && token) {
          const supabaseUserCtx = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { data: claimsData } = await supabaseUserCtx.auth.getClaims(token);
          const userId = claimsData?.claims?.sub;
          if (userId) {
            const { data: isAdmin } = await supabaseUserCtx.rpc("has_role", {
              _user_id: userId,
              _role: "admin",
            });
            if (isAdmin) authorized = true;
          }
        }

        if (!authorized) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        try {
          const [dbResult, htmlResult] = await Promise.all([
            scanDatabase(supabaseAdmin),
            scanPublishedHtml(),
          ]);

          const totalMatches = dbResult.total + htmlResult.total;
          const status = totalMatches === 0 ? "clean" : "dirty";

          const details = {
            db: dbResult.hits,
            html: htmlResult.hits,
            scanned_pages: PAGES_TO_SCAN.length,
            scanned_domains: OLD_DOMAINS,
          };

          await supabaseAdmin.from("domain_scan_log").insert({
            scan_type: "combined",
            status,
            total_matches: totalMatches,
            details,
          });

          return new Response(
            JSON.stringify({ success: true, status, totalMatches, details }),
            { headers: { "Content-Type": "application/json" } }
          );
        } catch (e) {
          const msg = (e as Error).message;
          await supabaseAdmin.from("domain_scan_log").insert({
            scan_type: "combined",
            status: "error",
            total_matches: 0,
            details: {},
            error_message: msg,
          });
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
