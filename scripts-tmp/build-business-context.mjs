import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, BorderStyle, ShadingType, Table, TableRow, TableCell, WidthType, PageBreak } from "docx";
import { writeFileSync } from "node:fs";

const GREEN = "1A5D3E";
const GREEN_LIGHT = "E8F0EC";
const GOLD = "B8860B";
const TEXT = "1F2937";
const MUTED = "6B7280";
const RED = "B91C1C";
const FONT = { name: "Amiri", cs: "Amiri" };

function p(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.RIGHT,
    spacing: { before: opts.before ?? 60, after: opts.after ?? 60, line: 360 },
    indent: opts.indent,
    children: [new TextRun({
      text, rtl: true, font: FONT,
      size: opts.size ?? 22,
      bold: opts.bold ?? false,
      italics: opts.italic ?? false,
      color: opts.color ?? TEXT,
    })],
  });
}

function h1(text) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 480, after: 220 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: GREEN, space: 6 } },
    children: [new TextRun({ text, rtl: true, font: FONT, size: 36, bold: true, color: GREEN })],
  });
}

function h2(text) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 320, after: 140 },
    children: [new TextRun({ text, rtl: true, font: FONT, size: 28, bold: true, color: GREEN })],
  });
}

function h3(text) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 220, after: 100 },
    children: [new TextRun({ text, rtl: true, font: FONT, size: 24, bold: true, color: TEXT })],
  });
}

function bullet(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 40, after: 40, line: 340 },
    numbering: { reference: "bullets", level: 0 },
    children: [new TextRun({
      text, rtl: true, font: FONT,
      size: 22, bold: opts.bold ?? false,
      color: opts.color ?? TEXT,
    })],
  });
}

function callout(text, color = GREEN) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 200, after: 200, line: 360 },
    shading: { type: ShadingType.CLEAR, fill: GREEN_LIGHT },
    border: {
      right: { style: BorderStyle.SINGLE, size: 24, color, space: 8 },
    },
    indent: { right: 200, left: 200 },
    children: [new TextRun({ text, rtl: true, font: FONT, size: 22, bold: true, color })],
  });
}

function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

function kvRow(k, v) {
  const cell = (text, bold, fill) => new TableCell({
    width: { size: 4500, type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [new Paragraph({
      bidirectional: true, alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text, rtl: true, font: FONT, size: 22, bold, color: TEXT })],
    })],
  });
  return new TableRow({ children: [cell(v, false), cell(k, true, GREEN_LIGHT)] });
}

function kvTable(rows) {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [4500, 4500],
    rows: rows.map(([k, v]) => kvRow(k, v)),
  });
}

