import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Star, Copy, Trash2, Image as ImageIcon, FileText, Loader2, Clapperboard, RefreshCw, FolderKanban, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { EmptyStateCTA } from "@/components/empty-state-cta";
import { cn } from "@/lib/utils";
import { VIDEO_QUALITY_LABELS } from "@/lib/plan-catalog";
import { listVideoJobs, refreshVideoJob } from "@/server/video-functions";

const ACTIVE_VIDEO_STATUSES = new Set(["pending", "processing"]);

export const Route = createFileRoute("/dashboard/library")({
  head: () => ({ meta: [{ title: "مكتبة محتواك الجاهز — رِفد" }] }),
  validateSearch: (s: Record<string, unknown>): { campaignId?: string } => ({
    campaignId: typeof s.campaignId === "string" ? s.campaignId : undefined,
  }),
  component: LibraryPage,
});

type Generation = {
  id: string;
  type: "text" | "image" | "image_enhance";
  prompt: string;
  result: string | null;
  template: string | null;
  is_favorite: boolean;
  created_at: string;
  metadata: { template_title?: string; campaignId?: string; campaignPackId?: string; campaign_pack_id?: string; campaign_product?: string; campaign_goal?: string; campaign_channel?: string } | null;
};

type VideoJob = Awaited<ReturnType<typeof listVideoJobs>>["jobs"][number];

const VIDEO_STATUS_LABEL: Record<string, string> = {
  processing: "قيد المعالجة",
  completed: "مكتمل",
  refunded: "تم رد النقاط",
  failed: "فشل",
  pending: "بانتظار المعالجة",
};

