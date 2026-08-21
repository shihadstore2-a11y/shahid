import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
// @ts-expect-error - no types
import ArabicReshaper from "arabic-reshaper";
import bidiFactory from "bidi-js";
import amiriRegularUrl from "@/assets/fonts/Amiri-Regular.ttf?url";
import amiriBoldUrl from "@/assets/fonts/Amiri-Bold.ttf?url";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Database } from "@/integrations/supabase/types";
import { PLAN_BY_ID, type PlanId } from "@/lib/plan-catalog";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  business: "Business",
};

const CYCLE_LABELS: Record<string, string> = {
  monthly: "شهري",
  yearly: "سنوي",
};

const VAT_RATE = 0.15;
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 50;

const bidi = bidiFactory();

/** يحوّل النص العربي لشكل جاهز للرسم في PDF (تشكيل + عكس visual للـRTL). */
function shapeArabic(text: string): string {
  if (!text) return "";
  // 1) ربط الحروف العربية
  const reshaped = ArabicReshaper.convertArabic(text) as string;
  // 2) للـRTL في pdf-lib: نعكس النص بالكامل (الحروف أصبحت متصلة بشكل visual)
  // لكن نحافظ على الأرقام والكلمات اللاتينية في اتجاهها الصحيح عبر bidi
  const levels = bidi.getEmbeddingLevels(reshaped, "rtl");
  return bidi.getReorderedString(reshaped, levels);
}

