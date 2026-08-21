import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import ArabicReshaper from "arabic-reshaper";
import bidiFactory from "bidi-js";
import { readFileSync, writeFileSync } from "node:fs";

const bidi = bidiFactory();
function shape(text) {
  if (!text) return "";
  const reshaped = ArabicReshaper.convertArabic(text);
  const levels = bidi.getEmbeddingLevels(reshaped, "rtl");
  return bidi.getReorderedString(reshaped, levels);
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;

const reg = readFileSync("/dev-server/src/assets/fonts/Amiri-Regular.ttf");
const bold = readFileSync("/dev-server/src/assets/fonts/Amiri-Bold.ttf");

const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
const fReg = await pdf.embedFont(reg, { subset: false });
const fBold = await pdf.embedFont(bold, { subset: false });

const GREEN = rgb(0.102, 0.365, 0.243);
const GREEN_LIGHT = rgb(0.95, 0.97, 0.96);
const TEXT = rgb(0.13, 0.13, 0.13);
const MUTED = rgb(0.42, 0.42, 0.42);
const BORDER = rgb(0.85, 0.85, 0.85);
const WHITE = rgb(1, 1, 1);

let page = pdf.addPage([PAGE_W, PAGE_H]);
let cursorY = PAGE_H - MARGIN;

function newPage() {
  page = pdf.addPage([PAGE_W, PAGE_H]);
  cursorY = PAGE_H - MARGIN;
  drawFooter();
}
function ensure(space) {
  if (cursorY - space < MARGIN + 30) newPage();
}

function drawFooter() {
  const txt = shape("رِفد للتقنية — rifd.site");
  const w = fReg.widthOfTextAtSize(txt, 8);
  page.drawText(txt, { x: PAGE_W - MARGIN - w, y: 25, size: 8, font: fReg, color: MUTED });
  page.drawText("Rifd Technology", { x: MARGIN, y: 25, size: 8, font: fReg, color: MUTED });
}

function drawRTL(text, opts = {}) {
  const size = opts.size ?? 11;
  const font = opts.bold ? fBold : fReg;
  const color = opts.color ?? TEXT;
  const rightX = opts.rightX ?? PAGE_W - MARGIN;
  const maxWidth = opts.maxWidth ?? PAGE_W - MARGIN * 2;
  const lineHeight = opts.lineHeight ?? size * 1.7;

  // word wrap
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    const shaped = shape(trial);
    if (font.widthOfTextAtSize(shaped, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);

  for (const line of lines) {
    ensure(lineHeight);
    const shaped = shape(line);
    const w = font.widthOfTextAtSize(shaped, size);
    page.drawText(shaped, { x: rightX - w, y: cursorY - size, size, font, color });
    cursorY -= lineHeight;
  }
}

function drawHeaderBar(title, subtitle) {
  page.drawRectangle({ x: 0, y: PAGE_H - 90, width: PAGE_W, height: 90, color: GREEN });
  const t = shape(title);
  const tw = fBold.widthOfTextAtSize(t, 22);
  page.drawText(t, { x: PAGE_W - MARGIN - tw, y: PAGE_H - 50, size: 22, font: fBold, color: WHITE });
  if (subtitle) {
    const s = shape(subtitle);
    const sw = fReg.widthOfTextAtSize(s, 11);
    page.drawText(s, { x: PAGE_W - MARGIN - sw, y: PAGE_H - 72, size: 11, font: fReg, color: rgb(0.9, 0.95, 0.92) });
  }
  page.drawText("Rifd", { x: MARGIN, y: PAGE_H - 50, size: 22, font: fBold, color: WHITE });
  page.drawText("AI Marketing Platform", { x: MARGIN, y: PAGE_H - 72, size: 10, font: fReg, color: rgb(0.9, 0.95, 0.92) });
  cursorY = PAGE_H - 110;
}

function section(title) {
  ensure(50);
  cursorY -= 8;
  page.drawRectangle({ x: MARGIN, y: cursorY - 22, width: 4, height: 22, color: GREEN });
  const t = shape(title);
  const tw = fBold.widthOfTextAtSize(t, 15);
  page.drawText(t, { x: PAGE_W - MARGIN - tw, y: cursorY - 17, size: 15, font: fBold, color: GREEN });
  cursorY -= 32;
}

function bullet(text) {
  ensure(20);
  // dot
  page.drawCircle({ x: PAGE_W - MARGIN - 4, y: cursorY - 6, size: 2, color: GREEN });
  drawRTL(text, { size: 10.5, rightX: PAGE_W - MARGIN - 14, maxWidth: PAGE_W - MARGIN * 2 - 14, lineHeight: 16 });
  cursorY -= 2;
}

function infoBox(label, value) {
  ensure(40);
  page.drawRectangle({ x: MARGIN, y: cursorY - 36, width: PAGE_W - MARGIN * 2, height: 36, color: GREEN_LIGHT, borderColor: BORDER, borderWidth: 0.5 });
  const l = shape(label);
  const lw = fBold.widthOfTextAtSize(l, 10);
  page.drawText(l, { x: PAGE_W - MARGIN - 10 - lw, y: cursorY - 14, size: 10, font: fBold, color: GREEN });
  const v = shape(value);
  const vw = fReg.widthOfTextAtSize(v, 9.5);
  page.drawText(v, { x: PAGE_W - MARGIN - 10 - vw, y: cursorY - 28, size: 9.5, font: fReg, color: TEXT });
  cursorY -= 44;
}

// ============ المحتوى ============
drawHeaderBar("رِفد — منصة التسويق الذكي للمتاجر السعودية", "ملف تعريفي تقني — Technical Brief");
drawFooter();

cursorY -= 6;
drawRTL("ملف موجز للاستخدام في الأبحاث العميقة والمراجعات التقنية والشراكات. يصف هذا المستند منتج رِفد، البنية التقنية، نماذج الذكاء الاصطناعي المستخدمة، طبقات الأمان، ونموذج التشغيل.", { size: 10, color: MUTED, lineHeight: 16 });

section("نظرة عامة");
drawRTL("رِفد منصة سعودية متخصصة في توليد محتوى تسويقي احترافي (نصوص، صور، فيديو) لأصحاب المتاجر الإلكترونية، بنبرة سعودية أصيلة ومخرجات جاهزة للنشر الفوري على المنصات الاجتماعية والمتاجر.");
drawRTL("نحن لسنا منافساً لأدوات الذكاء الاصطناعي العالمية، بل طبقة محلية ذكية فوقها — نقدم قوالب مهندسة، ذاكرة متجر، وسياق حملات موحّد يضمن اتساق الهوية البصرية والتسويقية.", { color: MUTED });

section("القدرات الأساسية");
bullet("استوديو الحملات: مساحة عمل موحدة لإطلاق حملة كاملة (نص + صورة + فيديو) بسياق مشترك للمنتج.");
bullet("توليد النصوص الإعلانية: أوصاف منتجات، إعلانات سوشال، رسائل واتساب، رسائل بريدية بنبرة سعودية.");
bullet("توليد الصور الإعلانية: صور منتجات بخلفيات احترافية مع الحفاظ على هوية المنتج (لون، شعار، تفاصيل).");
bullet("توليد الفيديوهات الترويجية: مقاطع عمودية 9:16 جاهزة لـTikTok وReels وSnapchat.");
bullet("ذاكرة المتجر: حفظ الهوية والنبرة والجمهور المستهدف لتخصيص كل توليدة دون تكرار التفاصيل.");
bullet("مكتبة القوالب: قوالب تسويقية مهندسة مسبقاً لقطاعات (عبايات، عطور، إلكترونيات، هدايا، ديكور، أطفال).");
bullet("لوحة تحكم تشغيلية: متابعة الاستهلاك، الفواتير الضريبية، الحصص اليومية، وسجل التوليدات.");

section("البنية التقنية");
infoBox("الواجهة الأمامية (Frontend)", "React 19 + TanStack Start v1 + Vite 7 + Tailwind CSS v4 + TypeScript");
infoBox("التشغيل (Runtime)", "Cloudflare Workers (Edge Runtime) — استجابة سريعة عالمياً");
infoBox("الواجهة الخلفية (Backend)", "TanStack Server Functions + Supabase (PostgreSQL + Auth + Storage + RLS)");
infoBox("التخزين والملفات", "Supabase Storage مع Signed URLs لحماية الأصول الإعلانية");
infoBox("قاعدة البيانات", "PostgreSQL مع Row Level Security على كل الجداول الحساسة");

section("نماذج الذكاء الاصطناعي");
bullet("النصوص: OpenAI GPT-5 / GPT-5-mini و Google Gemini 2.5 Pro / Flash عبر Lovable AI Gateway.");
bullet("الصور: Google Gemini 3 Pro Image Preview (جودة عالية) و Gemini 3.1 Flash Image Preview (سرعة عالية).");
bullet("الفيديو: تكامل مع مزودي توليد الفيديو عبر طبقة موحدة (Provider Abstraction) مع Webhook Callbacks.");
bullet("التعرف الضوئي على الإيصالات: OCR لمعالجة إيصالات التحويل البنكي تلقائياً.");
bullet("سياق الحملة الذكي: تمرير صورة المنتج كمرجع بصري إلزامي لضمان اتساق الهوية في كل المخرجات.");

section("الأمان والامتثال");
bullet("Row Level Security (RLS) على كل جداول قاعدة البيانات مع فصل صارم بين بيانات المستخدمين.");
bullet("نظام أدوار منفصل (user_roles) باستخدام Security Definer Functions لمنع هجمات Privilege Escalation.");
bullet("مصادقة عبر Supabase Auth مع دعم Google OAuth وتفعيل البريد الإلكتروني.");
bullet("فواتير ضريبية إلكترونية متوافقة مع متطلبات الزكاة والضريبة السعودية (15% VAT).");
bullet("تشفير الاتصال عبر HTTPS وإدارة الأسرار عبر Cloudflare Secrets.");
bullet("سجلات تدقيق (Audit Logs) لكل العمليات الإدارية الحساسة.");

section("نموذج التشغيل التجاري");
bullet("اشتراكات شهرية وسنوية بالريال السعودي (Starter / Growth / Pro / Business).");
bullet("حصص يومية للتوليد بدلاً من الدفع لكل عملية — تجربة مستخدم مبسطة وتكلفة متوقعة.");
bullet("تفعيل يدوي بإيصال تحويل بنكي مع OCR تلقائي لتسريع المعالجة.");
bullet("ضمان استرجاع 14 يوماً للاشتراك الأول.");
bullet("مسار رِفد للأعمال (Business Track) للحالات المؤسسية الأوسع: تشخيص، تنفيذ، وتأهيل فرق.");

section("التواصل");
drawRTL("الموقع: rifd.site");
drawRTL("البريد: hello@rifd.site");
drawRTL("واتساب الدعم: ‎+966 58 228 6215");
drawRTL("الكيان القانوني: رِفد للتقنية — المملكة العربية السعودية، الرياض");

cursorY -= 10;
ensure(40);
page.drawRectangle({ x: MARGIN, y: cursorY - 30, width: PAGE_W - MARGIN * 2, height: 30, color: GREEN });
const tail = shape("صُنع في الرياض — Built in Riyadh");
const tw = fBold.widthOfTextAtSize(tail, 12);
page.drawText(tail, { x: (PAGE_W - tw) / 2, y: cursorY - 20, size: 12, font: fBold, color: WHITE });

const bytes = await pdf.save();
writeFileSync("/mnt/documents/rifd-technical-brief.pdf", bytes);
console.log("OK", bytes.length);