function cover() {
  return [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER, bidirectional: true,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "رِفْد", rtl: true, font: FONT, size: 96, bold: true, color: GREEN })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, bidirectional: true,
      spacing: { after: 100 },
      children: [new TextRun({ text: "حزمة سياق المنتج وتجربة المستخدم", rtl: true, font: FONT, size: 32, bold: true, color: TEXT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, bidirectional: true,
      spacing: { after: 600 },
      children: [new TextRun({ text: "للمراجعة العميقة عبر Claude Max", rtl: true, font: FONT, size: 26, color: MUTED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, bidirectional: true,
      shading: { type: ShadingType.CLEAR, fill: GREEN_LIGHT },
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "وثيقة سياقية شاملة • التركيز: تجربة المستخدم ومنطق الأعمال", rtl: true, font: FONT, size: 22, bold: true, color: GREEN })],
    }),
    new Paragraph({ spacing: { before: 1600 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER, bidirectional: true,
      children: [new TextRun({ text: "أعدّ لـ Claude بهدف: تشخيص رحلة المستخدم، تقييم منطق الحصص والفوترة،", rtl: true, font: FONT, size: 20, color: MUTED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, bidirectional: true,
      children: [new TextRun({ text: "ومراجعة لغة المنتج وأثرها على معدلات التحويل.", rtl: true, font: FONT, size: 20, color: MUTED })],
    }),
    new Paragraph({ spacing: { before: 1200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "rifd.site", font: FONT, size: 24, bold: true, color: GREEN })],
    }),
    pageBreak(),
  ];
}

function sectionA() {
  return [
    h1("القسم أ — هوية المنتج"),

    h2("ما هي رِفْد؟"),
    p("منصّة سعودية متخصّصة في التسويق المدفوع بالذكاء الاصطناعي لتجار التجزئة عبر الإنترنت. توفّر رِفْد ثلاث قدرات أساسية: توليد نصوص إعلانية تبيع، تصميم صور إعلانات احترافية، وإنتاج فيديوهات إعلانية قصيرة — كل ذلك مع فهم عميق لهوية المتجر، منتجاته، وجمهوره المستهدف."),

    p("القيمة الأساسية: نقل التاجر السعودي من \"كتابة محتوى تسويقي عام\" إلى \"إنتاج محتوى تجاري مُحوِّل\" خلال دقائق، بتكلفة جزء يسير من توظيف وكالة إعلانية أو مصمم متفرّغ."),

    h2("الجمهور المستهدف"),
    bullet("تجار التجزئة الإلكترونية في السوق السعودي (سلة، زد، شوبيفاي، WooCommerce)."),
    bullet("القطاعات الأولوية: العباءات والأزياء، العطور والتجميل، الإلكترونيات والإكسسوارات، الهدايا والحلويات والقهوة، ديكور المنزل، منتجات الأطفال."),
    bullet("صاحب المتجر الذي يدير حملاته بنفسه (Solo founder) أو فريق صغير من 1-3 أشخاص."),
    bullet("ميزانية تسويق محدودة (5,000 - 50,000 ريال شهرياً)، حسّاسة للسعر، تبحث عن ROI واضح."),

    h2("لغة المنتج الموحّدة"),
    callout("القاعدة الذهبية: لا نقول \"اكتب محتوى\"، بل نقول \"اكتب نصاً يبيع\". لا نقول \"أنشئ صورة\"، بل نقول \"صمّم صورة إعلان\"."),
    p("هذه الصياغة ليست تجميلاً لغوياً، بل قرار منتج: المستخدم لا يريد أداة كتابة عامة، بل أداة تحويل (conversion). كل CTA، كل عنوان، كل نص في الواجهة يجب أن يعكس هذه النيّة التجارية المباشرة."),
    h3("أمثلة محظورة في الواجهة"),
    bullet("\"أنشئ منشوراً\" → الصواب: \"اكتب نصاً يبيع\".", { color: RED }),
    bullet("\"ولّد صورة\" → الصواب: \"صمّم صورة إعلان\".", { color: RED }),
    bullet("\"محتوى عام\" → الصواب: \"محتوى يبيع منتجك\".", { color: RED }),
    bullet("\"AI-powered\" بالإنجليزية → نتجنّبها لصالح \"مدعومة بالذكاء الاصطناعي\".", { color: RED }),

    h2("التمايز التنافسي"),
    h3("ضد ChatGPT / المساعدات العامة"),
    bullet("رِفْد تعرف منتج المتجر، جمهوره، نبرته (Store Memory) — لا يحتاج التاجر لشرح السياق في كل محادثة."),
    bullet("القوالب جاهزة لقطاعات سعودية محددة، بعربية فصيحة وعامية متوازنة."),
    bullet("صور إعلانات بمراجع بصرية حقيقية للمنتج (لا اختراع وهمي)."),

    h3("ضد الوكالات الإعلانية"),
    bullet("التكلفة: من 99 ريال/شهر مقابل 3,000-15,000 ريال لباقة وكالة."),
    bullet("السرعة: محتوى جاهز في 30 ثانية مقابل 3-5 أيام."),
    bullet("التحكم: التاجر يولّد متى شاء بدون اجتماعات أو موافقات."),

    h3("ضد منصات SaaS الغربية (Jasper, Copy.ai)"),
    bullet("اللغة العربية أصلية وليست ترجمة آلية."),
    bullet("فهم السياق السعودي: العملة، المواسم (رمضان، اليوم الوطني)، اللهجات، القنوات المحلية (سناب، تيك توك السعودي)."),
    bullet("الدفع بطرق محلية (تحويل بنكي + OCR للحوالات، STC Pay، فاتورة ضريبية سعودية)."),

    pageBreak(),
  ];
}

function sectionB() {
  return [
    h1("القسم ب — رحلة المستخدم الكاملة"),

    h2("الخريطة العامة"),
    p("التسجيل ← التحقق من البريد ← Onboarding (3 خطوات) ← ملء بيانات المتجر ← أوّل توليد ← (محفّز ترقية تلقائي عند ملامسة الحصة) ← شراء باقة ← استخدام يومي."),

    h2("المرحلة 1: التسجيل والمصادقة"),
    h3("الطرق المتاحة"),
    bullet("بريد إلكتروني + كلمة مرور (مع تأكيد بريد إلزامي)."),
    bullet("Google OAuth (تسجيل بنقرة واحدة)."),
    bullet("لا يوجد دخول بدون حساب — رفضنا anonymous sign-ups لمنع الاستهلاك المجهول."),
    h3("نقاط احتكاك مرصودة"),
    bullet("بعض المستخدمين يضعون أرقام جوّال غير سعودية → الـ trigger normalize_profile_whatsapp يرفض ويُلزم صيغة 9665XXXXXXXX.", { color: RED }),
    bullet("المستخدمون يصلون بريد التأكيد أحياناً في spam → نحتاج تحسين سمعة نطاق rifd.site (DKIM/SPF/DMARC)."),

    h2("المرحلة 2: Onboarding (3 خطوات)"),
    p("الهدف: جمع الحد الأدنى لإنتاج محتوى ذي صلة دون إرهاق المستخدم."),
    h3("الخطوة 1 — معلومات المتجر"),
    bullet("اسم المتجر، الفئة (dropdown)، رابط المتجر، اللهجة المفضّلة (فصحى/سعودية)."),
    h3("الخطوة 2 — هوية بصرية"),
    bullet("لون رئيسي (color picker)، شعار اختياري."),
    h3("الخطوة 3 — أوّل منتج"),
    bullet("اسم المنتج، صورته، السعر، الجمهور المستهدف."),
    callout("قرار منتج: نُقدّم \"تخطّي\" في الخطوتين 2 و 3 لتقليل التسرّب، لكن نشجّع الإكمال بـ Success Pack مرئي عند الانتهاء."),

    h2("المرحلة 3: أوّل توليد"),
    p("النقطة الأهم في رحلة العميل. القاعدة: يجب أن ينتج التاجر شيئاً يفخر به في أوّل 5 دقائق."),
    h3("التدفق المُحسَّن"),
    bullet("بعد Onboarding مباشرة، يُوجَّه المستخدم لـ Campaign Studio بسياق ممتلئ تلقائياً (المنتج + الهدف + القناة)."),
    bullet("توليد نص + صورة في حملة واحدة لإظهار قيمة المنصة المركّبة."),
    bullet("إذا فشل التوليد لأي سبب (حصة، شبكة، AI error) — نعرض Quota Exceeded Dialog أو خطأ صديق بدل صفحة عامة."),

    h2("المرحلة 4: محفّز الترقية"),
    h3("Free plan limits"),
    bullet("10 نصوص/يوم، 2 صور/يوم — كافٍ للتجربة، غير كافٍ للاستخدام اليومي."),
    bullet("لا فيديو، لا صور Pro، لا Campaign Studio متقدّم."),
    h3("اللحظات الذهبية للترقية"),
    bullet("عند ملامسة الحصة اليومية: نعرض Dialog يُذكّر بالقيمة + CTA لباقة Starter (99 ريال)."),
    bullet("بعد التوليد العاشر: تنبيه ناعم بأن \"المحترفين يستخدمون 50+ توليد يومياً\"."),
    bullet("عند محاولة استخدام صور Pro: نعرض الفرق المرئي بين Flash و Pro."),

    h2("المرحلة 5: الاستخدام اليومي والاحتفاظ"),
    bullet("Library: كل توليد محفوظ، قابل للبحث، تصدير، إعادة استخدام."),
    bullet("Campaign Packs: حزم حملات قابلة لإعادة الإنتاج (نفس المنتج، عدة قنوات)."),
    bullet("إيميلات Onboarding (يوم 1، 3، 5، 7) لتذكير المستخدم بقدرات لم يجرّبها."),
    bullet("Subscription expiring email قبل 7 أيام لتقليل churn."),

    pageBreak(),
  ];
}

function sectionC() {
  return [
    h1("القسم ج — منطق الحصص والفوترة"),

    h2("الفلسفة الأساسية"),
    callout("النقاط للفيديو فقط. النصوص والصور بحصص يومية. السبب: الفيديو مكلف وغير قابل للتنبؤ، أما النص والصورة فيمكن تقديمهما بسقف يومي عادل دون تعقيد محاسبي للمستخدم."),

    h2("نظام الحصص اليومية (نصوص + صور)"),
    p("التطبيق التقني: جدول daily_text_usage يحفظ text_count و image_count لكل user_id لكل يوم بتوقيت الرياض. التجديد تلقائي عند منتصف الليل بتوقيت آسيا/الرياض."),
    h3("لماذا حصص يومية وليس شهرية؟"),
    bullet("منع \"الحرق\" في أوّل 3 أيام من الشهر."),
    bullet("توزيع الحمل على Lovable AI Gateway بشكل منتظم."),
    bullet("تجربة \"تجدّد الفرص\" يومياً تخلق عادة استخدام يومية (Daily Habit Loop)."),
    h3("السقوف لكل باقة"),
    new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }),
    kvTable([
      ["باقة Free", "10 نصوص + 2 صور Flash يومياً"],
      ["باقة Starter (99 ر.س/شهر)", "30 نص + 10 صور Flash يومياً"],
      ["باقة Growth (249 ر.س/شهر)", "100 نص + 30 صورة (Flash + Pro) يومياً"],
      ["باقة Pro (499 ر.س/شهر)", "حصص موسّعة + فيديو + أولوية"],
    ]),

    h2("نظام نقاط الفيديو"),
    p("الفيديو يستهلك نقاطاً (credits) لأن تكلفته الحقيقية تتراوح بين 0.10$ و 2.00$ للفيديو الواحد حسب المدة والجودة."),
    h3("مصدر النقاط"),
    bullet("plan_credits: تُمنح شهرياً مع كل تجديد باقة (تنتهي مع الدورة)."),
    bullet("topup_credits: شراء إضافي، لا تنتهي صلاحيتها (تتراكم)."),
    h3("الأولوية في الاستهلاك"),
    bullet("نخصم من plan_credits أولاً لتجنّب فقدانها عند التجديد."),
    bullet("ثم من topup_credits."),
    bullet("Refund تلقائي عند فشل توليد الفيديو (function refund_credits)."),

    h2("تدفق الفوترة"),
    h3("المسار المعتمد: تحويل بنكي + OCR"),
    p("لماذا ليس بطاقة ائتمان مباشرة؟ السوق السعودي يفضّل التحويل البنكي + الفاتورة الضريبية الرسمية. أيضاً نتجنّب رسوم بوّابات الدفع (2.5%-3%) في المرحلة الأولى."),
    bullet("المستخدم يختار باقة → يصدر طلب اشتراك (subscription_request) بحالة pending."),
    bullet("يُرسَل تلقائياً إشعار Telegram للأدمن عبر notify_admin_on_subscription_request."),
    bullet("يحوّل المستخدم بنكياً ويرفع صورة الإيصال."),
    bullet("Edge Function لـ OCR (Lovable AI / Gemini Vision) يستخرج المبلغ والتاريخ."),
    bullet("الأدمن يراجع ويوافق → trigger sync_profile_plan_on_activation يحدّث الباقة + يمنح النقاط."),
    h3("ضريبة القيمة المضافة"),
    bullet("15% VAT على جميع الباقات."),
    bullet("فاتورة ضريبية PDF تُولَّد تلقائياً (api.invoice.$requestId.ts) بصيغة معتمدة من ZATCA."),

    h2("نقاط ضعف معروفة في الفوترة"),
    bullet("الموافقة اليدوية تستغرق 1-24 ساعة → يخلق \"وقت ميت\" بين الدفع والتفعيل.", { color: RED }),
    bullet("OCR يفشل أحياناً مع إيصالات منخفضة الجودة → يحتاج fallback يدوي.", { color: RED }),
    bullet("لا يوجد تجديد تلقائي حالياً — كل دورة تتطلب تحويلاً جديداً.", { color: RED }),

    pageBreak(),
  ];
}

