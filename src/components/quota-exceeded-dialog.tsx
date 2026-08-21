/**
 * نافذة موحَّدة للأخطاء عند نفاد الحصة/الرصيد.
 * تُميّز بين 3 حالات:
 *   1) text_quota_exceeded — استنفدت حصة النص اليومية → CTA: ارجع غداً + ترقية
 *   2) image_quota_exceeded — استنفدت حصة الصور اليومية → CTA: ترقية
 *   3) insufficient_credits — رصيد نقاط الفيديو لا يكفي → CTA: شحن /dashboard/credits
 */

import { Link } from "@tanstack/react-router";
import { Crown, Sparkles, X, Coins, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { VIDEO_QUALITY_LABELS, videoCreditCost } from "@/lib/plan-catalog";

export type QuotaErrorKind = "text_quota" | "image_quota" | "insufficient_credits" | "free_monthly_video" | "plan_quota" | "unknown";

export function detectQuotaError(message: string): QuotaErrorKind | null {
  if (!message) return null;
  const m = message.toLowerCase();

  // كودات السيرفر (credits.ts + RPC)
  if (/free_monthly_video_quota_exceeded/i.test(message)) return "free_monthly_video";
  if (/text_quota_exceeded/i.test(message)) return "text_quota";
  if (/image_quota_exceeded/i.test(message)) return "image_quota";
  if (/insufficient_credits/i.test(message)) return "insufficient_credits";
  // صيغة quota_exceeded القديمة — نبقيها كتوافق خلفي لرسائل محفوظة/قديمة لا كتريجر نشط.
  if (/quota_exceeded:\s*plan=.*kind=text/i.test(message)) return "text_quota";
  if (/quota_exceeded:\s*plan=.*kind=image/i.test(message)) return "image_quota";

  // أنماط عربية قديمة
  if (
    message.includes("استنفدت توليدات النص") ||
    message.includes("الحصة اليومية") ||
    message.includes("نفدت حصة النصوص") ||
    message.includes("حد النصوص اليومي")
  ) {
    return "text_quota";
  }
  if (
    message.includes("رصيد نقاط الفيديو لا يكفي") ||
    message.includes("رصيد النقاط لا يكفي") ||
    message.includes("النقاط غير كافية") ||
    (m.includes("لا يكفي") && (m.includes("نقاط") || m.includes("نقطة"))) ||
    message.includes("نقاطك")
  ) {
    return "insufficient_credits";
  }
  if (
    message.includes("وصلت حدّ") ||
    message.includes("وصلت حد") ||
    message.includes("الباقة الاحترافية فقط") ||
    message.includes("رقّ باقتك") ||
    message.includes("رقي باقتك")
  ) {
    return generationKindFromMessage(message) === "image" ? "image_quota" : "plan_quota";
  }
  return null;
}

/** للحفاظ على التوافق مع الاستدعاءات القديمة */
export function isQuotaError(message: string): boolean {
  return detectQuotaError(message) !== null;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** نوع التوليد للسياق */
  kind: "نص" | "صورة" | "فيديو";
  /** رسالة الخطأ الأصلية من السيرفر */
  reason?: string;
};

type Variant = {
  icon: typeof Crown;
  title: string;
  subtitle: string;
  badge: string;
  cta: { label: string; to: "/dashboard/credits" | "/dashboard/billing" };
  benefits: string[];
};

function generationKindFromMessage(message: string): "image" | "text" | "unknown" {
  if (message.includes("صورة") || /image/i.test(message)) return "image";
  if (message.includes("نص") || /text/i.test(message)) return "text";
  return "unknown";
}

function getVariant(kindOfError: QuotaErrorKind, generationKind: "نص" | "صورة" | "فيديو"): Variant {
  if (kindOfError === "free_monthly_video") {
    return {
      icon: Crown,
      title: "استخدمت فيديو الشهر المجاني",
      subtitle: "الباقة المجانية تمنحك فيديو سريع واحد كل شهر. ارقَّ الآن بسعر الإطلاق لتوليد فيديوهات بلا علامة مائية حسب رصيد نقاطك الشهري.",
      badge: "✦ سعر الإطلاق متاح + ضمان 7 أيام استرداد كامل",
      cta: { label: "ترقّ لباقة فيديو بالنقاط", to: "/dashboard/billing" },
      benefits: [
        "فيديوهات بحسب رصيد نقاطك الشهري بدون قيد عدد",
        "بدون علامة مائية + قابل للنشر باسم متجرك",
        "صور Pro للحملات (Growth وأعلى)",
        "ضمان 7 أيام استرداد كامل بدون أسئلة",
      ],
    };
  }

  if (kindOfError === "text_quota") {
    return {
      icon: Clock,
      title: "وصلت حدّك للنصوص",
      subtitle: "وصلت سقف النصوص في باقتك. باقتك المجانية تتجدّد شهرياً، والمدفوعة تتجدّد يومياً بتوقيت الرياض.",
      badge: "💡 احفظ القوالب المفضّلة في مكتبتك لاستخدامها لاحقاً",
      cta: { label: "ترقية لباقة بحدود أعلى", to: "/dashboard/billing" },
      benefits: [
        "حدود نصوص أعلى مع تجديد يومي في الباقات المدفوعة",
        "النصوص لا تخصم من نقاط الفيديو",
        "مكتبة قوالب موسّعة + حفظ المفضّلة",
        "دعم واتساب مباشر",
      ],
    };
  }

  if (kindOfError === "image_quota") {
    return {
      icon: Clock,
      title: "وصلت حدّك للصور",
      subtitle: "وصلت سقف الصور في باقتك. الباقة المجانية تتجدّد شهرياً (3 صور)، والباقات المدفوعة تتجدّد يومياً بتوقيت الرياض.",
      badge: "💡 الصور لا تخصم من نقاط الفيديو — حدودها مستقلة",
      cta: { label: "ترقية لباقة بصور يومية أعلى", to: "/dashboard/billing" },
      benefits: [
        "حدود صور يومية في الباقات المدفوعة",
        "صور Pro للمظهر الإعلاني الأقوى (Growth+)",
        "كل النتائج محفوظة في مكتبتك",
        "دعم واتساب مباشر",
      ],
    };
  }

  if (kindOfError === "insufficient_credits") {
    return {
      icon: Coins,
      title: "اشحن نقاط فيديو الآن",
      subtitle: `لا توقف حملتك. اشحن نقاط فيديو إضافية فوراً وأكمل التوليد: ${VIDEO_QUALITY_LABELS.fast} بـ${videoCreditCost("fast", 5)} نقطة، ${VIDEO_QUALITY_LABELS.lite} بـ${videoCreditCost("lite", 8)} نقطة، و${VIDEO_QUALITY_LABELS.quality} بـ${videoCreditCost("quality", 8)} نقطة.`,
      badge: "⚡ نقاط الشحن الإضافية لا ترحل مع تجدّد الباقة الشهرية",
      cta: { label: "اشحن نقاط فيديو الآن", to: "/dashboard/credits" },
      benefits: [
        "تفعيل خلال 24 ساعة من رفع الإيصال",
        "نقاط الشحن لا تنتهي مع تجدّد الباقة",
        "النصوص والصور لا تخصم من رصيدك",
        "سجل نقاط واضح + إيصال لكل عملية",
      ],
    };
  }

  // plan_quota — حد الباقة (شهري للمجاني / يومي للمدفوع)
  return {
    icon: Crown,
    title: "وصلت حدّ باقتك الحالية",
    subtitle:
      generationKind === "صورة"
        ? "وصلت سقف الصور المتاح في باقتك — ارقَّ لباقة بسعر الإطلاق لحدود أعلى."
        : "وصلت سقف توليد النصوص في باقتك — ارقَّ لباقة بسعر الإطلاق لحدود أعلى.",
    badge: "✦ سعر الإطلاق متاح الآن — استرداد كامل خلال 7 أيام",
    cta: { label: "ترقّ باقتك الآن", to: "/dashboard/billing" },
    benefits: [
      "حدود نصوص وصور أعلى مع تجديد يومي",
      "نقاط الفيديو منفصلة وواضحة",
      "مكتبة قوالب كاملة + حفظ المفضلة",
      "ضمان 7 أيام استرداد كامل بدون أسئلة",
    ],
  };
}

export function QuotaExceededDialog({ open, onOpenChange, kind, reason }: Props) {
  const errorKind = reason ? (detectQuotaError(reason) ?? "plan_quota") : "plan_quota";
  const variant = getVariant(errorKind, kind);
  const Icon = variant.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        {/* Top gradient banner */}
        <div className="relative gradient-primary px-6 pb-6 pt-8 text-center text-primary-foreground">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute left-3 top-3 rounded-full p-1 opacity-70 transition hover:opacity-100"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-foreground/15 backdrop-blur">
            <Icon className="h-7 w-7" />
          </div>
          <DialogTitle className="text-xl font-extrabold">{variant.title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-primary-foreground/90">
            {variant.subtitle}
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-5">
          {reason && errorKind === "unknown" && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{reason}</span>
            </div>
          )}

          <ul className="space-y-2.5 text-sm">
            {variant.benefits.map((b) => (
              <BenefitRow key={b} text={b} />
            ))}
          </ul>

          <div className="mt-5 rounded-lg border border-gold/30 bg-gold/5 p-3 text-center">
            <p className="text-xs font-bold text-gold">{variant.badge}</p>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Button
              asChild
              className="w-full gradient-primary text-primary-foreground shadow-elegant"
              onClick={() => onOpenChange(false)}
            >
              <Link to={variant.cta.to}>
                <Sparkles className="h-4 w-4" />
                {variant.cta.label}
              </Link>
            </Button>
            <button
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              لاحقاً
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BenefitRow({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-foreground">
      <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-success/15 text-[10px] text-success">
        ✓
      </span>
      <span>{text}</span>
    </li>
  );
}
