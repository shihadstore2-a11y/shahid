import { Suspense, lazy, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Crown,
  Film,
  Gift,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ANNUAL_DISCOUNT_PCT,
  LAUNCH_BADGE_LABEL,
  PLAN_CATALOG,
  REFUND_GUARANTEE_LABEL,
  VIDEO_QUALITY_LABELS,
  formatPlanNumber,
  videoCreditCost,
} from "@/lib/plan-catalog";
import { trackPricingEvent } from "@/lib/analytics/pricing-tracking";
import { SaudiTestimonials } from "@/components/saudi-testimonials";

const SubscribersCounter = lazy(() => import("@/components/subscribers-counter").then((m) => ({ default: m.SubscribersCounter })));
const TrustBadges = lazy(() => import("@/components/trust-badges").then((m) => ({ default: m.TrustBadges })));

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "أسعار رِفد — نقاط فيديو للمتاجر السعودية" },
      {
        name: "description",
        content:
          "باقات رِفد: قدرات نمو لمتجرك، نقاط فيديو واضحة لإعلانات قصيرة، ضمان 7 أيام استرداد كامل، وفوترة شفافة بسعر الإطلاق.",
      },
      { property: "og:title", content: "أسعار رِفد — نصوص وصور + نقاط فيديو" },
      {
        property: "og:description",
        content:
          `Starter ${PLAN_CATALOG[1].monthlyPriceSar}ر، Growth ${PLAN_CATALOG[2].monthlyPriceSar}ر، Pro ${PLAN_CATALOG[3].monthlyPriceSar}ر، Business ${PLAN_CATALOG[4].monthlyPriceSar}ر — فيديوهات بالنقاط دون وعود غير محدودة.`,
      },
      { name: "twitter:title", content: "أسعار رِفد — نقاط فيديو واضحة" },
      {
        name: "twitter:description",
        content:
          `اختر باقتك حسب رصيدك: ${VIDEO_QUALITY_LABELS.fast} ${videoCreditCost("fast", 5)} نقطة، ${VIDEO_QUALITY_LABELS.lite} ${videoCreditCost("lite", 8)} نقطة، و${VIDEO_QUALITY_LABELS.quality} ${videoCreditCost("quality", 8)} نقطة.`,
      },
    ],
    links: [{ rel: "canonical", href: "https://rifd.site/pricing" }],
  }),
  component: PricingPage,
});

function planFeatures(plan: (typeof PLAN_CATALOG)[number]) {
  const estimatedFastVideos = Math.floor(plan.monthlyCredits / videoCreditCost("fast", 5));
  const estimatedAdVideos = Math.floor(plan.monthlyCredits / videoCreditCost("lite", 8));
  const growthCapability: Record<string, string> = {
    free: "تجربة للنصوص والصور وبناء أول ذاكرة متجر",
    starter: "استخدام يومي مناسب للانطلاق وصناعة محتوى منتظم",
    growth: "استخدام يومي أعلى للمتاجر النشطة مع صور Pro",
    pro: "تشغيل متقدم للمتجر الجاد مع فيديو احترافي",
    business: "سعة موسعة للفرق وتعدد الحملات",
  };
  const usageLabel: Record<string, string> = {
    free: "فيديو محدود للتجربة حسب الرصيد",
    starter: "استخدام فيديو محدود حسب الرصيد",
    growth: "استخدام فيديو متوسط حسب الرصيد",
    pro: "استخدام فيديو متقدم حسب الرصيد",
    business: "بدون حد عملي داخل الرصيد",
  };
  return [
    growthCapability[plan.id],
    plan.imageProAllowed ? "صور Pro للحملات التي تحتاج مظهراً أقوى" : "صور أساسية واضحة لبداية المتجر",
    `${usageLabel[plan.id]}: حتى ${formatPlanNumber(estimatedFastVideos)} سريع أو ${formatPlanNumber(estimatedAdVideos)} إعلاني شهرياً تقريباً`,
    plan.videoQualityAllowed ? "سريع وإعلاني واحترافي حسب النقاط" : "سريع وإعلاني حسب النقاط",
    plan.id === "free" ? "فيديو بعلامة رِفد المائية" : "بدون علامة مائية، مع إلزام صورة المنتج لجودة إعلان أعلى",
    "نقاط الباقة لا ترحل بعد 30 يوم؛ نقاط الشحن الإضافية منفصلة",
  ];
}

