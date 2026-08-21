import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clapperboard, Coins, DollarSign, ExternalLink, FolderKanban, Loader2, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { VIDEO_QUALITY_LABELS } from "@/lib/plan-catalog";
import { listAdminVideoJobs, type AdminVideoJob, type AdminVideoStats } from "@/server/admin-video";

export const Route = createFileRoute("/admin/video-jobs")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "إدارة الفيديو والتكلفة — رِفد" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل إدارة الفيديو…">
      <AdminVideoJobsPage />
    </AdminGuard>
  ),
});

const STATUS_LABEL: Record<string, string> = {
  all: "كل الحالات",
  pending: "بانتظار المعالجة",
  processing: "قيد المعالجة",
  completed: "مكتمل",
  failed: "فشل",
  refunded: "تم رد النقاط",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  processing: "bg-warning/20 text-warning-foreground",
  completed: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  refunded: "bg-gold/15 text-gold",
};

function fmt(n: number) {
  return n.toLocaleString("ar-SA");
}

function fmtDate(s: string | null | undefined) {
  return s ? new Date(s).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function providerAttempts(metadata: AdminVideoJob["metadata"]) {
  const attempts = (metadata as { provider_attempts?: Array<{ provider?: string; ok?: boolean; status?: string; mode?: string; latency_ms?: number; error?: string; reason?: string; finished_at?: string }> } | null)?.provider_attempts;
  return Array.isArray(attempts) ? attempts.slice(-3) : [];
}

function jobMeta(metadata: AdminVideoJob["metadata"]) {
  return (metadata as { provider_mode?: string; manual_required?: boolean; provider_status?: string; failover_halted?: boolean; campaignId?: string; campaignPackId?: string; campaign_pack_id?: string; campaign_product?: string; campaign_channel?: string } | null) ?? {};
}

function campaignIdFromJob(job: AdminVideoJob) {
  const meta = jobMeta(job.metadata);
  return meta.campaignId ?? meta.campaignPackId ?? meta.campaign_pack_id;
}

function providerModeLabel(mode?: string, manualRequired?: boolean) {
  if (manualRequired) return "Bridge يدوي";
  if (mode === "bridge") return "Bridge";
  if (mode === "manual") return "يدوي";
  return "API";
}

function AdminVideoJobsPage() {
  const fetchJobs = useServerFn(listAdminVideoJobs);
  const [rows, setRows] = useState<AdminVideoJob[]>([]);
  const [stats, setStats] = useState<AdminVideoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"all" | "pending" | "processing" | "completed" | "failed" | "refunded">("all");
  const [search, setSearch] = useState("");

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("لا توجد جلسة");
    return { Authorization: `Bearer ${session.access_token}` };
  }

  async function load() {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const r = await fetchJobs({
        data: { status, limit: 150 },
        headers,
      });
      setRows(r.rows);
      setStats(r.stats);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحميل مهام الفيديو");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = rows.filter((row) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return row.user_email?.toLowerCase().includes(s) || row.user_store?.toLowerCase().includes(s) || row.id.toLowerCase().includes(s) || row.prompt.toLowerCase().includes(s) || jobMeta(row.metadata).campaign_product?.toLowerCase().includes(s);
  });

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <Clapperboard className="h-6 w-6 text-primary" /> إدارة الفيديو والتكلفة
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">مراقبة مهام الفيديو، حالة المزود، النقاط المستهلكة، والتكلفة التقديرية</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> تحديث
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/video-providers"><SlidersHorizontal className="h-4 w-4" /> مزودو الفيديو</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/credit-ledger"><Coins className="h-4 w-4" /> دفتر النقاط</Link>
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="إجمالي المهام" value={fmt(stats?.total ?? 0)} />
        <StatCard label="نشطة الآن" value={fmt((stats?.processing ?? 0) + (stats?.pending ?? 0))} tone="warning" />
        <StatCard label="مكتملة" value={fmt(stats?.completed ?? 0)} tone="success" />
        <StatCard label="مسترجعة" value={fmt(stats?.refunded ?? 0)} tone="gold" />
        <StatCard label="تكلفة العينة" value={`$${(stats?.estimatedCostUsd ?? 0).toFixed(2)}`} icon="cost" />
      </div>

      {stats?.softLaunch && <SoftLaunchMonitor stats={stats.softLaunch} />}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالبريد، المتجر، prompt أو job id…" className="pr-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">لا توجد مهام فيديو مطابقة.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {filtered.map((job) => (
              <article key={job.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_210px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn(STATUS_TONE[job.status] ?? "bg-muted")}>{STATUS_LABEL[job.status] ?? job.status}</Badge>
                    <span className="text-sm font-bold">{VIDEO_QUALITY_LABELS[job.quality]}</span>
                    <span className="text-xs text-muted-foreground">{job.aspect_ratio} · {job.duration_seconds}ث</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-foreground">{job.prompt}</p>
                  {job.error_message && <p className="mt-2 flex items-center gap-1 text-xs font-medium text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> {job.error_message}</p>}
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{job.user_store || job.user_email || job.user_id.slice(0, 8)}</span>
                    <span className="mx-1">·</span>
                    <span>{fmtDate(job.created_at)}</span>
                    {job.provider && <span className="mx-1">· {job.provider}</span>}
                    {job.provider_job_id && <span className="mx-1">· Provider ID: {job.provider_job_id.slice(0, 12)}</span>}
                    {job.completed_at && <span className="mx-1">· اكتمل: {fmtDate(job.completed_at)}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{providerModeLabel(jobMeta(job.metadata).provider_mode, jobMeta(job.metadata).manual_required)}</Badge>
                    {jobMeta(job.metadata).provider_status && <Badge variant="secondary">حالة المزود: {jobMeta(job.metadata).provider_status}</Badge>}
                    {jobMeta(job.metadata).failover_halted && <Badge className="bg-warning/20 text-warning-foreground">تم إيقاف البدائل بعد إنشاء مهمة خارجية</Badge>}
                    {job.result_url && <Badge className="bg-success/15 text-success">رابط النتيجة محفوظ</Badge>}
                    {job.storage_path && <Badge className="bg-primary/10 text-primary">مؤرشف داخلياً</Badge>}
                    {campaignIdFromJob(job) && <Badge className="bg-primary/10 text-primary">مرتبط بحملة: {jobMeta(job.metadata).campaign_product || "حملة محفوظة"}</Badge>}
                  </div>
                  <ProviderAttemptsPanel attempts={providerAttempts(job.metadata)} />
                  {job.result_url && (
                    <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
                      <a href={job.result_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> فتح الفيديو الناتج</a>
                    </Button>
                  )}
                  {campaignIdFromJob(job) && (
                    <Button type="button" variant="outline" size="sm" className="mt-3 me-2" asChild>
                      <Link to="/dashboard/campaign-studio" search={{ campaignId: campaignIdFromJob(job) } as never}><FolderKanban className="h-4 w-4" /> فتح الحملة</Link>
                    </Button>
                  )}
                  {job.status === "processing" && Boolean(jobMeta(job.metadata).manual_required) && (
                    <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
                      هذه مهمة قديمة من مسار الجسر اليدوي. المسار الجديد يعتمد PixVerse v6 فقط؛ اتركها للانتهاء التلقائي أو رد النقاط عبر آلية المهلة.
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-2">
                  <MiniMetric label="نقاط" value={fmt(job.credits_charged)} />
                  <MiniMetric label="تكلفة" value={`$${Number(job.estimated_cost_usd ?? 0).toFixed(2)}`} />
                  <MiniMetric label="Ledger" value={job.ledger_id ? job.ledger_id.slice(0, 8) : "—"} title={job.ledger_id ?? undefined} />
                  <MiniMetric label="Refund" value={job.refund_ledger_id ? job.refund_ledger_id.slice(0, 8) : "—"} title={job.refund_ledger_id ?? undefined} />
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function SoftLaunchMonitor({ stats }: { stats: AdminVideoStats["softLaunch"] }) {
  const progress = `${fmt(stats.sampleSize)}/${fmt(stats.targetSize)}`;
  const progressPercent = Math.max(0, Math.min(100, stats.progressPercent));
  const planCompletionPercent = Math.max(0, Math.min(100, stats.planCompletionPercent));
  const nextBatchProgressPercent = Math.max(0, Math.min(100, stats.nextBatchProgressPercent));
  const statusLabel = stats.readyForBeta ? "جاهز لقرار Beta" : stats.sampleSize < stats.targetSize ? "يجمع عينة" : "يحتاج مراجعة";

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={stats.readyForBeta ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground"}>{statusLabel}</Badge>
            <Badge className={stats.nextBatchReady ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}>{stats.nextBatchReady ? "الدفعة التالية جاهزة" : "أوقف الدفعة"}</Badge>
            <span className="text-xs font-bold text-muted-foreground">Soft Launch · أول 10 عمليات</span>
          </div>
          <h2 className="mt-2 text-lg font-extrabold">مراقبة الإطلاق المحدود</h2>
          <p className="mt-1 text-sm text-muted-foreground">تراقب أول 10 عمليات بعد إثبات إصلاح CDN وأرشفة النتائج داخلياً حتى لا تختلط عينة Beta بعمليات Legacy القديمة.</p>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>آخر فحص: {fmtDate(stats.checkedAt)}</div>
          {stats.rolloutStartedAt && <div>بداية العينة: {fmtDate(stats.rolloutStartedAt)}</div>}
        </div>
      </div>
      <div className="mt-4" aria-label={`نسبة تقدم Soft Launch ${progressPercent}%`}>
        <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold text-muted-foreground">
          <span>نسبة التقدم</span>
          <span className="tabular-nums text-foreground">{fmt(progressPercent)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
      <div className="mt-3" aria-label={`نسبة إنهاء الخطة ${planCompletionPercent}%`}>
        <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold text-muted-foreground">
          <span>إنهاء الخطة إلى Beta</span>
          <span className="tabular-nums text-foreground">{fmt(planCompletionPercent)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${planCompletionPercent}%` }} />
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-7">
        <MiniMetric label="العينة" value={progress} />
        <MiniMetric label="المتبقي للـBeta" value={fmt(stats.remainingToBeta)} />
        <MiniMetric label="هدف الدفعة" value={fmt(stats.nextBatchTarget)} />
        <MiniMetric label="تقدم الدفعة" value={`${fmt(nextBatchProgressPercent)}%`} />
        <MiniMetric label="بعد الدفعة" value={`${fmt(stats.nextBatchExpectedPlanPercent)}%`} />
        <MiniMetric label="زيادة كل عملية" value={`+${fmt(stats.planPercentPerOperation)}%`} />
        <MiniMetric label="مكتملة" value={fmt(stats.completed)} />
        <MiniMetric label="مسترجعة" value={fmt(stats.refunded)} />
        <MiniMetric label="فشل بلا رد" value={fmt(stats.failedUnrefunded)} />
        <MiniMetric label="نشطة" value={fmt(stats.active)} />
        <MiniMetric label="مؤرشفة" value={fmt(stats.archived)} />
        <MiniMetric label="Legacy fallback" value={fmt(stats.legacyFallback)} />
      </div>
      {stats.blockers.length > 0 ? (
        <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs leading-6 text-warning-foreground">
          {stats.blockers.map((blocker) => <div key={blocker}>• {blocker}</div>)}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-success/30 bg-success/10 p-3 text-xs font-medium text-success">لا توجد عوائق في عينة Soft Launch الحالية؛ يمكن بدء دفعة المراقبة التالية.</div>
      )}
      {stats.legacyFallback > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">توجد نتائج قديمة قبل قرار التخزين الداخلي وتُعرض كرابط مزود fallback؛ لا تُعد عائقاً إذا لم تتكرر في النتائج الجديدة.</p>
      )}
      {!stats.rolloutStartedAt && (
        <p className="mt-2 text-xs text-muted-foreground">لم تبدأ عينة Soft Launch المعتمدة بعد؛ ستبدأ بعد إثبات مسار CDN والأرشفة الداخلية.</p>
      )}
    </section>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: string; tone?: "warning" | "success" | "gold"; icon?: "cost" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon === "cost" && <DollarSign className="h-4 w-4 text-primary" />}
      </div>
      <p className={cn("mt-1 text-2xl font-extrabold tabular-nums", tone === "warning" && "text-warning-foreground", tone === "success" && "text-success", tone === "gold" && "text-gold")}>{value}</p>
    </div>
  );
}

function MiniMetric({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-bold tabular-nums" title={title}>{value}</p>
    </div>
  );
}

function ProviderAttemptsPanel({ attempts }: { attempts: ReturnType<typeof providerAttempts> }) {
  if (attempts.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {attempts.map((attempt, index) => (
        <div key={`${attempt.provider ?? "provider"}-${index}`} className={cn("rounded-lg border border-border bg-secondary/30 p-2 text-xs", attempt.ok === false && "border-destructive/30 bg-destructive/10", attempt.ok === true && "border-success/30 bg-success/10")}>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-bold">{attempt.provider ?? "provider"}</p>
            <Badge variant="secondary">{attempt.status ?? (attempt.ok ? "ok" : "failed")}</Badge>
          </div>
          <p className="mt-1 text-muted-foreground">{attempt.mode ?? "—"} · {typeof attempt.latency_ms === "number" ? `${attempt.latency_ms.toLocaleString("ar-SA")}ms` : "—"}</p>
          {attempt.reason && <p className="mt-1 truncate text-muted-foreground">{attempt.reason}</p>}
          {attempt.error && <p className="mt-1 line-clamp-2 text-destructive">{attempt.error}</p>}
          <p className="mt-1 text-muted-foreground">{fmtDate(attempt.finished_at)}</p>
        </div>
      ))}
    </div>
  );
}
