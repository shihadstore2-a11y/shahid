/**
 * Wave C3 — Referrals Page
 * صفحة دعوة الأصحاب: كود فريد للمستخدم، رابط مشاركة، إحصائيات الإحالات،
 * ومكافأة 50pt لكل صديق يترقّى لباقة مدفوعة.
 *
 * RTL · Light/Dark · Mobile/Tablet/Desktop عبر design tokens فقط.
 */
import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Copy,
  Check,
  Gift,
  Share2,
  Sparkles,
  Trophy,
  Users,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/posthog";

export const Route = createFileRoute("/dashboard/referrals")({
  head: () => ({
    meta: [
      { title: "ادعُ صاحب متجر — اكسب 50pt مع رِفد" },
      {
        name: "description",
        content:
          "ادعُ صاحب متجر سعودي لـِرفد، عند ترقّيه لأي باقة مدفوعة تحصل على 50pt مكافأة فورية في رصيدك.",
      },
    ],
  }),
  component: ReferralsPage,
});

type ReferralRow = {
  id: string;
  code_used: string;
  status: "pending" | "qualified" | "rewarded";
  reward_points: number;
  created_at: string;
  qualified_at: string | null;
};

function ReferralsPage() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [usesCount, setUsesCount] = useState(0);
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = code ? `https://rifd.site/auth?ref=${code}` : "";
  const totalRewards = rows
    .filter((r) => r.status === "qualified" || r.status === "rewarded")
    .reduce((sum, r) => sum + r.reward_points, 0);
  const qualifiedCount = rows.filter((r) => r.status !== "pending").length;

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [codeRes, refRes] = await Promise.all([
        supabase
          .from("referral_codes")
          .select("code, uses_count")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("referrals")
          .select("id, code_used, status, reward_points, created_at, qualified_at")
          .eq("referrer_user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      setCode(codeRes.data?.code ?? null);
      setUsesCount(codeRes.data?.uses_count ?? 0);
      setRows((refRes.data ?? []) as ReferralRow[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc("generate_referral_code");
      if (error) throw error;
      setCode(data as string);
      track("referral_code_generated");
      toast.success("تم توليد كودك — شاركه الآن!");
    } catch (e) {
      toast.error("تعذّر توليد الكود — حاول مجدداً");
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      track("referral_link_copied", { code });
      toast.success("نُسخ الرابط — الصقه في واتساب أو سناب");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("تعذّر النسخ");
    }
  }, [shareUrl, code]);

  const handleShareWhatsApp = useCallback(() => {
    if (!shareUrl) return;
    const text = encodeURIComponent(
      `جرّب رِفد لمحتوى متجرك — يكتب نصاً يبيع، يصمّم صورة إعلان، ويولّد فيديو ترويجي بالعربية. سجّل من رابطي وكلانا نستفيد:\n${shareUrl}`,
    );
    track("referral_share_whatsapp", { code });
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }, [shareUrl, code]);

  return (
    <DashboardShell>
      <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:py-8">
        {/* Hero */}
        <header className="overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-background to-background p-6 shadow-soft sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-extrabold text-primary">
            <Gift className="size-3.5" />
            برنامج الإحالة
          </div>
          <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">
            ادعُ صاحب متجر — تحصلون على <span className="text-primary">50pt</span> لكلٍ منكما
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            لما يترقّى صديقك لأي باقة مدفوعة في رِفد، يضاف لرصيدك <strong>50 نقطة فيديو</strong> فوراً —
            بدون حد أقصى لعدد الأصدقاء.
          </p>
        </header>

        {/* Code + Share */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <Share2 className="size-5 text-primary" /> رابط دعوتك
          </h2>

          {loading ? (
            <div className="mt-4 flex h-24 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : code ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-3 font-mono text-sm">
                  <span dir="ltr" className="truncate">
                    {shareUrl}
                  </span>
                </div>
                <Button onClick={handleCopy} variant="outline" className="shrink-0">
                  {copied ? (
                    <>
                      <Check className="ml-2 size-4 text-success" /> تم النسخ
                    </>
                  ) : (
                    <>
                      <Copy className="ml-2 size-4" /> نسخ
                    </>
                  )}
                </Button>
                <Button onClick={handleShareWhatsApp} className="shrink-0">
                  <Share2 className="ml-2 size-4" /> شارك واتساب
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                كودك: <span className="font-bold text-foreground">{code}</span> · استُخدم{" "}
                <span className="font-bold text-foreground">{usesCount}</span> مرة
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <Button onClick={handleGenerate} disabled={generating} size="lg">
                {generating ? (
                  <Loader2 className="ml-2 size-4 animate-spin" />
                ) : (
                  <Sparkles className="ml-2 size-4" />
                )}
                ولّد كودك الآن
              </Button>
            </div>
          )}
        </section>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={Users}
            label="أصدقاء سجّلوا بكودك"
            value={usesCount}
            tone="default"
          />
          <StatCard
            icon={Trophy}
            label="ترقّوا لباقة مدفوعة"
            value={qualifiedCount}
            tone="success"
          />
          <StatCard
            icon={Gift}
            label="نقاط مكتسبة"
            value={`${totalRewards}pt`}
            tone="primary"
          />
        </section>

        {/* History */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <Users className="size-5 text-primary" /> سجل الإحالات
          </h2>
          {loading ? (
            <div className="mt-4 flex h-24 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              لم تتم أي إحالة بعد — شارك كودك في مجموعات تجار التجارة الإلكترونية.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-bold text-foreground">صاحب متجر جديد</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("ar-SA")}
                    </div>
                  </div>
                  <StatusPill status={r.status} reward={r.reward_points} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone: "default" | "success" | "primary";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-soft",
        tone === "success" && "border-success/30",
        tone === "primary" && "border-primary/30",
        tone === "default" && "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "size-5",
            tone === "success" && "text-success",
            tone === "primary" && "text-primary",
            tone === "default" && "text-muted-foreground",
          )}
        />
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-black tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function StatusPill({
  status,
  reward,
}: {
  status: ReferralRow["status"];
  reward: number;
}) {
  if (status === "pending") {
    return (
      <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
        بانتظار الترقية
      </span>
    );
  }
  return (
    <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-extrabold text-success">
      ✓ +{reward}pt
    </span>
  );
}
