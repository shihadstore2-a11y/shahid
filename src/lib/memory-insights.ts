import type { Profile } from "@/hooks/use-auth";

function cleanList(value: string[] | null | undefined) {
  return (value ?? []).map((item) => item.trim()).filter(Boolean);
}

function hasValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function getMemoryCoverage(profile: Profile | null) {
  if (!profile) return 0;

  const trackedValues = [
    profile.store_name,
    profile.product_type,
    profile.audience,
    profile.tone,
    profile.brand_color,
    profile.brand_personality,
    profile.unique_selling_point,
    profile.cta_style,
    profile.shipping_policy,
    profile.exchange_policy,
    profile.faq_notes,
    profile.compliance_notes,
    ...(cleanList(profile.high_margin_products).length ? ["high-margin"] : []),
    ...(cleanList(profile.seasonal_priorities).length ? ["seasons"] : []),
    ...(cleanList(profile.banned_phrases).length ? ["banned"] : []),
  ];

  return Math.round((trackedValues.filter(Boolean).length / 15) * 100);
}

export function getMemorySignals(profile: Profile | null) {
  if (!profile) return [];

  const signals = [
    hasValue(profile.unique_selling_point) ? `الوعد البيعي: ${profile.unique_selling_point}` : null,
    hasValue(profile.brand_personality) ? `شخصية العلامة: ${profile.brand_personality}` : null,
    hasValue(profile.cta_style) ? `أسلوب CTA: ${profile.cta_style}` : null,
    cleanList(profile.high_margin_products).length
      ? `أولوية البيع: ${cleanList(profile.high_margin_products).slice(0, 2).join("، ")}`
      : null,
    cleanList(profile.seasonal_priorities).length
      ? `الموسم الحالي: ${cleanList(profile.seasonal_priorities).slice(0, 2).join("، ")}`
      : null,
    hasValue(profile.shipping_policy) ? `الثقة: ${profile.shipping_policy}` : null,
  ];

  return signals.filter(Boolean) as string[];
}

export function getWeeklyRecommendation(profile: Profile | null) {
  if (!profile) {
    return {
      title: "ابدأ ببناء ذاكرة متجرك أولاً",
      description: "كلما اكتملت الذاكرة، أصبحت التوليدات أقرب لهوية متجرك ومواسمه الفعلية.",
      ctaLabel: "أكمل ملف المتجر",
      ctaHref: "/dashboard/store-profile" as const,
    };
  }

  const seasons = cleanList(profile.seasonal_priorities);
  const heroProducts = cleanList(profile.high_margin_products);

  if (seasons.length && heroProducts.length) {
    return {
      title: `الحملة الأسبوعية المقترحة: ${heroProducts[0]}`,
      description: `ابدأ هذا الأسبوع بحملة تربط ${heroProducts[0]} بموسم ${seasons[0]} حتى يظهر أثر الذاكرة مباشرة في النص والصورة والـCTA.`,
      ctaLabel: "ابدأ توليد الحملة",
      ctaHref: "/dashboard/generate-text" as const,
    };
  }

  if (heroProducts.length) {
    return {
      title: `ادفع هذا الأسبوع نحو ${heroProducts[0]}`,
      description: "لديك منتجات عالية الهامش محفوظة في الذاكرة؛ الأفضل الآن تحويلها إلى مخرج بيعي وصورة رئيسية بدل محتوى عام.",
      ctaLabel: "أنشئ نصاً موجهاً",
      ctaHref: "/dashboard/generate-text" as const,
    };
  }

  return {
    title: "ثبّت أولوياتك الموسمية والبيعية",
    description: "أضف المواسم والمنتجات الأعلى هامشاً حتى يبدأ رِفد بإظهار أثر تراكمي حقيقي في المخرجات القادمة.",
    ctaLabel: "حسّن الذاكرة",
    ctaHref: "/dashboard/store-profile" as const,
  };
}

export function getSmartPromptSuggestions(profile: Profile | null, mode: "text" | "image") {
  if (!profile) return [];

  const seasons = cleanList(profile.seasonal_priorities);
  const heroProducts = cleanList(profile.high_margin_products);
  const product = heroProducts[0] ?? "منتجك الأساسي";
  const season = seasons[0];
  const audience = hasValue(profile.audience) ? profile.audience : "الجمهور المستهدف";

  if (mode === "text") {
    return [
      season
        ? `اكتب منشوراً يروّج لـ ${product} بمناسبة ${season} مع CTA يعكس أسلوب متجري.`
        : `اكتب منشوراً يروّج لـ ${product} بلغة تناسب ${audience} مع CTA يعكس أسلوب متجري.`,
      `اكتب إعلاناً قصيراً يبرز ${product} ويربطه بوعد المتجر وقيمته الأعلى للشراء الآن.`,
      `اكتب فكرة Reel قصيرة لبيع ${product} بزاوية عملية تناسب ${audience}.`,
    ].filter(Boolean);
  }

  return [
    season
      ? `صمّم صورة إعلانية لـ ${product} بلمسة موسمية تناسب ${season} مع مساحة عنوان عربية واضحة.`
      : `صمّم صورة رئيسية لـ ${product} بأسلوب بصري يعكس هوية المتجر ومساحة عنوان عربية واضحة.`,
    `أنشئ بوستر يبرز ${product} داخل مشهد استخدام واقعي يناسب ${audience}.`,
    `أنشئ Hero visual احترافي لـ ${product} يبرز الفائدة الرئيسية واتجاه الهوية البصرية للمتجر.`,
  ].filter(Boolean);
}