function sectionD() {
  return [
    h1("القسم د — ميزات ذكاء الأعمال"),

    h2("Campaign Studio (الميزة المركزية)"),
    p("استوديو الحملات هو قلب رِفْد. الفلسفة: التاجر لا يريد \"نصاً\" أو \"صورة\" منفصلة، بل حملة كاملة لمنتج محدد، لقناة محددة، بهدف محدد."),
    h3("بنية الحملة (Campaign Pack)"),
    bullet("منتج (product): اسم + صورة مرجعية + سعر."),
    bullet("هدف (goal): زيادة مبيعات / إطلاق جديد / تخفيض مخزون / بناء وعي."),
    bullet("جمهور (audience): وصف نصي للشريحة المستهدفة."),
    bullet("قناة (channel): سناب / تيك توك / إنستجرام / تويتر / واتساب بزنس."),
    bullet("عرض (offer): خصم / شحن مجاني / هدية مع الطلب."),
    h3("Smart Context Injection"),
    p("عند توليد أي محتوى داخل Campaign Studio، يُضاف سياق الحملة تلقائياً للـ prompt → نصوص وصور أكثر صلة بكثير من التوليد المنفصل."),

    h2("Store Memory"),
    p("ذاكرة المتجر هي الميزة التي تجعل رِفْد \"تتعلّم\" التاجر. تخزّن:"),
    bullet("هوية المتجر (الاسم، اللون، اللهجة، النبرة)."),
    bullet("المنتجات الأكثر استخداماً."),
    bullet("القوالب المفضّلة."),
    bullet("النصوص التي تم \"تثبيتها\" كأمثلة جيدة (memory insights)."),
    callout("قرار معماري: Store Memory ليست vector DB حالياً، بل JSON منظم في profiles + جداول مساعدة. هذا يكفي حالياً ويتجنّب تعقيد embeddings."),

    h2("Templates Library"),
    bullet("قوالب جاهزة لكل قطاع سعودي (موجودة في src/lib/prompts-data.ts)."),
    bullet("القوالب موسمية: رمضان، اليوم الوطني، الجمعة البيضاء، نهاية العام."),
    bullet("كل قالب يأتي بـ system prompt محسَّن للنبرة المطلوبة."),

    h2("OCR للحوالات البنكية"),
    p("ميزة فريدة في السوق السعودي. تستخدم Gemini Vision لاستخراج: المبلغ، التاريخ، رقم الحوالة، اسم البنك. يقلّل وقت موافقة الأدمن من 5 دقائق إلى 30 ثانية."),

    h2("نظام الأدمن المتكامل"),
    bullet("admin.subscriptions: مراجعة طلبات الاشتراك."),
    bullet("admin.credit-ledger: تتبّع كل حركة نقاط (للتدقيق)."),
    bullet("admin.audit: سجل كل عملية إدارية."),
    bullet("admin.abuse-monitor: رصد الاستخدام الشاذ."),
    bullet("admin.video-jobs: مراقبة طوابير الفيديو."),

    pageBreak(),
  ];
}