function LibraryPage() {
  const search = useSearch({ from: "/dashboard/library" });
  const { user, loading: authLoading } = useAuth();
  const listVideoJobsFn = useServerFn(listVideoJobs);
  const refreshVideoJobFn = useServerFn(refreshVideoJob);
  const [items, setItems] = useState<Generation[]>([]);
  const [videoJobs, setVideoJobs] = useState<VideoJob[]>([]);
  const [refreshingJobId, setRefreshingJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "text" | "image" | "video" | "fav">("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) toast.error(error.message);
      setItems((data as Generation[] | null) ?? []);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const out = await listVideoJobsFn({ headers: { Authorization: `Bearer ${session.access_token}` } });
          setVideoJobs(out.jobs);
        } catch {
          setVideoJobs([]);
          toast.error("تعذر تحميل الفيديوهات مؤقتاً");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [listVideoJobsFn, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void load();
  }, [authLoading, load, user]);

  const toggleFav = async (id: string, current: boolean) => {
    setItems((s) => s.map((i) => (i.id === id ? { ...i, is_favorite: !current } : i)));
    const { error } = await supabase
      .from("generations")
      .update({ is_favorite: !current })
      .eq("id", id);
    if (error) {
      setItems((s) => s.map((i) => (i.id === id ? { ...i, is_favorite: current } : i)));
      toast.error("فشل التحديث");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("متأكد من الحذف؟")) return;
    const prev = items;
    setItems((s) => s.filter((i) => i.id !== id));
    const { error } = await supabase.from("generations").delete().eq("id", id);
    if (error) {
      setItems(prev);
      toast.error("فشل الحذف");
    } else {
      toast.success("تم الحذف");
    }
  };

  const refreshVideo = async (jobId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error("سجّل الدخول لتحديث حالة الفيديو");
    setRefreshingJobId(jobId);
    try {
      const out = await refreshVideoJobFn({ data: { jobId }, headers: { Authorization: `Bearer ${session.access_token}` } });
      setVideoJobs((jobs) => jobs.map((job) => (job.id === out.job.id ? out.job : job)));
      toast.success(out.job.status === "completed" ? "اكتمل الفيديو" : "تم تحديث الحالة");
    } catch {
      toast.error("تعذر تحديث حالة الفيديو مؤقتاً");
    } finally {
      setRefreshingJobId(null);
    }
  };

  useEffect(() => {
    if (authLoading || !user || !videoJobs.some((job) => ACTIVE_VIDEO_STATUSES.has(job.status))) return;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const processingJobs = videoJobs.filter((job) => ACTIVE_VIDEO_STATUSES.has(job.status)).slice(0, 2);
      await Promise.allSettled(processingJobs.map(async (job) => {
        const out = await refreshVideoJobFn({ data: { jobId: job.id }, headers: { Authorization: `Bearer ${session.access_token}` } });
        setVideoJobs((jobs) => jobs.map((current) => (current.id === out.job.id ? out.job : current)));
      }));
    }, 15_000);
    return () => window.clearInterval(id);
  }, [authLoading, user, videoJobs, refreshVideoJobFn]);

  const scopedItems = search.campaignId ? items.filter((item) => campaignKey(item.metadata) === search.campaignId) : items;
  const scopedVideoJobs = search.campaignId ? videoJobs.filter((job) => campaignKey((job.metadata as Record<string, unknown> | null) ?? null) === search.campaignId) : videoJobs;
  const filtered = scopedItems.filter((i) => {
    if (filter === "all") return true;
    if (filter === "fav") return i.is_favorite;
    if (filter === "video") return false;
    if (filter === "text") return i.type === "text";
    if (filter === "image") return i.type === "image" || i.type === "image_enhance";
    return true;
  });

  const textCount = scopedItems.filter((item) => item.type === "text").length;
  const imageCount = scopedItems.filter((item) => item.type === "image" || item.type === "image_enhance").length;
  const favoriteCount = scopedItems.filter((item) => item.is_favorite).length;
  const campaignGroups = buildCampaignGroups(items, videoJobs);
  const visibleCampaignGroups = search.campaignId ? campaignGroups.filter((group) => group.id === search.campaignId) : campaignGroups;
  const campaignItemCount = campaignGroups.reduce((total, group) => total + group.text + group.image + group.video, 0);
  const completedCampaignCount = visibleCampaignGroups.filter((group) => group.completedSlots === 3).length;
  const shouldShowVideoSection = scopedVideoJobs.length > 0 && (filter === "all" || filter === "video");
  const hasVisibleItems = filter === "video"
    ? scopedVideoJobs.length > 0
    : filtered.length > 0 || (filter === "all" && scopedVideoJobs.length > 0);

  return (
    <DashboardShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-primary">الأصول والذاكرة</p>
          <h1 className="mt-1 text-2xl font-extrabold">مكتبة محتواك الجاهز</h1>
          <p className="mt-1 text-sm text-muted-foreground">كل نص وصورة وفيديو وحملة محفوظة في مكان واحد، مع إبراز ما اخترته للمفضلة.</p>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
          <span>{scopedItems.length + scopedVideoJobs.length} أصل جاهز • {campaignItemCount} أصل مرتبط بحملة</span>
          {search.campaignId && (
            <Button asChild size="sm" className="h-8 gap-1 text-xs">
              <Link to="/dashboard/campaign-studio" search={{ campaignId: search.campaignId, focus: "house" } as never}><ArrowLeft className="h-3.5 w-3.5" /> العودة للاستوديو</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[{ label: "نصوص", value: textCount, icon: FileText }, { label: "صور", value: imageCount, icon: ImageIcon }, { label: "فيديوهات", value: scopedVideoJobs.length, icon: Clapperboard }, { label: "حملات مكتملة", value: completedCampaignCount, icon: FolderKanban }, { label: "مفضلة", value: favoriteCount, icon: Star }].map((stat) => {
          const Icon = stat.icon;
          return <div key={stat.label} className="rounded-lg border border-border bg-card p-3 shadow-soft"><Icon className="h-4 w-4 text-primary" /><div className="mt-2 text-lg font-extrabold">{stat.value.toLocaleString("ar-SA")}</div><div className="text-xs text-muted-foreground">{stat.label}</div></div>;
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { id: "all", label: "كل الأصول" },
          { id: "text", label: "نصوص" },
          { id: "image", label: "صور" },
          { id: "video", label: "فيديوهات" },
          { id: "fav", label: "المفضلة ⭐" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as typeof filter)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-accent"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibleCampaignGroups.length > 0 && filter === "all" && (
        <section className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-extrabold">حملاتك</h2>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCampaignGroups.map((group) => (
              <article key={group.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-extrabold">{group.name}</p>
                    <p className="mt-1 text-xs font-bold text-primary">اكتملت {group.completedSlots}/3 · التقدم {group.completionPercent}%</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs font-black text-primary">{group.completedSlots}/3</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{group.goal || "هدف"} · {group.channel || "قناة"}</p>
                {(() => {
                  const label = occasionLabel(group);
                  return label ? <p className="mt-2 inline-flex rounded-full bg-secondary px-2 py-1 text-[11px] font-bold">{label}</p> : null;
                })()}
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className="rounded-full bg-secondary px-2 py-1">{group.text} نص</span>
                  <span className="rounded-full bg-secondary px-2 py-1">{group.image} صورة</span>
                  <span className="rounded-full bg-secondary px-2 py-1">{group.video} فيديو</span>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{group.completionPercent}%</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`اكتمال الحملة ${group.completionPercent}%`}>
                  <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${group.completionPercent}%` }} />
                </div>
                {group.completedSlots === 3 && <p className="mt-2 text-xs font-bold text-success">حملة مكتملة بـ 3 أصول</p>}
                <Button asChild size="sm" variant="outline" className="mt-3 h-8 w-full text-xs">
                  <Link to="/dashboard/campaign-studio" search={{ campaignId: group.id, focus: "house" } as never}>فتح بيت الحملة</Link>
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="mt-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !hasVisibleItems ? (
        <div className="mt-6">
          <EmptyStateCTA
            icon={FolderKanban}
            title={search.campaignId ? "لم تُنشئ أصولاً لهذه الحملة بعد" : "مكتبتك تنتظر أول أصل جاهز"}
            description={
              search.campaignId
                ? "ارجع لبيت الحملة وابدأ بالنص أو الصورة لتكتمل الحملة."
                : "ابدأ من مركز قيادة الحملة حتى تنتج نصاً يبيع، صورة إعلان، أو فيديو قصير ضمن نفس السياق."
            }
            ctaLabel={search.campaignId ? "العودة للاستوديو" : "ابدأ من مركز قيادة الحملة"}
            ctaTo="/dashboard/campaign-studio"
          />
        </div>
      ) : (
        <>
        {shouldShowVideoSection && <VideoJobsSection jobs={scopedVideoJobs} refreshingJobId={refreshingJobId} onRefresh={refreshVideo} />}
        {filter !== "video" && <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <article key={g.id} className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {g.type === "text" ? <FileText className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                  <span>{g.metadata?.template_title ?? g.template ?? (g.type === "text" ? "نص" : "صورة")}</span>
                </div>
                <button onClick={() => toggleFav(g.id, g.is_favorite)} aria-label="مفضلة">
                  <Star className={cn("h-4 w-4", g.is_favorite ? "fill-gold text-gold" : "text-muted-foreground")} />
                </button>
              </div>
              <div className="mt-3">
                {campaignKey(g.metadata) && (
                  <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] leading-5 text-primary">
                    من حملة: {g.metadata?.campaign_product || "حملة محفوظة"} · {g.metadata?.campaign_channel || "قناة"}
                  </div>
                )}
                {g.type === "text" ? (
                  <pre className="line-clamp-6 whitespace-pre-wrap text-right font-sans text-xs leading-relaxed text-foreground">
                    {g.result ?? ""}
                  </pre>
                ) : g.result ? (
                  <img src={g.result} alt={g.prompt} className="aspect-square w-full rounded-lg object-cover" />
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(g.created_at).toLocaleDateString("ar-SA")}
                </span>
                <div className="flex gap-1">
                  {g.type === "text" && g.result && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { navigator.clipboard.writeText(g.result!); toast.success("تم النسخ"); }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(g.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>}
        </>
      )}
    </DashboardShell>
  );
}

function campaignKey(metadata: unknown) {
  const meta = (metadata as Generation["metadata"] | null) ?? null;
  return meta?.campaignId ?? meta?.campaignPackId ?? meta?.campaign_pack_id ?? "";
}

function buildCampaignGroups(items: Generation[], videoJobs: VideoJob[]) {
  const groups = new Map<string, { id: string; name: string; goal?: string; channel?: string; text: number; image: number; video: number; completedVideo: number; completedSlots: number; completionPercent: number }>();
  const ensure = (id: string, metadata: Generation["metadata"] | Record<string, unknown> | null) => {
    const meta = metadata ?? {};
    const name = typeof meta.campaign_product === "string" && meta.campaign_product ? meta.campaign_product : "حملة محفوظة";
    if (!groups.has(id)) groups.set(id, { id, name, goal: typeof meta.campaign_goal === "string" ? meta.campaign_goal : undefined, channel: typeof meta.campaign_channel === "string" ? meta.campaign_channel : undefined, text: 0, image: 0, video: 0, completedVideo: 0, completedSlots: 0, completionPercent: 0 });
    return groups.get(id)!;
  };
  for (const item of items) {
    const id = campaignKey(item.metadata);
    if (!id) continue;
    const group = ensure(id, item.metadata);
    if (item.type === "text") group.text += 1;
    else group.image += 1;
  }
  for (const job of videoJobs) {
    const metadata = (job.metadata as Record<string, unknown> | null) ?? null;
    const id = campaignKey(metadata);
    if (!id) continue;
    const group = ensure(id, metadata);
    group.video += 1;
    if (job.status === "completed" && job.result_url) group.completedVideo += 1;
  }
  return Array.from(groups.values()).map((group) => {
    const completedSlots = Number(group.text > 0) + Number(group.image > 0) + Number(group.completedVideo > 0);
    return { ...group, completedSlots, completionPercent: Math.round((completedSlots / 3) * 100) };
  });
}

function occasionLabel(group: { name: string; goal?: string; channel?: string }) {
  const text = `${group.name} ${group.goal ?? ""} ${group.channel ?? ""}`;
  if (/رمضان/.test(text)) return "🌙 رمضان";
  if (/اليوم الوطني|وطني/.test(text)) return "🇸🇦 اليوم الوطني";
  if (/العيد|عيد/.test(text)) return "🎁 العيد";
  if (/العودة للمدارس|مدارس|مدرس/.test(text)) return "🎒 العودة للمدارس";
  if (/نهاية السنة|آخر السنة|نهاية الموسم/.test(text)) return "✨ نهاية السنة";
  return "";
}

function VideoJobsSection({ jobs, refreshingJobId, onRefresh }: { jobs: VideoJob[]; refreshingJobId: string | null; onRefresh: (jobId: string) => void }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-extrabold">فيديوهاتك الجاهزة وقيد المعالجة</h2>
            <p className="text-xs text-muted-foreground">إعلانات الفيديو محفوظة بحالتها ونقاطها داخل مكتبة محتواك الجاهز.</p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/dashboard/generate-video">أنشئ فيديو قصير</Link>
        </Button>
      </div>
      {jobs.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.slice(0, 9).map((job) => (
            <article key={job.id} className="overflow-hidden rounded-lg border border-border bg-secondary/20">
              <div className="flex aspect-video items-center justify-center bg-secondary/50">
                {job.result_url ? <video src={job.result_url} controls className="h-full w-full object-cover" /> : <Clapperboard className="h-7 w-7 text-primary" />}
              </div>
              <div className="space-y-2 p-3 text-xs">
                {(job.metadata as { campaign_pack_id?: string; campaign_product?: string; campaign_channel?: string } | null)?.campaign_pack_id && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-bold text-primary">
                    من حملة: {(job.metadata as { campaign_product?: string; campaign_channel?: string }).campaign_product || "حملة محفوظة"} · {(job.metadata as { campaign_channel?: string }).campaign_channel || "قناة"}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{VIDEO_QUALITY_LABELS[job.quality]}</span>
                  <span className="rounded-full bg-background px-2 py-0.5 font-bold">{VIDEO_STATUS_LABEL[job.status] ?? job.status}</span>
                </div>
                <p className="line-clamp-2 text-muted-foreground">{job.prompt}</p>
                <div className="flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
                  <span>{new Date(job.created_at).toLocaleDateString("ar-SA")}</span>
                  <span>{job.credits_charged.toLocaleString("ar-SA")} نقطة</span>
                </div>
                <div className="flex gap-2">
                {ACTIVE_VIDEO_STATUSES.has(job.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 gap-2 text-xs"
                    disabled={refreshingJobId === job.id}
                    onClick={() => onRefresh(job.id)}
                  >
                    <RefreshCw className={cn("h-3 w-3", refreshingJobId === job.id && "animate-spin")} />
                    تحديث الحالة
                  </Button>
                )}
                {job.result_url && (
                  <Button asChild size="sm" variant="outline" className="h-8 flex-1 text-xs">
                    <a href={job.result_url} target="_blank" rel="noreferrer">فتح الفيديو</a>
                  </Button>
                )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
