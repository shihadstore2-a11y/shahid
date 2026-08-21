import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ArrowLeft } from "lucide-react";
import { MarketingLayout } from "@/components/marketing-layout";
import { ComparisonTable } from "@/components/comparison-table";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vs-chatgpt")({
  head: () => ({
    meta: [
      { title: "رِفد vs ChatGPT — ليش رِفد أرخص وأذكى لمتجرك؟" },
      {
        name: "description",
        content:
          "مقارنة مباشرة بين رِفد و ChatGPT و Gemini للسوق السعودي: السعر، العامية، ذاكرة المتجر، وأمثلة حية لنفس البرومبت.",
      },
      { property: "og:title", content: "رِفد vs ChatGPT — المقارنة الكاملة" },
      {
        property: "og:description",
        content: "ليش يختار أصحاب المتاجر السعوديون رِفد بدل أدوات عامة مثل ChatGPT؟ شوف الفرق.",
      },
      { name: "twitter:title", content: "رِفد vs ChatGPT — المقارنة الكاملة" },
      { name: "twitter:description", content: "السعر، العامية، ذاكرة المتجر، وأمثلة حية لنفس البرومبت — الفرق الحقيقي بين الأدوات." },
    ],
    links: [{ rel: "canonical", href: "https://rifd.site/vs-chatgpt" }],
  }),
  component: VsChatgptPage,
});

const PROMPT_EXAMPLE = "اكتب لي منشور إنستقرام لمتجر عطور بالعامية السعودية يستهدف الشباب";

const SAMPLES = [
  {
    name: "ChatGPT",
    color: "border-destructive/30",
    badge: "❌",
    text: `🌟 اكتشف عالم العطور مع متجرنا!\n\nنقدم لكم تشكيلة واسعة من العطور الفاخرة التي تناسب الشباب العصري. عطورنا مختارة بعناية لتمنحك ثبات استثنائي ورائحة تدوم طويلاً.\n\n✅ جودة عالية\n✅ أسعار مناسبة\n✅ شحن سريع\n\nزر متجرنا الآن!`,
    issues: ["فصحى ركيكة وغير مشدّة", "عام جداً، يصلح لأي متجر", "بدون نبرة سعودية أو لغة شارع"],
  },
  {
    name: "Gemini",
    color: "border-warning/30",
    badge: "⚠️",
    text: `استكشف مجموعتنا المميزة من العطور الراقية. تشكيلة واسعة تناسب الذوق العصري للشباب، بأسعار تنافسية وتوصيل سريع لكافة مناطق المملكة.\n\n#عطور #متجر #توصيل #السعودية`,
    issues: ["فصحى متكلّفة", "ما يستخدم لغة الشباب الفعلية", "هاشتاقات عامة بلا قيمة"],
  },
  {
    name: "رِفد",
    color: "border-primary",
    badge: "✅",
    highlight: true,
    text: `يا شباب 😎 وش رايكم بعطر يخلّيكم بصمة ما تنتسي؟\n\nمن متجرنا — مجموعة مختارة بثبات 12 ساعة، رائحة تشد الأنظار من أول رشّة 🔥\n\n🎁 عيّنة هدية مع كل طلب\n📦 توصيل لين البيت في 48 ساعة\n💚 ضمان رضاك أو نسترد فلوسك\n\nطلّعها الحين قبل لا تنفد ↓\n\n#عطور_رجالية #ستايل_سعودي #شباب_السعودية`,
    issues: [],
  },
];

