/**
 * DNS Check — فحص سجلات DNS المطلوبة لنطاق البريد عبر DNS-over-HTTPS (Cloudflare).
 *
 * يفحص: NS, MX, SPF (TXT), DKIM (TXT على selector mailgun._domainkey), DMARC (TXT على _dmarc).
 * محمي بـ requireSupabaseAuth + فحص دور admin.
 *
 * المزود: Cloudflare DoH (https://cloudflare-dns.com/dns-query) — يعمل من Cloudflare Workers
 * بدون تبعيات Node-only، يدعم DNSSEC، ومعدل استجابة عالي.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, type DbClient } from "@/server/admin-auth";

// ---- DoH Types ----
type DohAnswer = { name: string; type: number; TTL: number; data: string };
type DohResponse = {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: { name: string; type: number }[];
  Answer?: DohAnswer[];
  Authority?: DohAnswer[];
};

const DNS_TYPE = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16 } as const;
type DnsType = keyof typeof DNS_TYPE;

async function queryDns(name: string, type: DnsType): Promise<DohResponse> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, {
    headers: { Accept: "application/dns-json" },
  });
  if (!res.ok) throw new Error(`DoH ${type} ${name} failed: ${res.status}`);
  return (await res.json()) as DohResponse;
}

// إزالة علامتي الاقتباس المحيطة بقيم TXT (DoH تعيدها مع quotes)
function cleanTxt(s: string): string {
  return s.replace(/^"|"$/g, "").replace(/"\s+"/g, "");
}

// ---- نتائج كل سجل ----
export type RecordCheck = {
  type: DnsType | "DKIM" | "DMARC" | "SPF";
  name: string;
  status: "pass" | "warn" | "fail" | "missing";
  found: string[];
  expected: string;
  message: string;
};

export type DnsCheckResult = {
  domain: string;
  checked_at: string;
  overall: "ready" | "partial" | "not_configured";
  records: RecordCheck[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
    missing: number;
  };
};

const inputSchema = z.object({
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "نطاق غير صالح"),
});

export const checkEmailDns = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<DnsCheckResult> => {
    const { supabase, userId } = context as { supabase: DbClient; userId: string };
    await assertAdmin(supabase, userId);

    const domain = data.domain.toLowerCase().trim();
    const records: RecordCheck[] = [];

    // ---- 1. NS records ----
    try {
      const ns = await queryDns(domain, "NS");
      const nsValues = ns.Answer?.filter((a) => a.type === DNS_TYPE.NS).map((a) => a.data) ?? [];
      records.push({
        type: "NS",
        name: domain,
        status: nsValues.length > 0 ? "pass" : "missing",
        found: nsValues,
        expected: "سجلات NS لمزود البريد (Mailgun/Lovable)",
        message:
          nsValues.length > 0
            ? `${nsValues.length} سجل NS موجود`
            : "لا توجد سجلات NS — النطاق غير مُفوَّض",
      });
    } catch (e) {
      records.push({
        type: "NS",
        name: domain,
        status: "fail",
        found: [],
        expected: "NS records",
        message: `خطأ في الاستعلام: ${e instanceof Error ? e.message : "unknown"}`,
      });
    }

    // ---- 2. MX records ----
    try {
      const mx = await queryDns(domain, "MX");
      const mxValues = mx.Answer?.filter((a) => a.type === DNS_TYPE.MX).map((a) => a.data) ?? [];
      const hasMailgun = mxValues.some((v) => /mailgun\.org|lovable/i.test(v));
      records.push({
        type: "MX",
        name: domain,
        status: mxValues.length === 0 ? "missing" : hasMailgun ? "pass" : "warn",
        found: mxValues,
        expected: "mxa.mailgun.org / mxb.mailgun.org",
        message:
          mxValues.length === 0
            ? "لا توجد سجلات MX — النطاق لا يستقبل بريداً"
            : hasMailgun
              ? "سجلات MX تشير لـ Mailgun بشكل صحيح"
              : "سجلات MX موجودة لكن ليست لـ Mailgun (قد يكون لمزود بريد آخر)",
      });
    } catch (e) {
      records.push({
        type: "MX",
        name: domain,
        status: "fail",
        found: [],
        expected: "MX records",
        message: `خطأ: ${e instanceof Error ? e.message : "unknown"}`,
      });
    }

    // ---- 3. SPF (TXT على الجذر) ----
    try {
      const txt = await queryDns(domain, "TXT");
      const txts = txt.Answer?.filter((a) => a.type === DNS_TYPE.TXT).map((a) => cleanTxt(a.data)) ?? [];
      const spf = txts.filter((t) => t.startsWith("v=spf1"));
      const hasMailgunSpf = spf.some((s) => /include:mailgun\.org/i.test(s));
      records.push({
        type: "SPF",
        name: domain,
        status:
          spf.length === 0 ? "missing" : hasMailgunSpf ? "pass" : "warn",
        found: spf,
        expected: 'v=spf1 include:mailgun.org ~all',
        message:
          spf.length === 0
            ? "لا يوجد سجل SPF — البريد سيُرفض كـ spam"
            : hasMailgunSpf
              ? "SPF يحتوي include:mailgun.org بشكل صحيح"
              : "SPF موجود لكن لا يتضمن mailgun.org",
      });
    } catch (e) {
      records.push({
        type: "SPF",
        name: domain,
        status: "fail",
        found: [],
        expected: "v=spf1 ...",
        message: `خطأ: ${e instanceof Error ? e.message : "unknown"}`,
      });
    }

    // ---- 4. DKIM (TXT على mailgun._domainkey.<domain> أو k1._domainkey.<domain>) ----
    const dkimSelectors = ["mailgun._domainkey", "k1._domainkey", "smtp._domainkey"];
    let dkimFound = false;
    for (const selector of dkimSelectors) {
      try {
        const dkimQuery = await queryDns(`${selector}.${domain}`, "TXT");
        const dkimTxts =
          dkimQuery.Answer?.filter((a) => a.type === DNS_TYPE.TXT).map((a) => cleanTxt(a.data)) ?? [];
        const validDkim = dkimTxts.filter((t) => /v=DKIM1/i.test(t) || /k=rsa/i.test(t));
        if (validDkim.length > 0) {
          records.push({
            type: "DKIM",
            name: `${selector}.${domain}`,
            status: "pass",
            found: validDkim.map((s) => (s.length > 80 ? s.slice(0, 80) + "…" : s)),
            expected: "k=rsa; p=...",
            message: `DKIM صالح على selector ${selector}`,
          });
          dkimFound = true;
          break;
        }
      } catch {
        // جرّب التالي
      }
    }
    if (!dkimFound) {
      records.push({
        type: "DKIM",
        name: `mailgun._domainkey.${domain}`,
        status: "missing",
        found: [],
        expected: "TXT record بـ k=rsa; p=...",
        message: "لا يوجد DKIM — لن يُوقّع البريد رقمياً (سيدخل spam)",
      });
    }

    // ---- 5. DMARC (TXT على _dmarc.<domain>) ----
    try {
      const dmarcQuery = await queryDns(`_dmarc.${domain}`, "TXT");
      const dmarcTxts =
        dmarcQuery.Answer?.filter((a) => a.type === DNS_TYPE.TXT).map((a) => cleanTxt(a.data)) ?? [];
      const validDmarc = dmarcTxts.filter((t) => t.startsWith("v=DMARC1"));
      records.push({
        type: "DMARC",
        name: `_dmarc.${domain}`,
        status: validDmarc.length > 0 ? "pass" : "missing",
        found: validDmarc,
        expected: "v=DMARC1; p=none; ...",
        message:
          validDmarc.length > 0
            ? "DMARC مُعدّ بشكل صحيح"
            : "لا يوجد DMARC — يُنصح بإضافته لمنع التزوير",
      });
    } catch (e) {
      records.push({
        type: "DMARC",
        name: `_dmarc.${domain}`,
        status: "fail",
        found: [],
        expected: "v=DMARC1; ...",
        message: `خطأ: ${e instanceof Error ? e.message : "unknown"}`,
      });
    }

    // ---- ملخص ----
    const summary = {
      pass: records.filter((r) => r.status === "pass").length,
      warn: records.filter((r) => r.status === "warn").length,
      fail: records.filter((r) => r.status === "fail").length,
      missing: records.filter((r) => r.status === "missing").length,
    };

    const overall: DnsCheckResult["overall"] =
      summary.pass >= 4 && summary.fail === 0 && summary.missing === 0
        ? "ready"
        : summary.pass >= 2
          ? "partial"
          : "not_configured";

    return {
      domain,
      checked_at: new Date().toISOString(),
      overall,
      records,
      summary,
    };
  });
