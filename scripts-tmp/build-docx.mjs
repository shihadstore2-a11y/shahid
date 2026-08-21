import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, BorderStyle, ShadingType, Table, TableRow, TableCell, WidthType, PageOrientation } from "docx";
import { writeFileSync } from "node:fs";

const GREEN = "1A5D3E";
const GREEN_LIGHT = "E8F0EC";
const TEXT = "212121";
const MUTED = "6B6B6B";

function rtl(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: opts.before ?? 60, after: opts.after ?? 60, line: 340 },
    children: [new TextRun({
      text,
      rtl: true,
      font: { name: "Amiri", cs: "Amiri" },
      size: opts.size ?? 22, // half-points (22 = 11pt)
      bold: opts.bold ?? false,
      color: opts.color ?? TEXT,
    })],
  });
}

function h1(text) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 480, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: GREEN, space: 6 } },
    children: [new TextRun({
      text,
      rtl: true,
      font: { name: "Amiri", cs: "Amiri" },
      size: 32,
      bold: true,
      color: GREEN,
    })],
  });
}

function bullet(text) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    numbering: { reference: "rifd-bullets", level: 0 },
    spacing: { before: 60, after: 60, line: 320 },
    children: [new TextRun({
      text,
      rtl: true,
      font: { name: "Amiri", cs: "Amiri" },
      size: 22,
      color: TEXT,
    })],
  });
}

function infoRow(label, value) {
  const cellShading = { fill: GREEN_LIGHT, type: ShadingType.CLEAR, color: "auto" };
  const border = { style: BorderStyle.SINGLE, size: 4, color: "D0D7D3" };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 6480, type: WidthType.DXA },
        borders, shading: cellShading,
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [new Paragraph({
          bidirectional: true, alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: value, rtl: true, font: { name: "Amiri", cs: "Amiri" }, size: 20, color: TEXT })],
        })],
      }),
      new TableCell({
        width: { size: 2880, type: WidthType.DXA },
        borders, shading: { fill: GREEN, type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [new Paragraph({
          bidirectional: true, alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: label, rtl: true, font: { name: "Amiri", cs: "Amiri" }, size: 22, bold: true, color: "FFFFFF" })],
        })],
      }),
    ],
  });
}

function infoTable(rows) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [6480, 2880],
    visuallyRightToLeft: true,
    rows: rows.map(([l, v]) => infoRow(l, v)),
  });
}

// ===== Header banner as a single-row table =====
const headerBanner = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [9360],
  rows: [new TableRow({
    children: [new TableCell({
      width: { size: 9360, type: WidthType.DXA },
      shading: { fill: GREEN, type: ShadingType.CLEAR, color: "auto" },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
      margins: { top: 360, bottom: 360, left: 320, right: 320 },
      children: [
        new Paragraph({
          bidirectional: true, alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "رِفد — منصة التسويق الذكي للمتاجر السعودية", rtl: true, font: { name: "Amiri", cs: "Amiri" }, size: 40, bold: true, color: "FFFFFF" })],
        }),
        new Paragraph({
          bidirectional: true, alignment: AlignmentType.RIGHT,
          spacing: { before: 80 },
          children: [new TextRun({ text: "ملف تعريفي تقني — Technical Brief", rtl: true, font: { name: "Amiri", cs: "Amiri" }, size: 22, color: "E0EBE5" })],
        }),
      ],
    })],
  })],
});