function VsChatgptPage() {
  return (
    <MarketingLayout>
      <section className="border-b border-border gradient-hero py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            مقارنة مباشرة وشفّافة
          </div>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
            رِفد <span className="text-gradient-primary">vs</span> ChatGPT
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            ليش يختار أصحاب المتاجر السعوديون رِفد بدل أدوات عامة مثل ChatGPT؟
            <br />
            <strong className="text-foreground">لأن رِفد ما هو ChatGPT بواجهة عربية — هو منتج مختلف كلياً.</strong>
          </p>
        </div>
      </section>

      {/* مثال حي */}
      <section className="bg-background py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold sm:text-3xl">مثال حي — نفس البرومبت، 3 نتائج</h2>
            <p className="mt-2 text-sm text-muted-foreground">شوف الفرق بنفسك</p>
            <div className="mt-4 inline-block rounded-lg border border-border bg-card px-4 py-2 text-sm">
              📝 البرومبت: <span className="font-mono text-primary">"{PROMPT_EXAMPLE}"</span>
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {SAMPLES.map((s) => (
              <div
                key={s.name}
                className={`flex flex-col rounded-2xl border-2 ${s.color} bg-card p-5 ${s.highlight ? "shadow-elegant ring-1 ring-primary/30" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">
                    {s.badge} {s.name}
                  </h3>
                  {s.highlight && (
                    <span className="rounded-full gradient-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground">
                      الأفضل
                    </span>
                  )}
                </div>
                <pre className="mt-3 flex-1 whitespace-pre-wrap rounded-lg bg-secondary/50 p-3 text-right font-sans text-xs leading-relaxed">
                  {s.text}
                </pre>
                {s.issues.length > 0 && (
                  <div className="mt-3 rounded-lg bg-destructive/5 p-2 text-xs">
                    <strong className="text-destructive">المشاكل:</strong>
                    <ul className="mt-1 list-inside list-disc text-muted-foreground">
                      {s.issues.map((i) => <li key={i}>{i}</li>)}
                    </ul>
                  </div>
                )}
                {s.highlight && (
                  <div className="mt-3 rounded-lg bg-success/10 p-2 text-xs text-success">
                    ✨ نبرة سعودية حقيقية + هاشتاقات محلية + قيمة واضحة + CTA قوي
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* جدول المقارنة الكامل */}
      <section className="border-t border-border bg-secondary/30 py-12">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-extrabold sm:text-3xl">المقارنة الكاملة</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">9 معايير حقيقية تهم أصحاب المتاجر</p>
          <div className="mt-8">
            <ComparisonTable />
          </div>
        </div>
      </section>

      {/* لماذا الفرق */}
      <section className="border-t border-border bg-background py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-3xl font-extrabold">ما الذي يجعل رِفد مختلفاً؟</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {[
              {
                t: "ذاكرة متجر دائمة",
                d: "رِفد يحفظ اسم متجرك، نوع منتجاتك، جمهورك، ونبرتك. كل توليدة تجي مخصصة بدون ما تكتب التفاصيل من جديد.",
              },
              {
                t: "نماذج مدرّبة على السوق السعودي",
                d: "نستخدم نفس ChatGPT و Gemini، لكن مع برومبتات مهندسة بآلاف المثال السعودي — تعطي نتائج بنبرة محلية حقيقية.",
              },
              {
                t: "صور بنص عربي مُتقن",
                d: "ChatGPT يفشل في رسم النص العربي بشكل صحيح. رِفد يعطي بوسترات بنص واضح وبارز — جاهز للنشر.",
              },
              {
                t: "تكامل مع متجرك",
                d: "نصوصنا مهيكلة لتُنسخ مباشرة في سلة، زد، أو شوبيفاي — مع SEO، مواصفات، وصف كامل.",
              },
            ].map((x) => (
              <div key={x.t} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <h3 className="text-lg font-bold text-primary">✨ {x.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl gradient-primary p-8 text-center text-primary-foreground shadow-elegant">
            <h3 className="text-2xl font-extrabold">جرّب الفرق بنفسك — مجاناً</h3>
            <p className="mt-2 text-primary-foreground/90">
              خطوتان فقط لأول محتوى سعودي جاهز: منشور يبيع، صور تبيع، وفيديو يبيع
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-5 shadow-elegant">
              <Link to="/onboarding">
                ابدأ الآن مجاناً
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
