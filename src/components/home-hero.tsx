import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clapperboard, PlayCircle, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVariant, rememberAttribution, trackEvent } from "@/lib/ab-test";

const HERO_EXPERIMENT = "hero_hook" as const;

const capabilities = [
  "إعلان مدروس يفتح زاوية البيع",
  "وصف منتج يزيل التردد",
  "صورة تناسب السوق السعودي",
  "سكربت فيديو قصير",
  "منشور عرض مباشر",
  "دعوة شراء واضحة",
  "فيديو إعلاني قوي لمنشورك",
] as const;

const proofItems = [
  "عطر شتوي: هوك + وصف + فكرة ريلز",
  "عباية سوداء: منشور عرض + زاوية تصوير",
  "قهوة مختصة: نص إعلان + فكرة صورة",
  "إلكترونيات: وصف منتج + CTA",
  "هدايا: حملة موسمية + سكربت قصير",
  "عناية وبشرة: عرض + منشور + فكرة فيديو",
] as const;

const channelProof = ["سلة", "زد", "شوبيفاي", "Instagram", "Google Ads", "TikTok", "X", "Snapchat"] as const;

const marketSignals = ["نية شراء", "لهجة سعودية", "حساسية السعر", "مواسم محلية"] as const;

export function HomeHero() {
  const [variant, setVariant] = useState<"A" | "B">("A");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const resolvedVariant = getVariant(HERO_EXPERIMENT);
    setVariant(resolvedVariant);
    void trackEvent(HERO_EXPERIMENT, resolvedVariant, "view");
  }, []);

  const handleCtaClick = () => {
    rememberAttribution(HERO_EXPERIMENT, variant);
    void trackEvent(HERO_EXPERIMENT, variant, "cta_click");
  };

  return (
    <section className="relative overflow-hidden gradient-hero">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-gold/60 to-transparent" />

      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-7 sm:py-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:py-12">
        <div className="order-2 lg:order-1">
          <VideoProofCard />
        </div>

        <div className="order-1 text-center lg:order-2 lg:text-right">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-extrabold text-primary lg:mx-0">
            <Zap className="h-3.5 w-3.5" />
            محرك محتوى مبني على سلوك السوق السعودي
          </div>

          <div className="mx-auto mt-4 max-w-3xl lg:mx-0">
            <h1 className="text-[1.95rem] font-black leading-[1.14] tracking-normal sm:text-5xl lg:text-6xl">
              <span className="block">محتوى متجرك مبني على</span>
              <span className="mt-1 block text-gradient-primary">فهم المتسوق السعودي</span>
            </h1>
            <p className="mt-4 text-lg font-black leading-8 text-foreground sm:text-2xl sm:leading-10">
              نصوص، صور، وفيديوهات تبدو سعودية… وتدفع للشراء.
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-7 text-muted-foreground sm:text-base sm:leading-8 lg:mx-0">
              رِفد يحوّل فهم سلوك الشراء السعودي — الثقة، السعر، اللهجة، الموسم، وطريقة اتخاذ القرار — إلى محتوى عملي يساعد متجرك على البيع والإعلان بوضوح.
            </p>
          </div>

          <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2 lg:mx-0 lg:justify-start">
            {marketSignals.map((signal) => (
              <span key={signal} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-extrabold text-foreground/85 shadow-soft">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                {signal}
              </span>
            ))}
          </div>

          <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-border bg-background/65 p-3 shadow-soft lg:mx-0">
            <div className="mb-2 text-xs font-black text-primary">جاهز للنشر في متجرك وقنواتك الإعلانية</div>
            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              {channelProof.map((channel) => (
                <span key={channel} className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-extrabold text-foreground/90">
                  <bdi dir="auto">{channel}</bdi>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Button
              asChild
              size="lg"
              className="h-14 w-full max-w-[19rem] gap-2 gradient-gold text-base font-extrabold text-gold-foreground shadow-gold sm:w-auto sm:px-8"
            >
              <Link to="/auth" search={{ redirect: "/onboarding" }} onClick={handleCtaClick}>
                <Sparkles className="h-5 w-5" />
                جهّز أول حزمة محتوى
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 w-full max-w-[19rem] bg-background/70 font-extrabold sm:w-auto">
              <Link to="/proof-center">
                شاهد الإثبات
                <PlayCircle className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-4 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3 text-sm font-black leading-7 text-foreground shadow-soft lg:justify-start">
            <span>خطوتان فقط من وصف المتجر إلى:</span>
            {['منشور يبيع', 'صور تبيع', 'فيديو يبيع'].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-xs text-primary shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                {item}
              </span>
            ))}
          </div>

        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-6 lg:-mt-3 lg:pb-8">
        <CapabilitiesStrip />
      </div>

      <LiveProofTicker />
    </section>
  );
}

