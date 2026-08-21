/**
 * Admin A/B Test Results — لوحة عرض نتائج تجارب A/B.
 * الحماية: AdminGuard على الواجهة + getAbTestResults يفرض دور admin خادمياً.
 * (لا استعلامات Supabase مباشرة من العميل — defense-in-depth.)
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Users, MousePointerClick, Wand2 } from "lucide-react";
import { getAbTestResults, type AbStats } from "@/server/admin-ab-tests";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/ab-tests")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "نتائج اختبارات A/B — رِفد" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل نتائج التجارب…">
      <AbTestsPage />
    </AdminGuard>
  ),
});

type Stats = AbStats;

function AbTestsPage() {
  const fetchResults = useServerFn(getAbTestResults);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [a, setA] = useState<Stats | null>(null);
  const [b, setB] = useState<Stats | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("لا توجد جلسة");
        const res = await fetchResults({
          data: { experiment: "hero_hook" },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!active) return;
        setA(res.A);
        setB(res.B);
        setLoading(false);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? "تعذّر تحميل النتائج");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <DashboardShell>
        <div className="mx-auto flex max-w-6xl items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          جاري التحميل…
        </div>
      </DashboardShell>
    );
  }

  const winner =
    a && b
      ? b.cta_rate > a.cta_rate
        ? "B"
        : a.cta_rate > b.cta_rate
          ? "A"
          : null
      : null;

  const briefWinner =
    a && b
      ? b.brief_start_rate > a.brief_start_rate
        ? "B"
        : a.brief_start_rate > b.brief_start_rate
          ? "A"
          : null
      : null;

  return (
    <DashboardShell>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-3xl font-extrabold">نتائج A/B Test</h1>
          <p className="mt-1 text-muted-foreground">
            اختبار العنوان الترويجي في الصفحة الرئيسية (hero_hook)
          </p>
        </div>

        {loading && <p className="text-muted-foreground">جاري التحميل...</p>}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-destructive">خطأ: {error}</CardContent>
          </Card>
        )}

        {!loading && !error && a && b && (
          <>
            {winner && (
              <Card className="border-success/40 bg-success/5">
                <CardContent className="flex items-center gap-3 pt-6">
                  <TrendingUp className="h-6 w-6 text-success" />
                  <div>
                    <p className="font-bold">
                       الفائز حالياً في النقر: Variant {winner}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      نسبة نقرات أعلى على CTA الأساسي
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

             {briefWinner && (
               <Card className="border-primary/40 bg-primary/5">
                 <CardContent className="flex items-center gap-3 pt-6">
                   <Wand2 className="h-6 w-6 text-primary" />
                   <div>
                     <p className="font-bold">الفائز في بدء إنشاء الـBrief: Variant {briefWinner}</p>
                     <p className="text-sm text-muted-foreground">هذا هو المعيار الأهم لأنّه يقيس بداية الإنشاء الفعلية</p>
                   </div>
                 </CardContent>
               </Card>
             )}

            <div className="grid gap-4 md:grid-cols-2">
              <VariantCard
                title="Variant A — بدل ما يضيع يومك على المحتوى"
                hint="Pain-led: يبدأ بالألم ثم يعد بأن الباقي على رِفد"
                stats={a}
                isWinner={briefWinner === "A"}
              />
              <VariantCard
                title="Variant B — لا تعيد شرح متجرك كل مرة"
                hint="Fatigue-led: يبيع تقليل التكرار ثم الوعد بسرعة التنفيذ"
                stats={b}
                isWinner={briefWinner === "B"}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">قراءة سريعة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                 <p>• <strong>cta_rate</strong> = نقرات CTA الرئيسي ÷ المشاهدات</p>
                 <p>• <strong>brief_start_rate</strong> = بدايات إنشاء الـBrief الفعلية ÷ المشاهدات</p>
                <p>• <strong>demo_rate</strong> = تجارب الـDemo ÷ المشاهدات</p>
                <p>• الحد الأدنى للثقة الإحصائية: <strong>~100 مشاهدة لكل variant</strong></p>
                <p>• كل زائر يُعيَّن له variant ثابت (localStorage) — لا يرى الاثنين</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function VariantCard({
  title,
  hint,
  stats,
  isWinner,
}: {
  title: string;
  hint: string;
  stats: Stats;
  isWinner: boolean;
}) {
  return (
    <Card className={isWinner ? "border-success/50 shadow-elegant" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {isWinner && <Badge className="bg-success text-success-foreground">🏆 فائز</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Metric icon={<Users className="h-4 w-4" />} label="جلسات فريدة" value={stats.unique_sessions} />
        <Metric icon={<Users className="h-4 w-4" />} label="مشاهدات" value={stats.views} />
        <Metric icon={<MousePointerClick className="h-4 w-4" />} label="نقرات CTA" value={stats.cta_clicks} suffix={` (${stats.cta_rate.toFixed(1)}%)`} highlight />
        <Metric icon={<Wand2 className="h-4 w-4" />} label="بدء إنشاء Brief" value={stats.brief_starts} suffix={` (${stats.brief_start_rate.toFixed(1)}%)`} highlight />
        <Metric icon={<Wand2 className="h-4 w-4" />} label="تجارب Demo" value={stats.demo_tries} suffix={` (${stats.demo_rate.toFixed(1)}%)`} />
      </CardContent>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
  suffix,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg border border-border p-3 ${highlight ? "bg-primary/5" : ""}`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`font-bold ${highlight ? "text-primary" : ""}`}>
        {value.toLocaleString("ar-SA")}
        {suffix && <span className="text-xs font-normal text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