function fmtSAR(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDateAr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

function fmtDateGregorian(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function invoiceNumber(requestId: string, activatedAt: string | null): string {
  const year = activatedAt
    ? new Date(activatedAt).getFullYear()
    : new Date().getFullYear();
  const short = requestId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `INV-${year}-${short}`;
}

/** يقرأ ملف خط من الـbundle عبر Node fs. */
function readFontBytes(urlOrPath: string): Uint8Array {
  let fsPath: string;
  if (urlOrPath.startsWith("file://")) {
    fsPath = fileURLToPath(urlOrPath);
  } else if (urlOrPath.startsWith("/")) {
    const clean = urlOrPath.split("?")[0];
    fsPath = process.cwd() + clean;
  } else {
    fsPath = urlOrPath;
  }
  return new Uint8Array(readFileSync(fsPath));
}

export const Route = createFileRoute("/api/invoice/$requestId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            return new Response(
              JSON.stringify({ error: "server misconfigured" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          // التحقق من التوكن
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          const token = authHeader.slice(7);

          const supabase = createClient<Database>(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            {
              global: { headers: { Authorization: `Bearer ${token}` } },
              auth: {
                storage: undefined,
                persistSession: false,
                autoRefreshToken: false,
              },
            }
          );

          // التحقق أن المستخدم admin
          const { data: claimsData } = await supabase.auth.getClaims(token);
          const userId = claimsData?.claims?.sub;
          if (!userId) {
            return new Response(JSON.stringify({ error: "invalid token" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          const { data: roleRow } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();
          if (!roleRow) {
            return new Response(JSON.stringify({ error: "forbidden" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          // جلب الطلب — RLS يسمح للأدمن
          const { data: req, error: reqErr } = await supabase
            .from("subscription_requests")
            .select("*")
            .eq("id", params.requestId)
            .maybeSingle();

          if (reqErr || !req) {
            return new Response(
              JSON.stringify({ error: "request not found" }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          if (req.status !== "activated") {
            return new Response(
              JSON.stringify({
                error: "invoice available only for activated requests",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // جلب إعدادات التطبيق (whatsapp) + بيانات البنك (اسم الحساب البائع)
          const [appRes, payRes] = await Promise.all([
            supabase
              .from("app_settings")
              .select("whatsapp_number")
              .eq("id", 1)
              .maybeSingle(),
            supabase
              .from("payment_settings")
              .select("bank_account_holder")
              .eq("id", 1)
              .maybeSingle(),
          ]);

          const sellerName = payRes.data?.bank_account_holder || "رِفد للتقنية";
          const sellerWhatsapp = appRes.data?.whatsapp_number || "";

          // الأسعار
          const planKey = req.plan as "starter" | "growth" | "pro" | "business";
          const cycle = req.billing_cycle === "yearly" ? "yearly" : "monthly";
          const planInfo = PLAN_BY_ID[planKey as PlanId];
          const subtotal = cycle === "yearly" ? planInfo?.yearlyPriceSar ?? 0 : planInfo?.monthlyPriceSar ?? 0;
          const vat = subtotal * VAT_RATE;
          const total = subtotal + vat;

          const invNo = invoiceNumber(req.id, req.activated_at);
          const issueDate = fmtDateGregorian(req.activated_at);
          const issueDateAr = fmtDateAr(req.activated_at);

          // ====== بناء PDF ======
          const pdfDoc = await PDFDocument.create();
          pdfDoc.registerFontkit(fontkit);

          const regBytes = readFontBytes(amiriRegularUrl);
          const boldBytes = readFontBytes(amiriBoldUrl);
          const fontReg = await pdfDoc.embedFont(regBytes, { subset: false });
          const fontBold = await pdfDoc.embedFont(boldBytes, { subset: false });

          const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

          const colorPrimary = rgb(0.102, 0.365, 0.243); // #1A5D3E (brand green)
          const colorText = rgb(0.13, 0.13, 0.13);
          const colorMuted = rgb(0.45, 0.45, 0.45);
          const colorBorder = rgb(0.85, 0.85, 0.85);
          const colorAccentBg = rgb(0.95, 0.97, 0.96);

          // helper: نص محاذي يمين (RTL)
          function drawTextRight(
            text: string,
            yFromTop: number,
            opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; rightX?: number } = {}
          ) {
            const size = opts.size ?? 11;
            const font = opts.bold ? fontBold : fontReg;
            const color = opts.color ?? colorText;
            const rightX = opts.rightX ?? PAGE_W - MARGIN;
            const shaped = shapeArabic(text);
            const w = font.widthOfTextAtSize(shaped, size);
            page.drawText(shaped, {
              x: rightX - w,
              y: PAGE_H - yFromTop,
              size,
              font,
              color,
            });
          }

          function drawTextLeft(
            text: string,
            yFromTop: number,
            opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; leftX?: number } = {}
          ) {
            const size = opts.size ?? 11;
            const font = opts.bold ? fontBold : fontReg;
            const color = opts.color ?? colorText;
            const leftX = opts.leftX ?? MARGIN;
            // النصوص اللاتينية/الأرقام لا تحتاج تشكيل
            page.drawText(text, {
              x: leftX,
              y: PAGE_H - yFromTop,
              size,
              font,
              color,
            });
          }

          function drawLine(yFromTop: number, color = colorBorder) {
            page.drawLine({
              start: { x: MARGIN, y: PAGE_H - yFromTop },
              end: { x: PAGE_W - MARGIN, y: PAGE_H - yFromTop },
              thickness: 0.6,
              color,
            });
          }

          // === الترويسة ===
          // شريط علوي ملوّن
          page.drawRectangle({
            x: 0,
            y: PAGE_H - 90,
            width: PAGE_W,
            height: 90,
            color: colorPrimary,
          });

          drawTextRight("فاتورة ضريبية", 40, {
            size: 24,
            bold: true,
            color: rgb(1, 1, 1),
          });
          drawTextRight("Tax Invoice", 65, {
            size: 11,
            color: rgb(0.9, 0.95, 0.92),
          });

          drawTextLeft("رِفد", 38, {
            size: 22,
            bold: true,
            color: rgb(1, 1, 1),
          });
          drawTextLeft("Refd Platform", 60, {
            size: 10,
            color: rgb(0.9, 0.95, 0.92),
          });

          // === معلومات الفاتورة ===
          let y = 130;
          drawTextRight(`رقم الفاتورة:`, y, { bold: true, size: 11 });
          drawTextRight(invNo, y, { rightX: PAGE_W - MARGIN - 110, size: 11 });

          y += 20;
          drawTextRight(`تاريخ الإصدار:`, y, { bold: true, size: 11 });
          drawTextRight(`${issueDate}  ·  ${issueDateAr}`, y, {
            rightX: PAGE_W - MARGIN - 110,
            size: 11,
          });

          // === البائع / المشتري ===
          y = 200;
          drawLine(y - 10);
          drawTextRight("الـبـائـع", y, { bold: true, size: 13, color: colorPrimary });
          drawTextLeft("Seller", y, { bold: true, size: 11, color: colorMuted });

          y += 20;
          drawTextRight(sellerName, y, { size: 11 });
          if (sellerWhatsapp) {
            y += 16;
            drawTextRight(`واتساب: ${sellerWhatsapp}`, y, { size: 10, color: colorMuted });
          }

          y += 30;
          drawLine(y - 10);
          drawTextRight("الـعـمـيـل", y, { bold: true, size: 13, color: colorPrimary });
          drawTextLeft("Customer", y, { bold: true, size: 11, color: colorMuted });

          y += 20;
          drawTextRight(req.store_name || "—", y, { size: 11, bold: true });
          y += 16;
          drawTextRight(`البريد: ${req.email}`, y, { size: 10, color: colorMuted });
          y += 16;
          drawTextRight(`واتساب: ${req.whatsapp}`, y, { size: 10, color: colorMuted });

          // === تفاصيل البند ===
          y += 40;
          drawLine(y - 10);
          drawTextRight("تـفـاصـيـل الاشـتـراك", y, {
            bold: true,
            size: 13,
            color: colorPrimary,
          });

          y += 25;
          // header row
          page.drawRectangle({
            x: MARGIN,
            y: PAGE_H - y - 5,
            width: PAGE_W - MARGIN * 2,
            height: 28,
            color: colorAccentBg,
          });
          drawTextRight("الـوصـف", y + 12, { bold: true, size: 11, rightX: PAGE_W - MARGIN - 10 });
          drawTextLeft("المبلغ (ر.س)", y + 12, {
            bold: true,
            size: 11,
            leftX: MARGIN + 10,
          });

          y += 45;
          const planLabel = PLAN_LABELS[planKey] ?? planKey;
          const cycleLabel = CYCLE_LABELS[cycle] ?? cycle;
          drawTextRight(`اشتراك باقة ${planLabel} - ${cycleLabel}`, y, {
            size: 11,
            rightX: PAGE_W - MARGIN - 10,
          });
          drawTextLeft(fmtSAR(subtotal), y, { size: 11, leftX: MARGIN + 10 });

          y += 25;
          drawLine(y - 8);

          // === الإجمالي ===
          y += 20;
          const totalsRightX = PAGE_W - MARGIN - 10;
          const totalsLabelX = MARGIN + 200;

          drawTextRight("المجموع قبل الضريبة:", y, {
            size: 11,
            color: colorMuted,
            rightX: totalsRightX,
          });
          drawTextLeft(`${fmtSAR(subtotal)} ر.س`, y, {
            size: 11,
            color: colorMuted,
            leftX: totalsLabelX,
          });

          y += 22;
          drawTextRight("ضريبة القيمة المضافة (15%):", y, {
            size: 11,
            color: colorMuted,
            rightX: totalsRightX,
          });
          drawTextLeft(`${fmtSAR(vat)} ر.س`, y, {
            size: 11,
            color: colorMuted,
            leftX: totalsLabelX,
          });

          y += 30;
          // مربع الإجمالي
          page.drawRectangle({
            x: totalsLabelX - 20,
            y: PAGE_H - y - 8,
            width: PAGE_W - MARGIN - (totalsLabelX - 20),
            height: 32,
            color: colorPrimary,
          });
          drawTextRight("الإجمـالي المسـتحق:", y + 12, {
            size: 13,
            bold: true,
            color: rgb(1, 1, 1),
            rightX: totalsRightX,
          });
          drawTextLeft(`${fmtSAR(total)} ر.س`, y + 12, {
            size: 13,
            bold: true,
            color: rgb(1, 1, 1),
            leftX: totalsLabelX,
          });

          // === تذييل ===
          drawLine(PAGE_H - 100);
          drawTextRight("شكراً لاختيارك رِفد ❤", PAGE_H - 80, {
            size: 11,
            bold: true,
            color: colorPrimary,
          });
          drawTextRight("هذه الفاتورة تم إصدارها إلكترونياً ولا تحتاج إلى توقيع.", PAGE_H - 60, {
            size: 9,
            color: colorMuted,
          });
          drawTextLeft(`Invoice ${invNo}`, PAGE_H - 60, {
            size: 8,
            color: colorMuted,
          });

          const pdfBytes = await pdfDoc.save();

          return new Response(new Uint8Array(pdfBytes) as unknown as BodyInit, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${invNo}.pdf"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (err) {
          console.error("invoice error:", err);
          return new Response(
            JSON.stringify({
              error: err instanceof Error ? err.message : "unknown error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
