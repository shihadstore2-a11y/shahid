import {
  Brain,
  Image as ImageIcon,
  Library,
  Languages,
  ShieldCheck,
  Zap,
  Store,
  CreditCard,
} from "lucide-react";

const FEATURES = [
  {
    icon: Languages,
    title: "عامية سعودية أصيلة",
    desc: "لا فصحى مكسّرة ولا ترجمة آلية — نصوص بنبرة سعودية حقيقية تكسب ثقة عملائك.",
  },
  {
    icon: Brain,
    title: "ذاكرة متجرك الدائمة",
    desc: "نحفظ اسم متجرك، جمهورك، نبرتك وألوانك — كل توليدة تجي مخصصة بدون ما تكتب التفاصيل من جديد.",
  },
  {
    icon: Library,
    title: "مكتبة قوالب سعودية",
    desc: "قوالب نصية وصور مصممة لأصحاب المتاجر السعوديين، بنقرة واحدة فقط.",
  },
  {
    icon: ImageIcon,
    title: "بوسترات بالعربي",
    desc: "صور إعلانية بنص عربي بارز + تحسين صور منتجاتك بخلفية احترافية — بدون مصمم.",
  },
  {
    icon: Zap,
    title: "نتيجة في 10 ثواني",
    desc: "لا انتظار، لا هندسة برومبتات. تختار القالب، تكتب فكرتك، وتحصل على نتيجة جاهزة للنشر.",
  },
  {
    icon: Store,
    title: "تكامل مع متجرك",
    desc: "نصوص جاهزة للصق في سلة، زد، شوبيفاي — مع وصف، عنوان SEO، ومواصفات.",
  },
  {
    icon: ShieldCheck,
    title: "خصوصية وأمان واضحان",
    desc: "بياناتك محفوظة بسياسات وصول محمية وتوضيح لاستخدام المحتوى والصور.",
  },
  {
    icon: CreditCard,
    title: "فوترة بالريال السعودي",
    desc: "اشتراكات واضحة بالريال السعودي وتفاصيل دفع مبيّنة داخل المنتج.",
  },
];

function FeatureCard({ f }: { f: (typeof FEATURES)[number] }) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-elegant">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:gradient-primary group-hover:text-primary-foreground">
        <f.icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-bold">{f.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
    </div>
  );
}

export function HomeFeatures() {
  const primary = FEATURES.slice(0, 4);
  const extra = FEATURES.slice(4);

  return (
    <section className="border-t border-border bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            كل ما تحتاجه عشان <span className="text-gradient-primary">تبيع أكثر</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            أدوات مصممة خصيصاً للسوق السعودي — ليست مجرد ChatGPT بواجهة عربية
          </p>
        </div>

        {/* الموبايل: 4 ميزات + accordion للباقي. الديسكتوب: 8 كاملة */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:hidden">
          {primary.map((f) => <FeatureCard key={f.title} f={f} />)}
        </div>

        <details className="group mt-5 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/10">
            <span>+{extra.length} ميزات إضافية</span>
            <span className="text-xs transition-transform group-open:rotate-180">▼</span>
          </summary>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {extra.map((f) => <FeatureCard key={f.title} f={f} />)}
          </div>
        </details>

        {/* الديسكتوب: 8 ميزات */}
        <div className="mt-10 hidden gap-5 lg:grid lg:grid-cols-4">
          {FEATURES.map((f) => <FeatureCard key={f.title} f={f} />)}
        </div>
      </div>
    </section>
  );
}