const children = [
  headerBanner,
  new Paragraph({ spacing: { before: 200 }, children: [new TextRun("")] }),

  rtl("ملف موجز للاستخدام في الأبحاث العميقة والمراجعات التقنية والشراكات. يصف هذا المستند منتج رِفد، البنية التقنية، نماذج الذكاء الاصطناعي المستخدمة، طبقات الأمان، ونموذج التشغيل.", { size: 20, color: MUTED }),

  h1("نظرة عامة"),
  rtl("رِفد منصة سعودية متخصصة في توليد محتوى تسويقي احترافي (نصوص، صور، فيديو) لأصحاب المتاجر الإلكترونية، بنبرة سعودية أصيلة ومخرجات جاهزة للنشر الفوري على المنصات الاجتماعية والمتاجر."),
  rtl("نحن لسنا منافساً لأدوات الذكاء الاصطناعي العالمية، بل طبقة محلية ذكية فوقها — نقدم قوالب مهندسة، ذاكرة متجر، وسياق حملات موحّد يضمن اتساق الهوية البصرية والتسويقية لكل متجر.", { color: MUTED }),

  h1("القدرات الأساسية"),
  bullet("استوديو الحملات: مساحة عمل موحدة لإطلاق حملة كاملة (نص + صورة + فيديو) بسياق مشترك للمنتج."),
  bullet("توليد النصوص الإعلانية: أوصاف منتجات، إعلانات سوشال، رسائل واتساب، رسائل بريدية بنبرة سعودية أصيلة."),
  bullet("توليد الصور الإعلانية: صور منتجات بخلفيات احترافية مع الحفاظ على هوية المنتج (لون، شعار، تفاصيل)."),
  bullet("توليد الفيديوهات الترويجية: مقاطع عمودية بنسبة 9:16 جاهزة لـ TikTok و Reels و Snapchat."),
  bullet("ذاكرة المتجر: حفظ الهوية والنبرة والجمهور المستهدف لتخصيص كل توليدة دون تكرار التفاصيل."),
  bullet("مكتبة القوالب: قوالب تسويقية مهندسة مسبقاً لقطاعات (عبايات، عطور، إلكترونيات، هدايا، ديكور، أطفال)."),
  bullet("لوحة تحكم تشغيلية: متابعة الاستهلاك، الفواتير الضريبية، الحصص اليومية، وسجل التوليدات الكامل."),

  h1("البنية التقنية"),
  infoTable([
    ["الواجهة الأمامية", "React 19 + TanStack Start v1 + Vite 7 + Tailwind CSS v4 + TypeScript"],
    ["بيئة التشغيل", "Cloudflare Workers (Edge Runtime) — استجابة سريعة عالمياً وقريبة من المستخدم"],
    ["الواجهة الخلفية", "TanStack Server Functions + Supabase (PostgreSQL + Auth + Storage)"],
    ["قاعدة البيانات", "PostgreSQL مع Row Level Security على كل الجداول الحساسة"],
    ["تخزين الأصول", "Supabase Storage مع Signed URLs لحماية الصور والفيديوهات"],
  ]),

  h1("نماذج الذكاء الاصطناعي"),
  bullet("النصوص: OpenAI GPT-5 / GPT-5-mini و Google Gemini 2.5 Pro / Flash عبر Lovable AI Gateway."),
  bullet("الصور: Google Gemini 3 Pro Image Preview (جودة عالية) و Gemini 3.1 Flash Image Preview (سرعة عالية)."),
  bullet("الفيديو: تكامل مع مزودي توليد الفيديو عبر طبقة موحدة (Provider Abstraction) مع Webhook Callbacks."),
  bullet("التعرف الضوئي على الإيصالات (OCR): معالجة إيصالات التحويل البنكي تلقائياً لتسريع التفعيل."),
  bullet("سياق الحملة الذكي: تمرير صورة المنتج كمرجع بصري إلزامي لضمان اتساق الهوية في كل المخرجات."),

  h1("الأمان والامتثال"),
  bullet("Row Level Security (RLS) على كل جداول قاعدة البيانات مع فصل صارم بين بيانات المستخدمين."),
  bullet("نظام أدوار منفصل (user_roles) باستخدام Security Definer Functions لمنع هجمات Privilege Escalation."),
  bullet("مصادقة عبر Supabase Auth مع دعم Google OAuth وتفعيل البريد الإلكتروني."),
  bullet("فواتير ضريبية إلكترونية متوافقة مع متطلبات هيئة الزكاة والضريبة السعودية (15% VAT)."),
  bullet("تشفير الاتصال عبر HTTPS وإدارة الأسرار عبر Cloudflare Secrets."),
  bullet("سجلات تدقيق (Audit Logs) شاملة لكل العمليات الإدارية الحساسة."),

  h1("نموذج التشغيل التجاري"),
  bullet("اشتراكات شهرية وسنوية بالريال السعودي (Starter / Growth / Pro / Business)."),
  bullet("حصص يومية للتوليد بدلاً من الدفع لكل عملية — تجربة مستخدم مبسطة وتكلفة متوقعة."),
  bullet("تفعيل يدوي بإيصال تحويل بنكي مع OCR تلقائي لتسريع المعالجة."),
  bullet("ضمان استرجاع 14 يوماً للاشتراك الأول."),
  bullet("مسار رِفد للأعمال (Business Track) للحالات المؤسسية الأوسع: تشخيص، تنفيذ، وتأهيل فرق."),

  h1("التواصل"),
  rtl("الموقع الإلكتروني: rifd.site"),
  rtl("البريد: hello@rifd.site"),
  rtl("واتساب الدعم: +966 58 228 6215"),
  rtl("الكيان القانوني: رِفد للتقنية — المملكة العربية السعودية، الرياض"),

  new Paragraph({ spacing: { before: 400 }, children: [new TextRun("")] }),
  new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.CENTER,
    shading: { fill: GREEN, type: ShadingType.CLEAR, color: "auto" },
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: "صُنع في الرياض  —  Built in Riyadh", rtl: true, font: { name: "Amiri", cs: "Amiri" }, size: 24, bold: true, color: "FFFFFF" })],
  }),
];

const doc = new Document({
  creator: "Rifd Technology",
  title: "Rifd — Technical Brief",
  styles: {
    default: {
      document: { run: { font: { name: "Amiri", cs: "Amiri" }, size: 22 } },
    },
  },
  numbering: {
    config: [{
      reference: "rifd-bullets",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "•",
        alignment: AlignmentType.RIGHT,
        style: { paragraph: { indent: { right: 360, hanging: 240 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
      bidi: true,
    },
    children,
  }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync("/mnt/documents/rifd-technical-brief.docx", buffer);
console.log("DOCX OK", buffer.length);
