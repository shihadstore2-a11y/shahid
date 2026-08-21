import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarRange, GalleryVerticalEnd, MessageSquareQuote, ShoppingBag, Sparkles, Target, ShieldCheck, Clapperboard } from "lucide-react";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";

type SectorPageProps = {
  title: string;
  shortTitle: string;
  description: string;
  heroLabel: string;
  painPoints: string[];
  proofExamples: string[];
  bestTemplates: string[];
  seasons: string[];
  weeklyOutputs: string[];
  buyingTriggers: string[];
  samplePack: {
    brief: string;
    post: string;
    visual: string;
    reel: string;
  };
  objections: { question: string; answer: string }[];
  primaryCta: string;
};

export function SectorPage({
  title,
  shortTitle,
  description,
  heroLabel,
  painPoints,
  proofExamples,
  bestTemplates,
  seasons,
  weeklyOutputs,
  buyingTriggers,
  samplePack,
  objections,
  primaryCta,
}: SectorPageProps) {
  return (
    <MarketingLayout>
      <section className="gradient-hero border-b border-border py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {heroLabel}
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">{description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {buyingTriggers.map((item) => (
              <span key={item} className="rounded-full border border-primary/15 bg-background/70 px-3 py-1.5 text-xs font-bold text-foreground">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="gradient-primary text-primary-foreground shadow-elegant">
              <Link to="/onboarding">
                {primaryCta}
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/proof-center">شاهد أمثلة الإثبات</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              كيف يبدو <span className="text-gradient-primary">Success Pack</span> لهذا القطاع؟
            </h2>
            <p className="mt-3 text-muted-foreground">
              ليس وعداً عاماً، بل مثال مبدئي يوضح كيف يتحول الطلب المختصر إلى حزمة أقرب للتشغيل داخل هذا القطاع بالذات.
            </p>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
            <article className="rounded-2xl border border-primary/15 bg-secondary/35 p-6 shadow-soft">
              <div className="flex items-center gap-2 text-primary">
                <Target className="h-5 w-5" />
                <h2 className="text-xl font-extrabold">الطلب المختصر</h2>
              </div>
              <p className="mt-4 text-sm leading-8 text-foreground">{samplePack.brief}</p>
            </article>

            <article className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <MessageSquareQuote className="h-4 w-4" />
                    <h3 className="text-sm font-extrabold">المنشور الرئيسي</h3>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-foreground">{samplePack.post}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <GalleryVerticalEnd className="h-4 w-4" />
                    <h3 className="text-sm font-extrabold">اتجاه الصورة</h3>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{samplePack.visual}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4 md:col-span-2">
                  <div className="flex items-center gap-2 text-primary">
                    <Clapperboard className="h-4 w-4" />
                    <h3 className="text-sm font-extrabold">فكرة Reel</h3>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{samplePack.reel}</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-background py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 text-primary">
              <MessageSquareQuote className="h-5 w-5" />
              <h2 className="text-xl font-extrabold">مشاكل {shortTitle}</h2>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-muted-foreground">
              {painPoints.map((item) => (
                <li key={item} className="rounded-lg bg-secondary/60 px-4 py-3">{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 text-primary">
              <GalleryVerticalEnd className="h-5 w-5" />
              <h2 className="text-xl font-extrabold">أمثلة مناسبة للقطاع</h2>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-muted-foreground">
              {proofExamples.map((item) => (
                <li key={item} className="rounded-lg bg-secondary/60 px-4 py-3">{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/30 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-3">
          <article className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 text-primary">
              <ShoppingBag className="h-5 w-5" />
              <h2 className="text-lg font-extrabold">أفضل القوالب</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {bestTemplates.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 text-primary">
              <CalendarRange className="h-5 w-5" />
              <h2 className="text-lg font-extrabold">مواسم القطاع الأقوى</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {seasons.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-lg font-extrabold">ماذا ينتج خلال أسبوع؟</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {weeklyOutputs.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="border-t border-border bg-background py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              اعتراضات الشراء في <span className="text-gradient-primary">{shortTitle}</span>
            </h2>
            <p className="mt-3 text-muted-foreground">
              لأن الصفحة القطاعية الجيدة لا تكتفي بالوصف؛ بل تجيب على أسئلة القرار التي تمنع الاشتراك أو التجربة.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {objections.map((item) => (
              <article key={item.question} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-extrabold">{item.question}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.answer}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-gold/25 bg-card p-6 text-center shadow-soft">
            <h2 className="text-2xl font-extrabold">ابدأ من قطاعك لا من صفحة عامة</h2>
            <p className="mt-3 text-muted-foreground">
              كلما كانت مدخلاتك أوضح لقطاعك، كانت النتيجة الأولى أقرب إلى حملة قابلة للاستخدام مباشرة داخل متجرك.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild className="gradient-primary text-primary-foreground shadow-elegant">
                <Link to="/onboarding">
                  {primaryCta}
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/proof-center">راجع الإثباتات أولاً</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
