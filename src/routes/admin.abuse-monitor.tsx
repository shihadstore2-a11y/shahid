import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BarChart3, Clapperboard, Coins, Copy, Loader2, RefreshCw, Search, ShieldAlert, UserRoundSearch } from "lucide-react";
import { toast } from "sonner";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getAbuseMonitor, type AbuseSignal, type AbuseMonitorStats } from "@/server/admin-abuse";

export const Route = createFileRoute("/admin/abuse-monitor")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "مراقبة إساءة الاستخدام — رِفد" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل مراقبة الإساءة…">
      <AbuseMonitorPage />
    </AdminGuard>
  ),
});

const SEVERITY_LABEL: Record<string, string> = {
  all: "كل الخطورة",
  critical: "حرجة",
  high: "عالية",
  medium: "متوسطة",
  low: "منخفضة",
};

const SEVERITY_TONE: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-warning/20 text-warning-foreground",
  medium: "bg-gold/15 text-gold",
  low: "bg-secondary text-secondary-foreground",
};

const CATEGORY_LABEL: Record<string, string> = {
  credits: "النقاط",
  video: "الفيديو",
  quota: "الحصص اليومية",
  campaigns: "الحملات",
};

function fmt(n: number) {
  return n.toLocaleString("ar-SA");
}

function fmtDate(value: string) {
  return new Date(value).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });
}

function emptyStats(): AbuseMonitorStats {
  return { totalSignals: 0, critical: 0, high: 0, medium: 0, low: 0, usersFlagged: 0, creditsConsumed: 0, videosCreated: 0, refunds: 0 };
}

function AbuseMonitorPage() {
  const fetchMonitor = useServerFn(getAbuseMonitor);
  const [signals, setSignals] = useState<AbuseSignal[]>([]);
  const [stats, setStats] = useState<AbuseMonitorStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
  const [windowHours, setWindowHours] = useState<24 | 72 | 168>(24);
  const [search, setSearch] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("لا توجد جلسة");
      const out = await fetchMonitor({ data: { severity, windowHours, limit: 100 }, headers: { Authorization: `Bearer ${session.access_token}` } });
      setSignals(out.signals);
      setStats(out.stats);
      setGeneratedAt(out.generatedAt);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحميل مراقبة الإساءة");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, windowHours]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return signals;
    return signals.filter((item) =>
      [item.user_id, item.user_email, item.user_store, item.title, item.details, item.metric, item.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [search, signals]);

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
            <ShieldAlert className="h-3.5 w-3.5" /> Abuse Monitor
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><AlertTriangle className="h-6 w-6 text-warning" /> مراقبة إساءة الاستخدام</h1>
          <p className="mt-1 max-w-3xl text-sm leading-7 text-muted-foreground">
            لوحة تشغيلية تكشف الاستهلاك غير الطبيعي للنقاط والفيديو وحصص النصوص والصور وكثافة الحملات قبل أن تتحول إلى تكلفة أو مخاطرة دعم.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="w-fit gap-1">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> تحديث
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ShieldAlert} label="إشارات مرصودة" value={fmt(stats.totalSignals)} emphasis={stats.critical > 0 || stats.high > 0} />
        <StatCard icon={UserRoundSearch} label="مستخدمون تحت المراقبة" value={fmt(stats.usersFlagged)} />
        <StatCard icon={Coins} label="نقاط مستهلكة" value={fmt(stats.creditsConsumed)} />
        <StatCard icon={Clapperboard} label="فيديوهات النافذة" value={fmt(stats.videosCreated)} />
      </div>

      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-7 text-muted-foreground">
        <strong className="text-foreground">معايرة V9:</strong> الإشارات الآن تُقاس نسبةً إلى حدود الباقة الفعلية، لا بأرقام ثابتة قد تظلم الخطط الكبيرة أو تتساهل مع الخطط الصغيرة.
      </div>

      <div className="mb-4 grid gap-2 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
        <Select value={String(windowHours)} onValueChange={(value) => setWindowHours(Number(value) as 24 | 72 | 168)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24">آخر 24 ساعة</SelectItem>
            <SelectItem value="72">آخر 72 ساعة</SelectItem>
            <SelectItem value="168">آخر 7 أيام</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={(value) => setSeverity(value as typeof severity)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(SEVERITY_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث بالبريد، المتجر، المستخدم، أو نوع الإشارة…" className="pr-9" />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge className="bg-destructive text-destructive-foreground">حرجة {fmt(stats.critical)}</Badge>
        <Badge className="bg-warning/20 text-warning-foreground">عالية {fmt(stats.high)}</Badge>
        <Badge className="bg-gold/15 text-gold">متوسطة {fmt(stats.medium)}</Badge>
        <Badge className="bg-secondary text-secondary-foreground">منخفضة {fmt(stats.low)}</Badge>
        {generatedAt ? <span>آخر تحديث: {fmtDate(generatedAt)}</span> : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm leading-7 text-muted-foreground">
          لا توجد إشارات إساءة مطابقة حالياً. استمر في مراقبة الفيديو والنقاط خلال Soft Launch.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {filtered.map((item) => (
              <article key={item.id} className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={SEVERITY_TONE[item.severity]}>{SEVERITY_LABEL[item.severity]}</Badge>
                    <Badge variant="outline">{CATEGORY_LABEL[item.category]}</Badge>
                    <span className="text-xs text-muted-foreground">{fmtDate(item.last_seen_at)}</span>
                  </div>
                  <h2 className="mt-2 text-base font-extrabold">{item.title}</h2>
                  <p className="mt-1 text-sm leading-7 text-muted-foreground">{item.details}</p>
                   <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-lg bg-secondary/60 p-3"><span className="text-muted-foreground">المؤشر: </span><strong>{item.metric}</strong></div>
                    <div className="rounded-lg bg-secondary/60 p-3"><span className="text-muted-foreground">الإجراء: </span><strong>{item.action_hint}</strong></div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background p-3 text-xs leading-6">
                  <p className="font-extrabold">{item.user_store || item.user_email || "مستخدم بدون اسم"}</p>
                  <p className="mt-1 text-muted-foreground">{item.user_email || "لا يوجد بريد"}</p>
                  <p className="mt-1 text-muted-foreground">الخطة: {item.plan || "غير معروفة"}</p>
                  <p className="mt-1 break-all text-muted-foreground">{item.user_id}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm" className="gap-1">
                      <Link to="/admin/video-jobs" search={{ q: item.user_email || item.user_id }}><Clapperboard className="h-3.5 w-3.5" /> فيديو</Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(item.user_id); toast.success("تم نسخ user_id"); }} className="gap-1">
                      <Copy className="h-3.5 w-3.5" /> نسخ
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function StatCard({ icon: Icon, label, value, emphasis }: { icon: typeof BarChart3; label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-soft", emphasis && "border-destructive/30 bg-destructive/5")}>
      <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{label}</p><Icon className={cn("h-4 w-4 text-primary", emphasis && "text-destructive")} /></div>
      <p className={cn("mt-1 text-2xl font-extrabold tabular-nums", emphasis && "text-destructive")}>{value}</p>
    </div>
  );
}
