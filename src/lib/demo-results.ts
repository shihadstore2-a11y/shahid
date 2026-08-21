/**
 * نتائج تجريبية واقعية للـLive Demo في الـHero
 * (الموجة 1: mock — الموجة 2: حية عبر Lovable AI Gateway)
 */

export type DemoInput = {
  storeName: string;
  productType: string;
  audience: string;
};

export const PRODUCT_TYPES = [
  { id: "dropshipping", label: "دروبشيبنق" },
  { id: "fashion", label: "موضة وأزياء" },
  { id: "perfumes", label: "عطور" },
  { id: "electronics", label: "إلكترونيات" },
  { id: "handmade", label: "منتجات يدوية" },
  { id: "food", label: "مطعم/أكل" },
  { id: "services", label: "خدمات" },
];

export const AUDIENCES = [
  { id: "young", label: "شباب 18-24" },
  { id: "adults", label: "بالغين 25-35" },
  { id: "professionals", label: "موظفين 30-45" },
  { id: "moms", label: "أمهات" },
  { id: "luxury", label: "فئة فاخرة 35+" },
];

const TEMPLATES_BY_PRODUCT: Record<string, (s: string, a: string) => string> = {
  dropshipping: (s, a) =>
    `🔥 جديد ${s} اللي كل ${a} يدوّر عليه!\n\nمنتجات مختارة بعناية، أسعار ما تتكرر، وشحن لين باب بيتك في 2-4 أيام.\n\n✨ ضمان استرجاع 14 يوماً\n✨ الدفع عند الاستلام\n✨ خدمة عملاء بالعربي\n\nلا تطوّل التفكير — الكميات محدودة 💚\n\n#${s.replace(/\s/g, "_")} #تسوق_اونلاين #السعودية`,
  fashion: (s, a) =>
    `أحدث وصلات ${s} 👗✨\n\nقطع مختارة تليق بذوق ${a} — تصاميم تجمع الأناقة والراحة، وأسعار صديقة للجيب.\n\n📦 شحن مجاني للطلبات فوق 200 ر.س\n💚 إرجاع مجاني خلال 14 يوماً\n💳 تابي وتمارا متاحة\n\nشوفي المجموعة كاملة في المتجر 👇\n\n#أزياء_سعودية #${s.replace(/\s/g, "_")} #ستايل`,
  perfumes: (s, a) =>
    `🌹 من ${s} — عطور تخلّيك ما تنتسي\n\nخصيصاً لـ${a} اللي يبحثون عن البصمة المختلفة. مجموعة عطور أصلية بثبات يدوم 12 ساعة، ورائحة تشد الانتباه من أول رشّة.\n\n🎁 عيّنة مجانية مع كل طلب\n📦 توصيل آمن بـ48 ساعة لكل المملكة\n\nجربها اليوم — ضمان رضاك أو نسترد فلوسك 💚\n\n#عطور_عربية #${s.replace(/\s/g, "_")} #هدايا`,
  electronics: (s, a) =>
    `⚡ ${s} — تقنية تواكب طموح ${a}\n\nأحدث الأجهزة بأسعار تنافسية + ضمان رسمي وكيل + خدمة ما بعد البيع.\n\n✅ منتجات أصلية 100%\n✅ شحن سريع لكل المناطق\n✅ تركيب مجاني داخل الرياض\n\nشوف الكتالوج الكامل في المتجر 👇\n\n#إلكترونيات #${s.replace(/\s/g, "_")} #تقنية`,
  handmade: (s, a) =>
    `🎨 صناعة يدوية بحب — من ${s} إليك\n\nقطع فريدة لا تتكرر، صنعت بأيدي حرفيين سعوديين، تليق بذوق ${a} اللي يقدّر التميّز.\n\n🌿 خامات طبيعية\n💚 دعم منتج محلي\n📦 تغليف هدية مجاني\n\nاطلبي قطعتك المفضلة قبل لا تنفد 👇\n\n#صناعة_يدوية #دعم_محلي #${s.replace(/\s/g, "_")}`,
  food: (s, a) =>
    `🍽️ ${s} — طعم يفرح القلب\n\nمنيو متجدد لـ${a} الذواقة، مكونات طازة كل يوم، وتوصيل ساخن لين بيتك.\n\n🔥 عرض اليوم: خصم 20% على الطلبات الأولى\n🚀 توصيل أقل من 30 دقيقة\n⭐ تقييم 4.9 من عملائنا\n\nاطلب الحين 👇\n\n#مطاعم_السعودية #${s.replace(/\s/g, "_")} #توصيل`,
  services: (s, a) =>
    `💼 ${s} — حلول احترافية لـ${a}\n\nخدماتنا مصممة عشان نوفّر وقتك ونحقّق نتائج فعلية. فريق متخصص + ضمان جودة + متابعة مستمرة.\n\n✅ استشارة مجانية أول مرة\n✅ خطة عمل مخصصة لك\n✅ تواصل مباشر بالعربي\n\nاحجز موعدك الحين 👇\n\n#خدمات_احترافية #${s.replace(/\s/g, "_")}`,
};

export function generateDemoResult({ storeName, productType, audience }: DemoInput): string {
  const productLabel =
    PRODUCT_TYPES.find((p) => p.id === productType)?.label || "منتجات";
  const audienceLabel =
    AUDIENCES.find((a) => a.id === audience)?.label || "العملاء";
  const template = TEMPLATES_BY_PRODUCT[productType] || TEMPLATES_BY_PRODUCT.dropshipping;
  const finalStore = storeName.trim() || `متجر ${productLabel}`;
  return template(finalStore, audienceLabel);
}
