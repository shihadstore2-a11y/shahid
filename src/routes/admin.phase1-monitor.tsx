import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  MailOpen,
  MousePointerClick,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getPhase1Monitor, type Phase1Monitor } from "@/server/admin-phase1-monitor";
import { PhaseProgressBanner } from "@/components/phase-progress-banner";

export const Route = createFileRoute("/admin/phase1-monitor")({
  beforeLoad: adminBeforeLoad,
  head: () => ({
    meta: [{ title: "مراقبة المرحلة 1 — رِفد" }],
  }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل مراقبة المرحلة 1…">
      <Phase1MonitorPage />
    </AdminGuard>
  ),
});

const REFRESH_INTERVAL_MS = 60_000;

function fmtDate(s: string) {
  return new Date(s).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });
}

function MetricCard({
  title,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
  icon: typeof Users;
}) {
  const toneCls = {
    default: "border-border bg-card",
    success: "border-success/40 bg-gradient-to-br from-success/10 to-transparent",
    warning: "border-warning/40 bg-gradient-to-br from-warning/10 to-transparent",
    danger: "border-destructive/40 bg-gradient-to-br from-destructive/10 to-transparent",
  }[tone];
  const iconCls = {
    default: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];
  return (
    <div className={cn("rounded-2xl border-2 p-5 shadow-soft", toneCls)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground">{title}</span>
        <Icon className={cn("h-4 w-4", iconCls)} />
      </div>
      <div className="mt-2 text-3xl font-extrabold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Phase1MonitorPage() {
  const fetchMonitor = useServerFn(getPhase1Monitor);
  const [data, setData] = useState<Phase1Monitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      setRefreshing(true);
      const res = await fetchMonitor();
      setData(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذّر تحميل البيانات";
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-primary">المرحلة 1 · المراقبة الحية</p>
          <h1 className="mt-1 text-2xl font-extrabold">مراقبة الإطلاق — أول 7 أيام</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تحديث تلقائي كل 60 ثانية. اتخذ قرار kill-switch فوراً عند تجاوز عتبات الـrefund أو فشل المزود.
          </p>
        </div>
        <Button onClick={() => void load()} disabled={refreshing} variant="outline" size="sm">
          {refreshing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />}
          تحديث
        </Button>
      </div>

      {loading || !data ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <PhaseProgressBanner
            phaseLabel="المرحلة 1 · رِفد"
            phaseTitle="جاهزية الإطلاق + Onboarding + الاحتفاظ"
            pillars={[
              {
                key: "refund",
                label: "ثبات المنتج (Refund)",
                value: Math.max(0, 100 - data.refund.refund_rate_pct * (100 / data.refund.target_pct)),
                target: 100,
                hint: `معدل الاسترداد ${data.refund.refund_rate_pct}% — الهدف < ${data.refund.target_pct}%`,
              },
              {
                key: "fallback",
                label: "نجاح الـFallback",
                value: data.fallbacks.fallback_success_rate_pct,
                target: 95,
                hint: `${data.fallbacks.successful_fallback}/${data.fallbacks.jobs_with_fallback} مهمة استعادت تلقائياً`,
              },
              {
                key: "wizard",
                label: "إكمال الـWizard (Wave B)",
                value: data.wave_b.completion_rate_pct,
                target: 75,
                hint: `${data.wave_b.onboarding_completed_7d}/${data.wave_b.onboarding_started_7d} أكملوا الإعداد خلال 7 أيام`,
              },
              {
                key: "first_win",
                label: "أول إنجاز (شارة)",
                value: data.wave_b.badges_24h.first_text + data.wave_b.badges_24h.first_image,
                target: Math.max(1, data.wave_b.onboarding_completed_7d),
                hint: `${data.wave_b.badges_24h.first_text + data.wave_b.badges_24h.first_image} شارة أولى مُنحت في 24س`,
              },
              {
                key: "conversion",
                label: "تحويل Free → Paid",
                value: data.conversion.conversion_rate_pct,
                target: 5,
                hint: `${data.conversion.paid_users} مدفوع من ${data.conversion.free_users + data.conversion.paid_users}`,
              },
              {
                key: "launch_bonus",
                label: "مكافأة الإطلاق",
                value: data.launch_bonus.total_granted,
                target: data.launch_bonus.cap,
                hint: `${data.launch_bonus.total_granted}/${data.launch_bonus.cap} مقعد مُفعّل`,
              },
            ]}
          />

          {/* المرحلة 2 — Wave C: التحويل والنمو */}
          <PhaseProgressBanner
            phaseLabel="المرحلة 2 · التحويل والنمو"
            phaseTitle="Wave C1 — تحسين صفحة الأسعار"
            pillars={[
              {
                key: "pricing_views",
                label: "زيارات الأسعار (7 أيام)",
                value: data.wave_c1.total_views,
                target: Math.max(50, data.wave_c1.total_views || 50),
                hint: `${data.wave_c1.total_views} مشاهدة — وعي بالباقات`,
              },
              {
                key: "pricing_cta_ctr",
                label: "نقر CTA رئيسي",
                value: data.wave_c1.cta_click_rate_pct,
                target: 18,
                hint: `${data.wave_c1.cta_click_rate_pct}% ضغطوا CTA — الهدف ≥18%`,
              },
              {
                key: "annual_share",
                label: "حصة السنوي",
                value: data.wave_c1.annual_share_pct,
                target: 25,
                hint: `${data.wave_c1.annual_share_pct}% فعّلوا السنوي — الهدف ≥25%`,
              },
              {
                key: "conversions_7d",
                label: "تحويلات (7 أيام)",
                value: data.wave_c1.conversions,
                target: Math.max(5, Math.round((data.wave_c1.total_views || 1) * 0.05)),
                hint: `${data.wave_c1.conversions} مشترك · أكثر باقة: ${data.wave_c1.top_plan}`,
              },
            ]}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="معدل الـRefund (24س)"
              value={`${data.refund.refund_rate_pct}%`}
              hint={`${data.refund.refunded_jobs} من ${data.refund.total_jobs} مهمة — الهدف < ${data.refund.target_pct}%`}
              tone={data.refund.is_healthy ? "success" : "danger"}
              icon={data.refund.is_healthy ? CheckCircle2 : AlertTriangle}
            />
            <MetricCard
              title="نجاح الـFallback"
              value={`${data.fallbacks.fallback_success_rate_pct}%`}
              hint={`${data.fallbacks.successful_fallback}/${data.fallbacks.jobs_with_fallback} مهمة استعادت بمزوّد بديل`}
              tone={data.fallbacks.fallback_success_rate_pct >= 95 ? "success" : "warning"}
              icon={Zap}
            />
            <MetricCard
              title="تحويل Free → Paid"
              value={`${data.conversion.conversion_rate_pct}%`}
              hint={`${data.conversion.paid_users.toLocaleString("ar-SA")} مدفوع · ${data.conversion.free_users.toLocaleString("ar-SA")} مجاني`}
              tone={data.conversion.conversion_rate_pct >= 5 ? "success" : "warning"}
              icon={TrendingUp}
            />
            <MetricCard
              title="مكافأة الإطلاق (50pt)"
              value={`${data.launch_bonus.total_granted}/${data.launch_bonus.cap}`}
              hint={`${data.launch_bonus.remaining} مقعد متبقٍ — تُمنح تلقائياً عند تفعيل أول 100 مشترك مدفوع`}
              tone={data.launch_bonus.remaining > 0 ? "success" : "default"}
              icon={Award}
            />
          </div>

          {/* Wave C1 — Pricing Funnel */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="مشاهدات /pricing (7 أيام)"
              value={data.wave_c1.total_views.toLocaleString("ar-SA")}
              hint={`أكثر باقة طلباً: ${data.wave_c1.top_plan}`}
              tone="default"
              icon={TrendingUp}
            />
            <MetricCard
              title="نقر CTA رئيسي"
              value={`${data.wave_c1.cta_click_rate_pct}%`}
              hint={`${data.wave_c1.cta_clicks} نقرة — الهدف ≥18%`}
              tone={data.wave_c1.cta_click_rate_pct >= 18 ? "success" : "warning"}
              icon={Zap}
            />
            <MetricCard
              title="حصة السنوي"
              value={`${data.wave_c1.annual_share_pct}%`}
              hint={`${data.wave_c1.annual_toggles} زائر فعّل التبديل — الهدف ≥25%`}
              tone={data.wave_c1.annual_share_pct >= 25 ? "success" : "warning"}
              icon={Award}
            />
            <MetricCard
              title="تحويلات مدفوعة (7 أيام)"
              value={data.wave_c1.conversions.toLocaleString("ar-SA")}
              hint={`${data.wave_c1.plan_clicks} ضغطة على بطاقات الباقات`}
              tone={data.wave_c1.conversions > 0 ? "success" : "default"}
              icon={CheckCircle2}
            />
          </div>

          {/* Wave C2 — Activation Email Sequence */}
          <div className="mt-8">
            <PhaseProgressBanner
              phaseLabel="المرحلة 2 · Wave C2"
              phaseTitle="Wave C2 — سلسلة إيميلات التفعيل"
              loading={loading}
              pillars={[
                {
                  key: "sent",
                  label: "إجمالي الإرسال (30 يوم)",
                  value: data.wave_c2.totals.sent,
                  target: Math.max(50, data.wave_c2.totals.sent || 50),
                  hint: `${data.wave_c2.totals.sent} رسالة وصلت لطابور الإرسال`,
                },
                {
                  key: "open",
                  label: "Open Rate",
                  value: data.wave_c2.overall_open_rate_pct,
                  target: 40,
                  hint: `${data.wave_c2.overall_open_rate_pct}% فتحوا الإيميل — الهدف ≥40%`,
                },
                {
                  key: "click",
                  label: "Click Rate",
                  value: data.wave_c2.overall_click_rate_pct,
                  target: 12,
                  hint: `${data.wave_c2.overall_click_rate_pct}% نقروا CTA — الهدف ≥12%`,
                },
              ]}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="رسائل أُرسلت (30 يوم)"
                value={data.wave_c2.totals.sent.toLocaleString("ar-SA")}
                hint={`5 مراحل · Day 0/1/3/7/14`}
                tone="default"
                icon={Mail}
              />
              <MetricCard
                title="معدّل الفتح الإجمالي"
                value={`${data.wave_c2.overall_open_rate_pct}%`}
                hint={`${data.wave_c2.totals.opened} فتح — الهدف ≥40%`}
                tone={data.wave_c2.overall_open_rate_pct >= 40 ? "success" : "warning"}
                icon={MailOpen}
              />
              <MetricCard
                title="معدّل النقر الإجمالي"
                value={`${data.wave_c2.overall_click_rate_pct}%`}
                hint={`${data.wave_c2.totals.clicked} نقرة — الهدف ≥12%`}
                tone={data.wave_c2.overall_click_rate_pct >= 12 ? "success" : "warning"}
                icon={MousePointerClick}
              />
              <MetricCard
                title="مراحل نشطة"
                value={`${data.wave_c2.per_day.length}/5`}
                hint={`Segmentation حسب الشارات (نص/صورة/فيديو/متجر نشط)`}
                tone={data.wave_c2.per_day.length >= 3 ? "success" : "default"}
                icon={Award}
              />
            </div>

            {data.wave_c2.per_day.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-bold text-muted-foreground">
                  تفصيل لكل مرحلة (Day Marker)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-right text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-semibold">اليوم</th>
                        <th className="px-3 py-2 font-semibold">أُرسلت</th>
                        <th className="px-3 py-2 font-semibold">تُخطّيت</th>
                        <th className="px-3 py-2 font-semibold">فُتحت</th>
                        <th className="px-3 py-2 font-semibold">نُقرت</th>
                        <th className="px-3 py-2 font-semibold">Open %</th>
                        <th className="px-3 py-2 font-semibold">Click %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.wave_c2.per_day.map((d) => (
                        <tr key={d.day} className="border-b border-border/50 last:border-0">
                          <td className="px-3 py-2 font-bold text-foreground">Day {d.day}</td>
                          <td className="px-3 py-2 tabular-nums">{d.sent}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{d.skipped}</td>
                          <td className="px-3 py-2 tabular-nums">{d.opened}</td>
                          <td className="px-3 py-2 tabular-nums">{d.clicked}</td>
                          <td className={cn("px-3 py-2 tabular-nums font-bold", d.open_rate >= 40 ? "text-success" : "text-muted-foreground")}>
                            {d.open_rate}%
                          </td>
                          <td className={cn("px-3 py-2 tabular-nums font-bold", d.click_rate >= 12 ? "text-success" : "text-muted-foreground")}>
                            {d.click_rate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Wave C3 — Referrals + Annual Upgrade */}
          <div className="mt-8">
            <PhaseProgressBanner
              phaseLabel="المرحلة 2 · Wave C3"
              phaseTitle="Wave C3 — الإحالات والترقية السنوية"
              loading={loading}
              pillars={[
                {
                  key: "k",
                  label: "k-factor (إحالات/مستخدم)",
                  value: data.wave_c3.k_factor * 100,
                  target: 30,
                  hint: `k=${data.wave_c3.k_factor} — الهدف ≥0.30`,
                },
                {
                  key: "qualified",
                  label: "إحالات مؤهّلة (ترقّت)",
                  value: data.wave_c3.referrals_qualified,
                  target: Math.max(5, data.wave_c3.referrals_total || 5),
                  hint: `${data.wave_c3.referrals_qualified}/${data.wave_c3.referrals_total} ترقّت لباقة مدفوعة`,
                },
                {
                  key: "annual",
                  label: "ترقيات سنوية من العرض",
                  value: data.wave_c3.annual_upgrade_upgraded,
                  target: Math.max(3, data.wave_c3.annual_upgrade_shown || 3),
                  hint: `${data.wave_c3.annual_upgrade_clicked} نقرة من ${data.wave_c3.annual_upgrade_shown} عرض`,
                },
              ]}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="أكواد إحالة نشطة" value={data.wave_c3.active_codes.toLocaleString("ar-SA")} hint="مستخدمون ولّدوا كودهم" tone="default" icon={Users} />
              <MetricCard title="إحالات (30 يوم)" value={data.wave_c3.referrals_total.toLocaleString("ar-SA")} hint={`${data.wave_c3.referrals_qualified} مؤهّلة`} tone={data.wave_c3.referrals_qualified > 0 ? "success" : "default"} icon={Award} />
              <MetricCard title="k-factor" value={data.wave_c3.k_factor.toFixed(2)} hint="الهدف ≥0.30" tone={data.wave_c3.k_factor >= 0.3 ? "success" : "warning"} icon={TrendingUp} />
              <MetricCard title="ترقيات سنوية CTR" value={`${data.wave_c3.annual_click_rate_pct}%`} hint={`${data.wave_c3.annual_upgrade_upgraded} اشتركوا سنوياً`} tone={data.wave_c3.annual_click_rate_pct > 0 ? "success" : "default"} icon={Zap} />
            </div>
          </div>

          {/* Providers status */}
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">حالة المزودين والـKill-switch</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">المزوّد</th>
                    <th className="px-3 py-2 font-semibold">الأولوية</th>
                    <th className="px-3 py-2 font-semibold">الحالة</th>
                    <th className="px-3 py-2 font-semibold">نجاح/فشل (24س)</th>
                    <th className="px-3 py-2 font-semibold">معدل الفشل</th>
                    <th className="px-3 py-2 font-semibold">Kill-switch</th>
                  </tr>
                </thead>
                <tbody>
                  {data.providers.map((p) => (
                    <tr key={p.provider} className="border-b border-border/40">
                      <td className="px-3 py-2 font-bold">{p.provider}</td>
                      <td className="px-3 py-2 tabular-nums">{p.priority}</td>
                      <td className="px-3 py-2">
                        {p.enabled ? (
                          <Badge className="bg-success/15 text-success">مفعّل</Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground">معطّل</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        <span className="text-success">{p.success_24h}</span>
                        {" / "}
                        <span className={p.fail_24h > 0 ? "text-destructive" : ""}>{p.fail_24h}</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        <span
                          className={cn(
                            p.fail_rate_pct >= 20
                              ? "font-bold text-destructive"
                              : p.fail_rate_pct >= 10
                              ? "text-warning"
                              : "text-muted-foreground"
                          )}
                        >
                          {p.fail_rate_pct}%
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {p.kill_switch_active ? (
                          <Badge className="bg-destructive/15 text-destructive">مُفعَّل ⚠</Badge>
                        ) : (
                          <Badge className="bg-success/15 text-success">سليم</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.providers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        لا توجد إعدادات مزوّدين بعد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top errors */}
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="mb-4 text-lg font-bold">أعلى 5 فئات أخطاء (24س)</h2>
            {data.top_errors.length === 0 ? (
              <p className="rounded-xl border border-success/30 bg-success/5 px-3 py-4 text-sm text-success">
                ✅ لا أخطاء مصنّفة في آخر 24 ساعة — استقرار ممتاز.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.top_errors.map((e) => (
                  <li
                    key={e.category}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <span className="font-bold">{e.category}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-extrabold tabular-nums text-foreground">{e.count}</span> حادثة · {e.pct}%
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Wave B — Onboarding Funnel & Badges */}
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Wave B — Onboarding & First-Win (آخر 7 أيام)</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="بدأ الـWizard"
                value={data.wave_b.onboarding_started_7d.toLocaleString("ar-SA")}
                hint="عدد المستخدمين الذين فتحوا /onboarding/wizard"
                icon={Users}
              />
              <MetricCard
                title="أكمل الـWizard"
                value={`${data.wave_b.completion_rate_pct}%`}
                hint={`${data.wave_b.onboarding_completed_7d}/${data.wave_b.onboarding_started_7d} — الهدف ≥ 75%`}
                tone={data.wave_b.completion_rate_pct >= 75 ? "success" : "warning"}
                icon={CheckCircle2}
              />
              <MetricCard
                title="First-Win (24س)"
                value={(
                  data.wave_b.badges_24h.first_text +
                  data.wave_b.badges_24h.first_image +
                  data.wave_b.badges_24h.first_video
                ).toLocaleString("ar-SA")}
                hint={`نص ${data.wave_b.badges_24h.first_text} · صورة ${data.wave_b.badges_24h.first_image} · فيديو ${data.wave_b.badges_24h.first_video}`}
                tone="success"
                icon={Zap}
              />
              <MetricCard
                title="متجر نشط (24س)"
                value={data.wave_b.badges_24h.active_store.toLocaleString("ar-SA")}
                hint="نص + صورة + فيديو خلال 24 ساعة"
                tone="success"
                icon={Award}
              />
            </div>
            {data.wave_b.funnel.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-right text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-semibold">الخطوة</th>
                      <th className="px-3 py-2 font-semibold">بدأوا</th>
                      <th className="px-3 py-2 font-semibold">أكملوا</th>
                      <th className="px-3 py-2 font-semibold">نسبة الإكمال</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.wave_b.funnel.map((row) => (
                      <tr key={row.step} className="border-b border-border/40">
                        <td className="px-3 py-2 font-bold">الخطوة {row.step}</td>
                        <td className="px-3 py-2 tabular-nums">{row.users_started.toLocaleString("ar-SA")}</td>
                        <td className="px-3 py-2 tabular-nums">{row.users_completed.toLocaleString("ar-SA")}</td>
                        <td className="px-3 py-2 tabular-nums">
                          <span className={cn(row.completion_rate_pct >= 75 ? "text-success" : "text-warning", "font-bold")}>
                            {row.completion_rate_pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            آخر تحديث: {fmtDate(data.generated_at)} · النافذة: آخر {data.window_hours} ساعة.
          </p>
        </>
      )}
    </DashboardShell>
  );
}