function sectionE() {
  return [
    h1("القسم هـ — الأسئلة المفتوحة لـ Claude"),

    p("هذه الأسئلة المحددة هي الإطار المطلوب من Claude الإجابة عليها بعد قراءة الكود. رتّب إجاباتك حسب نفس الترقيم لسهولة المراجعة."),

    h2("أولاً: تجربة المستخدم"),
    bullet("1. هل تدفّق Onboarding (التسجيل → 3 خطوات → أول توليد) يصل بنسبة جيدة للقيمة؟ ما الاحتكاكات الفنية أو النفسية؟", { bold: true }),
    bullet("2. هل لغة الواجهة تتبع \"اكتب نصاً يبيع، صمّم صورة إعلان\" بصرامة؟ هل توجد رسائل عامة أو مهلوسة؟", { bold: true }),
    bullet("3. هل Quota Exceeded Dialog يحوّل المستخدم بفعالية لباقة مدفوعة، أم يحبطه ويفقده؟", { bold: true }),
    bullet("4. هل تجربة الخطأ عند فشل توليد الصور صديقة بما يكفي؟ هل يفهم المستخدم ما حدث ولماذا؟", { bold: true }),
    bullet("5. هل التجاوب على الجوّال (mobile) يحفظ نفس الجودة كما في الـ desktop؟ خاصة في Campaign Studio و Generate Image.", { bold: true }),

    h2("ثانياً: منطق الأعمال"),
    bullet("6. نظام \"نقاط للفيديو + حصص يومية للنص والصورة\" — هل هو منطقي للمستخدم أم مربك؟ هل يحتاج توحيد؟", { bold: true }),
    bullet("7. هل الـ entitlements (plan_entitlements) معبّرة بشكل كامل عن الفروقات بين الباقات؟ هل توجد ميزات لم تُربط بقيود؟", { bold: true }),
    bullet("8. هل تدفّق الدفع (تحويل بنكي + OCR + موافقة يدوية) قابل للتطوير لـ 1000+ مستخدم/شهر؟ ما الاختناقات؟", { bold: true }),
    bullet("9. هل آلية refund_credits آمنة من race conditions؟ هل توجد حالات تسرّب نقاط؟", { bold: true }),
    bullet("10. هل النظام محمي من إساءة الاستخدام (abuse): عدة حسابات بنفس البريد، استهلاك مفرط، توليد محتوى غير لائق؟", { bold: true }),

    h2("ثالثاً: استراتيجية المنتج"),
    bullet("11. ما الميزات التي تبدو من الكود أنها \"بُنيت ولم تُستخدم\"؟ (dead code / abandoned features).", { bold: true }),
    bullet("12. ما الميزات الناقصة المنطقية بناءً على ما هو مبني (مثلاً: تجديد تلقائي للاشتراك، A/B testing على القوالب، تحليلات لكل تاجر)؟", { bold: true }),
    bullet("13. هل بنية الـ Edge Functions و Server Functions جاهزة للنمو 10x؟ ما النقاط الحرجة؟", { bold: true }),
    bullet("14. هل تركيز المنتج على \"التاجر السعودي\" واضح في الكود، أم توجد عمومية تُضعف الموضع التنافسي؟", { bold: true }),
    bullet("15. ما الميزة الواحدة التي لو أضفناها الشهر القادم ستضاعف الاحتفاظ (retention)؟", { bold: true }),

    h2("رابعاً: التنفيذ والكود"),
    bullet("16. هل توجد تكرارات منطقية بين Server Functions يمكن دمجها؟ (مثلاً: prompts.ts و buildXSystemPrompt).", { bold: true }),
    bullet("17. هل التحقق من المدخلات (input validation) كافٍ في كل Server Functions؟ ما الفجوات؟", { bold: true }),
    bullet("18. هل Storage buckets محميّة بشكل صحيح؟ هل توجد روابط signed URLs قد تتسرّب؟", { bold: true }),
    bullet("19. هل rate limiting كافٍ على نقاط النهاية الحساسة (subscribe, OCR, video-callback)؟", { bold: true }),
    bullet("20. أعطِ \"3 إصلاحات سريعة\" لها أعلى أثر مع أقل جهد، و \"3 إعادات هيكلة\" تستحق الاستثمار في الربع القادم.", { bold: true }),

    h2("صيغة الإخراج المطلوبة من Claude"),
    callout("لكل سؤال: إجابة من 3-7 أسطر + اقتباس من الكود (مع مسار الملف ورقم السطر) + توصية محددة قابلة للتنفيذ. تجنّب العموميات."),

    pageBreak(),
  ];
}

