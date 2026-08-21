import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { MarketingLayout } from "@/components/marketing-layout";
import { HomeHero } from "@/components/home-hero";
import { StickyMobileCta } from "@/components/sticky-mobile-cta";
import { Button } from "@/components/ui/button";
import ogHomeImage from "@/assets/og-home.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "رِفد — محتوى متجر سعودي بدل ساعات ChatGPT" },
      {
        name: "description",
        content:
          "محتوى متجر يبدو سعودياً ويبيع: رِفد يحوّل فهم سلوك المتسوق السعودي إلى نصوص وصور وفيديوهات جاهزة لقنوات البيع والإعلان.",
      },
      { property: "og:title", content: "رِفد — محتوى متجرك يبدو سعودياً ويبيع" },
      {
        property: "og:description",
        content: "محتوى متجر مبني على فهم السوق السعودي ومتوافق مع سلة، زد، شوبيفاي، Instagram، Google Ads، TikTok، X وSnapchat.",
      },
      { property: "og:image", content: ogHomeImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "رِفد — محتوى متجر سعودي جاهز" },
      { name: "twitter:image", content: ogHomeImage },
      { name: "twitter:image:alt", content: "رِفد — محتوى متجر سعودي جاهز" },
      { name: "twitter:title", content: "رِفد — محتوى متجر سعودي بدل ساعات ChatGPT" },
      { name: "twitter:description", content: "نصوص وصور وفيديوهات مبنية على فهم سلوك المتسوق السعودي." },
    ],
    links: [{ rel: "canonical", href: "https://rifd.site/" }],
  }),
  component: HomePage,
});

const steps = [
  "اكتب وصف متجرك أو منتجك",
  "استلم محتوى مناسباً لقنوات البيع والإعلان",
  "انشر أسرع وكرّر حملاتك بثقة",
] as const;

function HomePage() {
  return (
    <MarketingLayout>
      <HomeHero />

      <section className="border-b border-border bg-background py-10 sm:py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-black text-primary">من الفكرة إلى محتوى قابل للنشر</p>
            <h2 className="mt-2 text-2xl font-black leading-tight sm:text-4xl">
              ثلاث خطوات تختصر طريق المحتوى لمتجرك
            </h2>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step} className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-lg font-black leading-7">{step}</h3>
                <div className="mt-4 flex items-center gap-2 text-sm font-bold text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  خطوة واضحة بدون تعقيد
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="final-cta" className="bg-background py-10 pb-24 sm:pb-14">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="rounded-2xl gradient-primary p-7 text-primary-foreground shadow-elegant sm:p-10">
            <p className="text-sm font-black text-primary-foreground/80">ابدأ بخطوة واحدة</p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
              جهّز محتوى متجرك القادم قبل أن تضيع ساعات جديدة
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-7 text-primary-foreground/85 sm:text-base">
              جرّب رِفد مجاناً، وشاهد كيف تتحول فكرة منتجك إلى نصوص وصور وفيديوهات بالعامية السعودية.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary" className="w-full max-w-[18rem] font-extrabold shadow-elegant sm:w-auto">
                <Link to="/auth" search={{ redirect: "/onboarding/wizard" }}>
                  <Sparkles className="h-4 w-4" />
                  ابدأ مجاناً
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full max-w-[18rem] border-primary-foreground/30 bg-transparent font-extrabold text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto">
                <Link to="/pricing">
                  شوف الباقات
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <StickyMobileCta />
    </MarketingLayout>
  );
}