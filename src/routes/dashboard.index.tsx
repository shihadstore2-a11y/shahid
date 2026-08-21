import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  Clapperboard,
  FileText,
  Image as ImageIcon,
  Library,
  Megaphone,
  Sparkles,
  Store,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCreditsSummary } from "@/hooks/use-credits-summary";
import { getMemoryCoverage, getWeeklyRecommendation } from "@/lib/memory-insights";
import { PLAN_BY_ID, type PlanId } from "@/lib/plan-catalog";
import { getCampaignLiveHome, listCampaignPacks, type CampaignLiveHome, type CampaignPack } from "@/server/campaign-packs";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "لوحة التحكم — رِفد" }] }),
  component: DashboardPage,
});

const PLAN_LABELS: Record<PlanId, string> = {
  free: "مجاني",
  starter: "بداية",
  growth: "نمو",
  pro: "احترافي",
  business: "أعمال",
};

type RecentItem = {
  id: string;
  type: "text" | "image" | "image_enhance";
  prompt: string;
  metadata: { template_title?: string } | null;
};

type ActiveCampaign = {
  pack: CampaignPack;
  liveHome: CampaignLiveHome | null;
};

function formatNum(n: number) {
  return n.toLocaleString("ar-SA");
}

function campaignDoneCount(liveHome: CampaignLiveHome | null) {
  return Number(Boolean(liveHome?.text)) + Number(Boolean(liveHome?.image)) + Number(Boolean(liveHome?.video?.status === "completed" && liveHome.video.result_url));
}

function goalLabel(goal: CampaignPack["goal"]) {
  const labels: Record<CampaignPack["goal"], string> = {
    launch: "إطلاق منتج",
    clearance: "تصفية مخزون",
    upsell: "زيادة قيمة السلة",
    leads: "بناء عملاء",
    competitive: "مواجهة المنافسين",
    winback: "إعادة الاستهداف",
  };
  return labels[goal] ?? "هدف حملة";
}

function campaignHint(liveHome: CampaignLiveHome | null) {
  const done = campaignDoneCount(liveHome);
  if (done === 3) return "جاهزة للنشر!";
  if (liveHome?.image && !liveHome.text) return "الصورة جاهزة، اكتب النص المطابق لها";
  if (liveHome?.text && !liveHome.image) return "النص جاهز. صمّم صورة إعلان توقف التمرير";
  if (liveHome?.text && liveHome.image) return "ينقصها فيديو قصير مناسب لريلز وتيك توك";
  return "ابدأ بأول أصل للحملة من الاستوديو";
}