function appendix() {
  return [
    h1("الملحق — مرجع تقني سريع"),

    h2("Stack المستخدَم"),
    bullet("Frontend: React 19 + TanStack Start v1 (SSR + Server Functions على Cloudflare Workers Edge)."),
    bullet("Styling: Tailwind v4 + shadcn/ui + Design Tokens (oklch) في src/styles.css."),
    bullet("Backend: Lovable Cloud (Supabase) + Edge Functions + RLS Policies."),
    bullet("AI: Lovable AI Gateway (Gemini 2.5/3 Flash + Pro، GPT-5)."),
    bullet("Video: Replicate + FAL.ai providers مع callback async."),
    bullet("Email: Resend عبر pgmq queues + DLQ."),
    bullet("Notifications: Telegram Bot للأدمن."),

    h2("الجداول الأساسية"),
    bullet("profiles: ملف التاجر (الباقة، الهوية، اللهجة، الواتساب)."),
    bullet("user_credits: نقاط الفيديو (plan + topup)."),
    bullet("daily_text_usage: عدّاد الحصص اليومية للنص والصورة."),
    bullet("generations: سجل كل توليد (للقياس والـ Library)."),
    bullet("campaign_packs: حزم الحملات."),
    bullet("subscription_requests: طلبات الاشتراك (مع OCR للإيصال)."),
    bullet("topup_purchases: مشتريات النقاط الإضافية."),
    bullet("credit_ledger: سجل دفتر النقاط (مصدر الحقيقة)."),
    bullet("video_jobs: طوابير معالجة الفيديو."),
    bullet("user_roles: نظام الأدوار (admin/moderator/user)."),
    bullet("admin_audit_log: سجل العمليات الإدارية."),

    h2("Server Functions الحرجة"),
    bullet("src/server/ai-functions.ts: generateText, generateImage, editImage."),
    bullet("src/server/credits.ts: consumeImageQuota, consumeTextQuota, consumeCredits."),
    bullet("src/server/video-functions.ts: createVideoJob, pollVideoStatus."),
    bullet("src/server/receipts.ts + receipt-ocr.ts: معالجة إيصالات الدفع."),
    bullet("src/server/campaign-packs.ts: CRUD للحملات."),
    bullet("src/server/admin-*.ts: عمليات الأدمن."),

    h2("Routes الحرجة"),
    bullet("src/routes/dashboard.campaign-studio.tsx: استوديو الحملات."),
    bullet("src/routes/dashboard.generate-image.tsx: توليد الصور."),
    bullet("src/routes/dashboard.generate-text.tsx: توليد النصوص."),
    bullet("src/routes/dashboard.generate-video.tsx: توليد الفيديو."),
    bullet("src/routes/dashboard.billing.*: تدفق الدفع."),
    bullet("src/routes/onboarding.tsx: رحلة الـ onboarding."),
    bullet("src/routes/api.public.hooks.ocr-receipt.ts: OCR webhook."),
    bullet("src/routes/api.public.video-provider-callback.ts: callback الفيديو."),

    h2("ملفات السياق المرفقة"),
    bullet("rifd-business-context.pdf — هذا الملف."),
    bullet("rifd-database-schema.sql — تصدير كامل للـ schema و RLS و indexes."),
    bullet("rifd-claude-prompt.md — برومبت جاهز للصق في Claude."),

    h2("رابط الكود المصدري"),
    p("الريبو على GitHub (عام) — Claude يستطيع قراءته مباشرة. الصق الرابط في رسالتك مع الملفات المرفقة."),
  ];
}

const doc = new Document({
  creator: "Rifd",
  title: "Rifd Business Context Pack",
  description: "Business context for Claude Max code review",
  styles: {
    default: { document: { run: { font: FONT } } },
  },
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.RIGHT,
        style: { paragraph: { indent: { right: 360, hanging: 240 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 },
      },
    },
    children: [
      ...cover(),
      ...sectionA(),
      ...sectionB(),
      ...sectionC(),
      ...sectionD(),
      ...sectionE(),
      ...appendix(),
    ],
  }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync("/tmp/rifd-business-context.docx", buf);
console.log("docx written:", buf.length, "bytes");