const FAQS = [
  {
    q: "هل الفيديوهات غير محدودة؟",
    a: `لا. الفيديوهات تعمل بنقاط فيديو واضحة حتى يبقى السعر عادلاً والنتيجة قابلة للتنبؤ: ${VIDEO_QUALITY_LABELS.fast} 5ث بـ${videoCreditCost("fast", 5)} نقطة، ${VIDEO_QUALITY_LABELS.lite} 8ث بـ${videoCreditCost("lite", 8)} نقطة، و${VIDEO_QUALITY_LABELS.quality} 8ث بـ${videoCreditCost("quality", 8)} نقطة.`,
  },
  {
    q: "هل النصوص والصور تخصم من نقاط الفيديو؟",
    a: "لا. النصوص والصور لا تخصم نقاط فيديو. تفاصيل الاستخدام اليومية تظهر داخل لوحة التحكم بصياغة تشغيلية لحماية جودة الخدمة.",
  },
  {
    q: "ماذا يحدث إذا انتهت نقاط الفيديو؟",
    a: "يمكنك شحن نقاط فيديو إضافية من لوحة التحكم، أو الترقية إلى باقة أعلى حسب حجم حملاتك.",
  },
  {
    q: "هل تنتقل نقاط الباقة للشهر التالي؟",
    a: "لا. نقاط الباقة الشهرية تتجدد كل 30 يوم ولا يرحل المتبقي منها، بينما نقاط الشحن الإضافية تبقى منفصلة حسب سياسة الشحن.",
  },
  {
    q: "كيف يعمل ضمان 7 أيام؟",
    a: "خلال أول 7 أيام من اشتراكك المدفوع الأول، إذا لم تكن التجربة مناسبة، أرسل لنا طلباً واحداً ويُسترَد المبلغ كاملاً بدون أسئلة، وفق سياسة الاسترجاع المنشورة.",
  },
  {
    q: "هل الأسعار شاملة الضريبة؟",
    a: "تظهر تفاصيل الضريبة والفوترة بوضوح عند الدفع أو التفعيل حسب مسار الاشتراك المتاح داخل المنتج.",
  },
];

