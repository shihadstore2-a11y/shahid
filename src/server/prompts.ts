/**
 * Server-side system prompt builder.
 * Builds personalized system prompts using the user's store profile so every
 * generation reflects the brand's voice without the user having to repeat it.
 */

import {
  hasMeaningfulValue,
  joinMemoryList,
  templateOutputRules,
} from "./prompt-memory";

export type StoreContext = {
  store_name?: string | null;
  product_type?: string | null;
  audience?: string | null;
  tone?: string | null;
  brand_color?: string | null;
  brand_personality?: string | null;
  unique_selling_point?: string | null;
  banned_phrases?: string[] | null;
  shipping_policy?: string | null;
  exchange_policy?: string | null;
  faq_notes?: string | null;
  high_margin_products?: string[] | null;
  cta_style?: string | null;
  seasonal_priorities?: string[] | null;
  compliance_notes?: string | null;
};

const TONE_LABEL: Record<string, string> = {
  fun: "نبرة مرحة وقريبة من الجمهور",
  pro: "نبرة احترافية ورصينة",
  warm: "نبرة دافئة وعاطفية",
  bold: "نبرة جريئة وحماسية",
};

const PRODUCT_LABEL: Record<string, string> = {
  dropshipping: "متجر دروبشيبنق",
  fashion: "متجر أزياء وملابس",
  beauty: "متجر تجميل وعناية",
  food: "متجر مأكولات",
  electronics: "متجر إلكترونيات",
  services: "متجر خدمات",
  handmade: "متجر منتجات يدوية",
  other: "متجر متنوع",
};

export function buildTextSystemPrompt(ctx: StoreContext, template: string): string {
  const toneText = ctx.tone ? TONE_LABEL[ctx.tone] ?? "نبرة طبيعية" : "نبرة طبيعية";
  const productText = ctx.product_type
    ? PRODUCT_LABEL[ctx.product_type] ?? "متجر إلكتروني"
    : "متجر إلكتروني";
  const personality = hasMeaningfulValue(ctx.brand_personality) ? ctx.brand_personality : "غير محددة";
  const usp = hasMeaningfulValue(ctx.unique_selling_point) ? ctx.unique_selling_point : "غير محدد";
  const ctaStyle = hasMeaningfulValue(ctx.cta_style) ? ctx.cta_style : "CTA مباشر وواضح";
  const shippingPolicy = hasMeaningfulValue(ctx.shipping_policy) ? ctx.shipping_policy : "غير مذكور";
  const exchangePolicy = hasMeaningfulValue(ctx.exchange_policy) ? ctx.exchange_policy : "غير مذكور";
  const faqNotes = hasMeaningfulValue(ctx.faq_notes) ? ctx.faq_notes : "غير مذكور";
  const complianceNotes = hasMeaningfulValue(ctx.compliance_notes) ? ctx.compliance_notes : "لا توجد ملاحظات خاصة";
  const highMarginProducts = joinMemoryList(ctx.high_margin_products, "غير محددة");
  const seasonalPriorities = joinMemoryList(ctx.seasonal_priorities, "لا توجد مواسم محددة حالياً");
  const bannedPhrases = joinMemoryList(ctx.banned_phrases, "لا توجد عبارات ممنوعة محددة");
  const outputRules = templateOutputRules(template).map((rule, index) => `${index + 6}. ${rule}`).join("\n");

  return `أنت كاتب محتوى تسويقي محترف للسوق السعودي. اكتب باللغة العربية الفصحى المخلوطة بالعامية السعودية الأصيلة (مثل: "كذا"، "وش رايك"، "تراه"، "يفرّح القلب"، "حقك").

سياق المتجر:
- الاسم: ${ctx.store_name ?? "متجر العميل"}
- النوع: ${productText}
- الجمهور المستهدف: ${ctx.audience ?? "مستخدمي السوشيال السعوديين"}
- النبرة المطلوبة: ${toneText}
- شخصية العلامة: ${personality}
- الوعد البيعي الفريد: ${usp}
- أسلوب الدعوة للإجراء: ${ctaStyle}
- المنتجات الأعلى هامشاً أو الأهم للبيع: ${highMarginProducts}
- المواسم والأولويات الحالية: ${seasonalPriorities}

حدود يجب احترامها:
- سياسة الشحن: ${shippingPolicy}
- سياسة الاستبدال/الاسترجاع: ${exchangePolicy}
- أسئلة واعتراضات متكررة: ${faqNotes}
- ملاحظات الامتثال: ${complianceNotes}
- عبارات ممنوعة أو غير مرغوبة: ${bannedPhrases}

نوع المحتوى المطلوب: ${template}

قواعد:
1. ابدأ مباشرة بالمحتوى — لا مقدمات ولا اعتذارات.
2. استخدم emojis بذكاء (٢-٤ لكل منشور).
3. أضف CTA واضح (دعوة لاتخاذ إجراء).
4. ${template.includes("هاشتاق") || template.includes("إنستقرام") ? "أنهِ بـ ٤-٦ هاشتاقات سعودية ذات صلة." : "لا تستخدم هاشتاقات إلا إذا طُلب منك."}
5. اكتب محتوى أصلي وليس قالباً. اجعله ينطبق على عميل سعودي حقيقي.
${outputRules}
9. عند ذكر مزايا أو وعود، لا تخالف سياسات الشحن أو الاستبدال أو الامتثال المذكورة.
10. تجنب تماماً العبارات الممنوعة أو أي صياغة قريبة منها، ولا تستخدم مبالغات غير قابلة للإثبات.
11. إذا كان السياق مناسباً، ادفع باتجاه المنتجات الأعلى هامشاً أو المواسم الحالية دون افتعال.
12. اجعل النص يبدو كأنه صادر من نفس العلامة التجارية في كل مرة، لا من كاتب مختلف.`;
}

export function buildImagePrompt(ctx: StoreContext, userPrompt: string, template: string): string {
  const brand = ctx.brand_color ? ` Use brand color ${ctx.brand_color} as accent.` : "";
  const personality = hasMeaningfulValue(ctx.brand_personality)
    ? ` Brand personality: ${ctx.brand_personality}.`
    : "";
  const usp = hasMeaningfulValue(ctx.unique_selling_point)
    ? ` Highlight this unique selling point visually or in composition: ${ctx.unique_selling_point}.`
    : "";
  const seasonal = joinMemoryList(ctx.seasonal_priorities, "");
  const heroProducts = joinMemoryList(ctx.high_margin_products, "");
  const compliance = hasMeaningfulValue(ctx.compliance_notes)
    ? ` Respect these compliance constraints: ${ctx.compliance_notes}.`
    : "";
  const banned = joinMemoryList(ctx.banned_phrases, "");
  const cta = hasMeaningfulValue(ctx.cta_style) ? ` Suggested CTA direction: ${ctx.cta_style}.` : "";
  return `Professional Saudi Arabian e-commerce marketing image. Template: ${template}. User request: ${userPrompt}. High quality, clean composition, modern design, photorealistic where applicable.${brand}${personality}${usp}${cta}${seasonal ? ` Seasonal emphasis: ${seasonal}.` : ""}${heroProducts ? ` Prioritize these hero products or bundles when relevant: ${heroProducts}.` : ""}${compliance}${banned ? ` Avoid visual claims or text reflecting these banned phrases: ${banned}.` : ""} Include bold Arabic text overlay only where relevant and keep it concise, premium, and legible. Square format suitable for Instagram.`;
}