function GenericEmptyState({ title, description, actionLabel, actionTo }: { title: string; description: string; actionLabel: string; actionTo: "/dashboard/campaign-studio" }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-primary" />
      <h3 className="mt-3 text-lg font-extrabold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-muted-foreground">{description}</p>
      <Button asChild className="mt-4 gradient-primary text-primary-foreground">
        <Link to={actionTo}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

function DashboardPage() {
  const { user, profile } = useAuth();
  const { data: creditsSummary } = useCreditsSummary({ enabled: Boolean(user?.id) });
  const listCampaignPacksFn = useServerFn(listCampaignPacks);
  const getCampaignLiveHomeFn = useServerFn(getCampaignLiveHome);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<ActiveCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("generations")
        .select("id, type, prompt, metadata")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3);
      if (!cancelled) setRecent((data as RecentItem[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoadingCampaigns(true);
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const { packs } = await listCampaignPacksFn({ data: { status: "active", limit: 3 }, headers });
      const campaigns = await Promise.all(
        packs.map(async (pack) => {
          try {
            const out = await getCampaignLiveHomeFn({ data: { campaignId: pack.id }, headers });
            return { pack, liveHome: out.liveHome };
          } catch {
            return { pack, liveHome: null };
          }
        }),
      );
      if (!cancelled) setActiveCampaigns(campaigns);
    })()
      .catch(() => { if (!cancelled) setActiveCampaigns([]); })
      .finally(() => { if (!cancelled) setLoadingCampaigns(false); });
    return () => { cancelled = true; };
  }, [getCampaignLiveHomeFn, listCampaignPacksFn, userId]);

  const plan = (profile?.plan ?? "free") as PlanId;
  const planInfo = PLAN_BY_ID[plan] ?? PLAN_BY_ID.free;
  const planLabel = PLAN_LABELS[planInfo.id];
  const completionPct = getMemoryCoverage(profile);
  const weeklyRecommendation = getWeeklyRecommendation(profile);
  const videoCredits = creditsSummary?.totalCredits ?? 0;
  const displayName = profile?.store_name || profile?.full_name || "متجرك";

  return (
    <DashboardShell>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-soft">
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
            <div className="min-w-0">
              <Badge variant="secondary" className="mb-4 gap-1.5 px-3 py-1 text-xs font-bold">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                مركز نمو {displayName}
              </Badge>
              <h1 className="max-w-2xl text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
                جاهز تطلق حملة تبيع اليوم؟
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                ابدأ من هدف تجاري واحد، ورِفد يحوّله إلى موجز حملة يقودك للنص والصورة والفيديو بدون تشتيت.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button asChild size="lg" className="gap-2 gradient-primary text-primary-foreground shadow-elegant">
                  <Link to="/dashboard/campaign-studio">
                    ابدأ حملة كاملة
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2">
                  <Link to="/dashboard/store-profile">
                    قوّي ذاكرة متجري
                    <Store className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-gold/30 bg-accent/35 p-4 shadow-gold">
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl gradient-gold text-gold-foreground">
                  <Megaphone className="h-5 w-5" />
                </span>
                <Badge className="bg-gold text-gold-foreground">القطعة الذهبية</Badge>
              </div>
              <h2 className="mt-4 text-xl font-extrabold">استوديو الحملات</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                خريطة واحدة تبدأ بالهدف، ثم توصلك لأدوات التنفيذ المناسبة بدل أن تبدأ من صفحة فارغة.
              </p>
              <Button asChild variant="link" className="mt-3 h-auto p-0 text-primary">
                <Link to="/dashboard/campaign-studio">افتح مركز القيادة ←</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/dashboard/campaign-studio" as const, title: "منتج جديد", desc: "موجز إطلاق سريع", icon: Megaphone },
            { to: "/dashboard/generate-text" as const, title: "عرض محدود", desc: "نص بيع مباشر", icon: Wand2 },
            { to: "/dashboard/generate-image" as const, title: "مناسبة أو موسم", desc: "صورة إعلان جاهزة", icon: ImageIcon },
            { to: "/dashboard/generate-video" as const, title: "شرح سريع", desc: "فيديو قصير واضح", icon: Clapperboard },
          ].map((goal) => (
            <Link
              key={goal.title}
              to={goal.to}
              className="group rounded-xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40"
            >
              <goal.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-extrabold">{goal.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{goal.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:-translate-x-1">
                ابدأ الآن <ArrowLeft className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-extrabold">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  توصية عملية لهذا الأسبوع
                </h2>
                <p className="mt-2 text-xl font-extrabold leading-8">{weeklyRecommendation.title}</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{weeklyRecommendation.description}</p>
              </div>
            </div>
            <Button asChild className="mt-4 gradient-primary text-primary-foreground">
              <Link to={weeklyRecommendation.ctaHref}>{weeklyRecommendation.ctaLabel}</Link>
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <BadgeCheck className="h-5 w-5 text-success" />
              حالة التشغيل
            </h2>
            <div className="mt-4 grid gap-3">
              <Link to="/dashboard/store-profile" className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                <span className="text-sm text-muted-foreground">ذاكرة المتجر</span>
                <span className="font-extrabold">{completionPct}%</span>
              </Link>
              <Link to="/dashboard/usage" className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                <span className="text-sm text-muted-foreground">نقاط الفيديو</span>
                <span className="font-extrabold">{formatNum(videoCredits)}</span>
              </Link>
              <Link to="/dashboard/billing" className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                <span className="text-sm text-muted-foreground">الباقة الحالية</span>
                <span className="font-extrabold">{planLabel}</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold">
                <Megaphone className="h-5 w-5 text-primary" />
                حملاتك النشطة
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">تابع آخر الحملات من بيت واحد وانتقل للأصل الناقص مباشرة.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/campaign-studio">ابدأ حملتك الأولى</Link>
            </Button>
          </div>
          {loadingCampaigns ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-lg bg-secondary/60" />)}
            </div>
          ) : activeCampaigns.length === 0 ? (
            <GenericEmptyState
              title="جاهز تطلق حملة تبيع اليوم؟"
              description="ابدأ من هدفك التجاري، ورِفد يحوّله إلى نص، صورة، وفيديو."
              actionLabel="ابدأ حملتك الأولى"
              actionTo="/dashboard/campaign-studio"
            />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeCampaigns.map(({ pack, liveHome }) => {
                const done = campaignDoneCount(liveHome);
                const percent = Math.round((done / 3) * 100);
                return (
                  <Link key={pack.id} to="/dashboard/campaign-studio" search={{ campaignId: pack.id, focus: "house" } as never} className="rounded-lg border border-border bg-background p-4 transition hover:border-primary/40 hover:bg-primary/5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 font-extrabold">{pack.product || "حملة محفوظة"}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{goalLabel(pack.goal)} · {pack.channel}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-card">{done}/3</Badge>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>
                    <p className="mt-3 text-xs font-bold text-primary">{campaignHint(liveHome)}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <Library className="h-5 w-5 text-primary" />
              آخر ما أنشأته
            </h2>
            {recent.length === 0 ? (
              <GenericEmptyState
                title="أول أصل ينتظرك"
                description="ابدأ من استوديو الحملات ليظهر هنا أول نص أو صورة جاهزة لإعادة الاستخدام."
                actionLabel="ابدأ من الاستوديو"
                actionTo="/dashboard/campaign-studio"
              />
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {recent.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 py-3 text-sm">
                    {item.type === "text" ? <FileText className="h-4 w-4 text-primary" /> : <ImageIcon className="h-4 w-4 text-gold" />}
                    <span className="truncate">{item.metadata?.template_title ?? item.prompt}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="link" className="mt-2 h-auto p-0 text-primary">
              <Link to="/dashboard/library">افتح المكتبة ←</Link>
            </Button>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-soft">
            <h2 className="text-lg font-extrabold">التفاصيل عند الحاجة</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              النظرة العامة تعرض القرار التالي فقط. تفاصيل الاستخدام، الفواتير، والمخرجات محفوظة في صفحاتها المتخصصة حتى تبقى الصفحة خفيفة وسريعة.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm"><Link to="/dashboard/usage">الاستخدام والرصيد</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/dashboard/templates">القوالب</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/dashboard/settings">الإعدادات</Link></Button>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