function PricingPage() {
  const [yearly, setYearly] = useState(false);

  const ctaTarget = "/dashboard/billing";

  // page_view مرة واحدة عند التحميل
  useEffect(() => {
    void trackPricingEvent("page_view", { billingCycle: "monthly" });
  }, []);

  const handleToggleAnnual = (next: boolean) => {
    setYearly(next);
    void trackPricingEvent("annual_toggled", {
      billingCycle: next ? "yearly" : "monthly",
      metadata: { yearly: next },
    });
  };

  const handlePlanCta = (planId: string) => {
    void trackPricingEvent("cta_clicked", {
      planId,
      billingCycle: yearly ? "yearly" : "monthly",
    });
  };

  return (
    <MarketingLayout>
      <section className="border-b border-border bg-secondary/30 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold">
            <Film className="h-3.5 w-3.5" /> نظام جديد: نقاط للفيديو فقط
          </div>
          <h1 className="mx-auto mt-4 min-h-[5.75rem] max-w-3xl text-3xl font-extrabold leading-[1.28] sm:min-h-[7.75rem] sm:text-5xl sm:leading-[1.18]">
            قدرات نمو لمتجرك، <span className="text-gradient-primary">وفيديوهات بنقاط واضحة</span>
          </h1>
          <p className="mx-auto mt-3 min-h-[5.25rem] max-w-2xl text-sm leading-7 text-muted-foreground sm:min-h-[3.5rem] sm:text-base">
            اختر قدرة النمو المناسبة لمتجرك. النصوص والصور جزء من تشغيلك اليومي داخل المنتج، والفيديو يُحاسب فقط بنقاط شفافة: سريع بـ{videoCreditCost("fast", 5)}، إعلاني بـ{videoCreditCost("lite", 8)}، واحترافي بـ{videoCreditCost("quality", 8)} نقطة. نقاط الباقة لا ترحل بعد 30 يوم.
          </p>

          <div className="mx-auto mt-5 grid max-w-3xl gap-2 text-right sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card/80 p-3 text-xs leading-5 text-muted-foreground">
              <BadgeCheck className="mb-2 h-4 w-4 text-success" /> المدفوع بدون علامة مائية وقابل للنشر باسم متجرك.
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-3 text-xs leading-5 text-muted-foreground">
              <Film className="mb-2 h-4 w-4 text-primary" /> صورة المنتج مطلوبة في المدفوع لتقليل النتائج العامة.
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-3 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mb-2 h-4 w-4 text-success" /> {REFUND_GUARANTEE_LABEL} — جرّب دون قلق.
            </div>
          </div>

          <div className="mx-auto mt-5 flex min-h-[3.75rem] max-w-md items-center justify-center">
            <Suspense fallback={<div className="h-12 w-full rounded-xl border border-border bg-card/70" aria-hidden="true" />}>
              <SubscribersCounter />
            </Suspense>
          </div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card p-1.5">
            <button
              type="button"
              onClick={() => handleToggleAnnual(false)}
              className={cn("rounded-full px-4 py-1.5 text-sm font-bold transition", !yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              aria-pressed={!yearly}
            >
              شهري
            </button>
            <button
              type="button"
              onClick={() => handleToggleAnnual(true)}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition", yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              aria-pressed={yearly}
            >
              سنوي <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", yearly ? "bg-primary-foreground/20 text-primary-foreground" : "bg-success/25 text-success")}>وفّر {ANNUAL_DISCOUNT_PCT}%</span>
            </button>
          </div>

          {/* CTA رئيسي موحّد */}
          <div className="mt-5 inline-flex flex-col items-center gap-2">
            <Button
              asChild
              size="lg"
              className="gradient-primary font-extrabold text-primary-foreground shadow-elegant"
              onClick={() => handlePlanCta("hero_cta")}
            >
              <Link to="/auth" search={{ redirect: "/dashboard/billing" }}>
                <Sparkles className="ml-1 h-4 w-4" />
                ابدأ تجربتك بـ 1 ر.س — استرد كاملاً خلال 7 أيام
              </Link>
            </Button>
            <p className="text-[11px] font-bold text-muted-foreground">
              {REFUND_GUARANTEE_LABEL} · بدون التزام طويل
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-5">
            {PLAN_CATALOG.map((plan) => {
              const price = yearly ? plan.yearlyPriceSar : plan.monthlyPriceSar;
              const isPaid = price > 0;
              const isPopular = plan.tier === "popular";
              const isPremium = plan.tier === "premium" || plan.tier === "scale";
              const badge = "badge" in plan ? plan.badge : undefined;
              const cta = plan.id === "free" ? "ابدأ مجاناً" : `اشترك في ${plan.name}`;
              return (
                <article
                  key={plan.id}
                  className={cn(
                    "relative flex min-h-full flex-col rounded-2xl border bg-card p-5 shadow-soft",
                    isPopular && "border-2 border-primary bg-gradient-to-b from-primary/10 via-card to-card ring-2 ring-primary/15",
                    isPremium && "border-gold/50 bg-gradient-to-br from-gold/10 via-card to-card"
                  )}
                >
                  {badge && (
                    <div className={cn("absolute -top-3 right-4 rounded-full px-3 py-1 text-[11px] font-extrabold", isPopular ? "gradient-primary text-primary-foreground" : "gradient-gold text-gold-foreground")}>
                      {badge}
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-extrabold">{plan.name}</h2>
                      <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{plan.tagline}</p>
                    </div>
                    {isPopular ? <Sparkles className="h-5 w-5 text-primary" /> : isPremium ? <Crown className="h-5 w-5 text-gold" /> : <Rocket className="h-5 w-5 text-muted-foreground" />}
                  </div>

                  <div className="mt-5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-extrabold tracking-normal">{price}</span>
                      <span className="text-xs text-muted-foreground">ر.س / {yearly ? "سنوياً" : "شهرياً"}</span>
                    </div>
                    {"launchBadge" in plan && plan.launchBadge && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                        <Sparkles className="h-3 w-3" /> {LAUNCH_BADGE_LABEL}
                      </span>
                    )}
                    {yearly && plan.monthlyPriceSar > 0 && (
                      <p className="mt-1 text-xs font-bold text-success">
                        وفّر {(plan.monthlyPriceSar * 12 - plan.yearlyPriceSar).toLocaleString("ar-SA")} ر.س سنوياً
                      </p>
                    )}
                  </div>

                  <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-primary">
                      <Zap className="h-4 w-4" /> {formatPlanNumber(plan.monthlyCredits)} نقطة فيديو
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p>{plan.videoFastAllowed ? `سريع: ${videoCreditCost("fast", 5).toLocaleString("ar-SA")} نقطة` : "الفيديو غير متاح"}</p>
                      <p>{plan.videoQualityAllowed ? `احترافي: ${videoCreditCost("quality", 8).toLocaleString("ar-SA")} نقطة` : `إعلاني: ${videoCreditCost("lite", 8).toLocaleString("ar-SA")} نقطة`}</p>
                      <p className="font-bold text-foreground">تقريبياً: {formatPlanNumber(Math.floor(plan.monthlyCredits / videoCreditCost("fast", 5)))} سريع أو {formatPlanNumber(Math.floor(plan.monthlyCredits / videoCreditCost("lite", 8)))} إعلاني</p>
                    </div>
                  </div>

                  <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                    {planFeatures(plan).map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className={cn("mt-0.5 h-4 w-4 shrink-0", isPremium ? "text-gold" : "text-success")} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    className={cn("mt-5 w-full font-bold", isPopular && "gradient-primary text-primary-foreground shadow-elegant", isPremium && "gradient-gold text-gold-foreground shadow-gold")}
                    variant={plan.id === "free" ? "outline" : "default"}
                    onClick={() => handlePlanCta(plan.id)}
                  >
                    <Link to={plan.id === "free" ? "/auth" : ctaTarget} search={plan.id === "free" ? { redirect: "/onboarding/wizard" } : undefined as never}>
                      {cta} <ArrowLeft className="mr-1 h-4 w-4" />
                    </Link>
                  </Button>
                  {plan.id !== "free" && (
                    <p className="mt-2 flex items-center justify-center gap-1 text-[11px] font-bold text-success">
                      <ShieldCheck className="h-3 w-3" /> {REFUND_GUARANTEE_LABEL}
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h2 className="mt-3 font-extrabold">لا وعود غير محدودة للفيديو</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">نقاط الفيديو تجعل التكلفة واضحة وتحافظ على جودة الخدمة وسرعة التنفيذ.</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <Gift className="h-6 w-6 text-gold" />
              <h2 className="mt-3 font-extrabold">نقاط شهرية لا تتراكم</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">رصيد الباقة يتجدد كل 30 يوم، والمتبقي لا يرحل حتى تبقى التكلفة واضحة ومستدامة.</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <Star className="h-6 w-6 text-success" />
              <h2 className="mt-3 font-extrabold">فرق واضح بين المجاني والمدفوع</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">المجاني للتجربة بعلامة رِفد، والمدفوع لفيديوهات نظيفة مع صورة منتج إلزامية لنتائج أقرب للإعلان الحقيقي.</p>
            </div>
          </div>

          <div className="mt-10">
            <Suspense fallback={null}>
              <TrustBadges items={6} />
            </Suspense>
          </div>
        </div>
      </section>

      <SaudiTestimonials />

      <section className="border-t border-border bg-secondary/30 py-14">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-extrabold">أسئلة شائعة</h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group rounded-xl border border-border bg-card p-4 open:shadow-soft">
                <summary className="cursor-pointer list-none font-bold">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-primary transition-transform group-open:rotate-45">＋</span>
                    {f.q}
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
