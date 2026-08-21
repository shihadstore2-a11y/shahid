import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Copy, FolderKanban, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { listAdminCampaignPacks, type AdminCampaignPack } from "@/server/campaign-packs";

export const Route = createFileRoute("/admin/campaign-packs")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "إدارة Campaign Packs — رِفد" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل إدارة الحملات…">
      <AdminCampaignPacksPage />
    </AdminGuard>
  ),
});

const STATUS_LABEL: Record<string, string> = {
  all: "كل الحالات",
  draft: "مسودة",
  generated: "جاهزة",
  archived: "مؤرشفة",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  generated: "bg-success/15 text-success",
  archived: "bg-secondary text-secondary-foreground",
};

function fmt(n: number) {
  return n.toLocaleString("ar-SA");
}

function fmtDate(value: string) {
  return new Date(value).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });
}

function AdminCampaignPacksPage() {
  const fetchPacks = useServerFn(listAdminCampaignPacks);
  const [packs, setPacks] = useState<AdminCampaignPack[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({ total: 0, draft: 0, generated: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"all" | "draft" | "generated" | "archived">("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("لا توجد جلسة");
      const out = await fetchPacks({ data: { status, limit: 200 }, headers: { Authorization: `Bearer ${session.access_token}` } });
      setPacks(out.packs);
      setStats(out.stats);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحميل الحملات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return packs;
    return packs.filter((pack) =>
      [pack.product, pack.audience, pack.offer, pack.brief, pack.user_email, pack.user_store, pack.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [packs, search]);

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><FolderKanban className="h-6 w-6 text-primary" /> إدارة Campaign Packs</h1>
          <p className="mt-1 text-sm leading-7 text-muted-foreground">متابعة حملات العملاء المحفوظة، حالات الجاهزية، وجودة الربط بين النص والصورة والفيديو.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="w-fit gap-1">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> تحديث
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي الحزم" value={fmt(stats.total ?? 0)} />
        <StatCard label="مسودات" value={fmt(stats.draft ?? 0)} />
        <StatCard label="جاهزة" value={fmt(stats.generated ?? 0)} tone="success" />
        <StatCard label="مؤرشفة" value={fmt(stats.archived ?? 0)} />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث بالمتجر، البريد، المنتج، الجمهور أو الحملة…" className="pr-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">لا توجد Campaign Packs مطابقة.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {filtered.map((pack) => (
              <article key={pack.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_230px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn(STATUS_TONE[pack.status] ?? "bg-muted")}>{STATUS_LABEL[pack.status] ?? pack.status}</Badge>
                    <span className="text-xs font-bold text-primary">{pack.channel}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(pack.last_output_at ?? pack.updated_at)}</span>
                    <Badge variant="outline">{pack.completion_percent}% مكتملة</Badge>
                  </div>
                  <h2 className="mt-2 line-clamp-1 font-extrabold">{pack.product || "حملة بدون اسم"}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{pack.brief}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{pack.user_store || pack.user_email || pack.user_id.slice(0, 8)}</span>
                    <span className="mx-1">·</span>
                    <span>{pack.audience || "بدون جمهور محدد"}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs lg:grid-cols-1">
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-2 text-center">
                    <MiniCount label="نص" value={pack.output_counts.text} />
                    <MiniCount label="صورة" value={pack.output_counts.image} />
                    <MiniCount label="فيديو" value={pack.output_counts.video} />
                  </div>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-2 text-center">
                    <MiniCount label="A/B" value={pack.ab_variants.length} />
                    <MiniCount label="أيام" value={pack.publishing_calendar.length} />
                  </div>
                  <Button asChild variant="outline" size="sm" className="gap-1">
                    <Link to="/dashboard/campaign-studio" search={{ campaignId: pack.id } as never}><FolderKanban className="h-3.5 w-3.5" /> فتح</Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(pack.brief); toast.success("تم نسخ الموجز"); }} className="gap-1">
                    <Copy className="h-3.5 w-3.5" /> نسخ الموجز
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{label}</p><BarChart3 className="h-4 w-4 text-primary" /></div>
      <p className={cn("mt-1 text-2xl font-extrabold tabular-nums", tone === "success" && "text-success")}>{value}</p>
    </div>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return <div><p className="text-sm font-extrabold tabular-nums">{fmt(value)}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}
