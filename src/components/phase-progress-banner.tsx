/**
 * Phase Progress Banner — يعرض نسبة إنجاز المرحلة الحالية
 * بصرياً بالاعتماد على KPIs الفعلية من Phase1Monitor + ثوابت الخطة.
 *
 * الفرضية: المرحلة 1 تتكوّن من 5 محاور (Wave A ثبات + Wave B onboarding +
 * مكافأة الإطلاق + التحويل + جاهزية الـ wizard). يتم احتساب وزن متساوٍ
 * لكل محور وعرض شريط واحد يلخّص الموقف للمدير التنفيذي.
 *
 * يدعم Light/Dark + RTL + Mobile/Tablet/Desktop عبر Tailwind tokens فقط.
 */
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Pillar = {
  key: string;
  label: string;
  value: number; // 0-100
  target: number; // 0-100
  hint: string;
};

type Props = {
  phaseLabel: string;
  phaseTitle: string;
  pillars: Pillar[];
  loading?: boolean;
};

export function PhaseProgressBanner({ phaseLabel, phaseTitle, pillars, loading }: Props) {
  const overall =
    pillars.length === 0
      ? 0
      : Math.round(
          pillars.reduce((acc, p) => acc + Math.min(100, (p.value / Math.max(1, p.target)) * 100), 0) /
            pillars.length,
        );
  const safeOverall = Math.min(100, Math.max(0, overall));

  return (
    <section
      dir="rtl"
      className="mb-6 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5 shadow-soft sm:p-7"
      aria-label={`${phaseTitle} — نسبة الإنجاز ${safeOverall}%`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">{phaseLabel}</p>
          <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">{phaseTitle}</h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            تقدم تجميعي حسب أهداف KPIs المعتمدة في خطة المنتج.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-card px-4 py-2 shadow-soft">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <CheckCircle2 className="size-4 text-success" />
          )}
          <span className="text-2xl font-black tabular-nums text-foreground sm:text-3xl">
            {loading ? "—" : `${safeOverall}%`}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <Progress value={safeOverall} className="h-2.5" aria-label="نسبة إنجاز المرحلة" />
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.map((p) => {
          const ratio = Math.min(100, Math.round((p.value / Math.max(1, p.target)) * 100));
          const reached = p.value >= p.target;
          return (
            <li
              key={p.key}
              className={cn(
                "flex items-start gap-2 rounded-xl border p-3 text-xs",
                reached
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-muted/30",
              )}
            >
              {reached ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-bold text-foreground">{p.label}</span>
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                    {ratio}%
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{p.hint}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