function VideoProofCard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideoVisibleRef = useRef(false);
  const hasReachedVideoRef = useRef(false);
  const userPausedRef = useRef(false);
  const programmaticPauseRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = "connection" in navigator && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    if (prefersReducedMotion || saveData) return;

    const playWhenReady = () => {
      if (!isVideoVisibleRef.current || !hasReachedVideoRef.current || userPausedRef.current) return;
      void video.play().catch(() => {
        // Some browsers may block autoplay; controls remain available.
      });
    };

    const markReachedAfterScroll = () => {
      if (window.scrollY <= 80) return;
      hasReachedVideoRef.current = true;
      playWhenReady();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVideoVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          playWhenReady();
          return;
        }

        programmaticPauseRef.current = true;
        video.pause();
      },
      { threshold: 0.45 }
    );

    const handleManualPause = () => {
      if (programmaticPauseRef.current) {
        programmaticPauseRef.current = false;
        return;
      }

      userPausedRef.current = true;
    };

    const handlePlay = () => {
      userPausedRef.current = false;
      programmaticPauseRef.current = false;
    };

    observer.observe(video);
    video.addEventListener("pause", handleManualPause);
    video.addEventListener("play", handlePlay);
    window.addEventListener("scroll", markReachedAfterScroll, { passive: true });
    markReachedAfterScroll();

    return () => {
      observer.disconnect();
      video.removeEventListener("pause", handleManualPause);
      video.removeEventListener("play", handlePlay);
      window.removeEventListener("scroll", markReachedAfterScroll);
    };
  }, []);

  return (
    <div className="relative mx-auto max-w-2xl lg:mx-0">
      <div className="absolute inset-0 -z-10 translate-y-4 rounded-[1.75rem] bg-primary/15 blur-2xl" aria-hidden />
      <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-elegant">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/45 px-4 py-3">
          <div>
            <div className="text-xs font-extrabold text-primary">شاهد رِفد في ثوانٍ</div>
            <div className="mt-1 text-sm font-black">من وصف بسيط إلى محتوى متجر جاهز</div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            فيديو
          </div>
        </div>
        <div className="aspect-video bg-background">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src="/rifd-promo.mp4"
            controls
            loop
            muted
            playsInline
            preload="metadata"
            poster="/og-image.jpg"
            aria-label="فيديو رِفد الذي يوضح كيف يساعد المتاجر السعودية في صناعة المحتوى"
          >
            متصفحك لا يدعم تشغيل الفيديو.
          </video>
        </div>
        <div className="grid grid-cols-3 border-t border-border bg-background/85 text-center text-[11px] font-extrabold text-foreground/85 sm:text-xs">
          <div className="border-l border-border px-2 py-3">نصوص</div>
          <div className="border-l border-border px-2 py-3">صور</div>
          <div className="px-2 py-3">فيديوهات</div>
        </div>
      </div>
    </div>
  );
}

function CapabilitiesStrip() {
  return (
    <div className="rounded-2xl border border-primary/15 bg-background/65 p-3 shadow-soft backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-center gap-2 text-xs font-black text-primary">
        <Clapperboard className="h-3.5 w-3.5" />
        من وصف متجرك إلى محتوى جاهز للبيع
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {capabilities.map((item) => (
          <span key={item} className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-foreground/85 shadow-soft sm:text-xs">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function LiveProofTicker() {
  const repeated = [...proofItems, ...proofItems, ...proofItems];

  return (
    <div className="border-y border-border bg-primary text-primary-foreground">
      <div className="flex items-center gap-3 overflow-hidden py-3">
        <div className="shrink-0 pe-1 ps-4 text-xs font-black sm:ps-6 sm:text-sm">الإثبات الحي</div>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="live-proof-marquee flex w-max items-center gap-3">
            {repeated.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1.5 text-xs font-bold text-primary-foreground/95 sm:text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}