/**
 * شريط الرصيد — يظهر في رأس الداشبورد.
 * يعرض: إجمالي نقاط الفيديو (plan + topup) + حصص النص والصورة اليومية + CTA للشحن.
 *
 * متجاوب:
 * - Desktop: شريط أفقي مع تفاصيل كاملة.
 * - Tablet: نسخة مضغوطة بدون نص النص اليومي.
 * - Mobile: زر صغير يفتح Popover بالتفاصيل.
 */
import { Link } from "@tanstack/react-router";
import { Coins, Plus, Loader2, AlertTriangle, Info } from "lucide-react";
import { useCreditsSummary } from "@/hooks/use-credits-summary";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { VIDEO_QUALITY_LABELS } from "@/lib/plan-catalog";

const PLAN_LABEL: Record<string, string> = {
  free: "مجاني",
  starter: "بداية",
  growth: "نمو",
  pro: "احترافي",
  business: "أعمال",
};

function formatNum(n: number) {
  return n.toLocaleString("ar-SA");
}

function pct(used: number, cap: number) {
  if (!cap) return 0;
  return Math.min(100, Math.round((used / cap) * 100));
}

export function CreditsBar() {
  const { data, loading } = useCreditsSummary();

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>جاري التحميل…</span>
      </div>
    );
  }

  if (!data) return null;

  const total = data.totalCredits;
  const lowCredits = total < 50;
  const textPct = pct(data.dailyTextUsed, data.dailyTextCap);
  const imagePct = pct(data.dailyImageUsed, data.dailyImageCap);
  const textNearLimit = textPct >= 80;
  const imageNearLimit = imagePct >= 80;
  const planLabel = PLAN_LABEL[data.plan] ?? data.plan;

  // ---- Trigger (mobile/tablet/desktop) ----
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="رصيد نقاط الفيديو"
          className={cn(
            "flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-bold transition hover:border-primary/50 hover:bg-secondary",
            lowCredits && "border-destructive/40 bg-destructive/5 text-destructive",
            !lowCredits && "text-foreground"
          )}
        >
          <Coins className="h-3.5 w-3.5" />
          <span className="tabular-nums">{formatNum(total)}</span>
          <span className="hidden text-muted-foreground sm:inline">نقطة فيديو</span>
          {(lowCredits || textNearLimit || imageNearLimit) && (
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[min(20rem,calc(100vw-1.5rem))] p-0">
        {/* Header */}
        <div className="rounded-t-md gradient-primary px-4 py-3 text-primary-foreground">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium opacity-80">رصيدك الحالي</span>
            <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-bold">
              باقة {planLabel}
            </span>
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums">
            {formatNum(total)}{" "}
            <span className="text-sm font-medium opacity-80">نقطة فيديو</span>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-3 p-4">
          {/* Plan vs Topup breakdown */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border bg-secondary/30 p-2.5">
              <p className="text-[10px] text-muted-foreground">من الباقة</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">
                {formatNum(data.planCredits)}
              </p>
            </div>
            <div className="rounded-md border border-border bg-secondary/30 p-2.5">
              <p className="text-[10px] text-muted-foreground">شحن إضافي</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">
                {formatNum(data.topupCredits)}
              </p>
            </div>
          </div>

          {/* Daily operational usage */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">استخدامك اليومي للنصوص</span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  textNearLimit ? "text-warning-foreground" : "text-foreground"
                )}
              >
                {formatNum(data.dailyTextUsed)} / {formatNum(data.dailyTextCap)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  textNearLimit ? "bg-warning" : "bg-primary"
                )}
                style={{ width: `${textPct}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">استخدامك اليومي للصور</span>
              <span className={cn("font-bold tabular-nums", imageNearLimit ? "text-warning-foreground" : "text-foreground")}>
                {formatNum(data.dailyImageUsed)} / {formatNum(data.dailyImageCap)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full transition-all", imageNearLimit ? "bg-warning" : "bg-primary")}
                style={{ width: `${imagePct}%` }}
              />
            </div>
          </div>

          {/* Costs hint */}
          <div className="flex items-start gap-1.5 rounded-md bg-muted/40 p-2 text-[10px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              فيديو {VIDEO_QUALITY_LABELS.fast}: {data.costs.video_fast} نقطة · {VIDEO_QUALITY_LABELS.lite}: {data.costs.video_lite_8s} نقطة · {VIDEO_QUALITY_LABELS.quality}: {data.costs.video_quality_8s} نقطة
            </span>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button asChild size="sm" className="w-full gap-1">
              <Link to="/dashboard/credits">
                <Plus className="h-3.5 w-3.5" />
                شحن
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to="/dashboard/billing">ترقية الباقة</Link>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
