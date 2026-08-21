import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Film,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { track } from "@/lib/analytics/posthog";
import { DashboardShell } from "@/components/dashboard-shell";
import { TrustBadges } from "@/components/trust-badges";
import { AnnualUpgradeBanner } from "@/components/annual-upgrade-banner";
import { ActivationSteps } from "@/components/activation-steps";
import { SubscribersCounter } from "@/components/subscribers-counter";
import { FounderCard } from "@/components/founder-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { PAID_PLANS, PLAN_BY_ID, REFUND_GUARANTEE_LABEL, LAUNCH_BADGE_LABEL, VIDEO_QUALITY_LABELS, estimateVideoCount, formatPlanNumber, videoCreditCost, type PaidPlanId, type PlanId } from "@/lib/plan-catalog";
import {
  formatSaudiPhoneDisplay,
  normalizeSaudiPhone,
  validateSaudiPhone,
  SAUDI_PHONE_ERROR,
  SAUDI_PHONE_PLACEHOLDER,
} from "@/lib/phone";

export const Route = createFileRoute("/dashboard/billing/")({
  head: () => ({ meta: [{ title: "الفواتير والاشتراك — رِفد" }] }),
  component: BillingPage,
});

const PLAN_LABELS: Record<PlanId, string> = Object.fromEntries(Object.entries(PLAN_BY_ID).map(([key, value]) => [key, value.name])) as Record<PlanId, string>;



const PLAN_PURCHASE_GUIDE: Record<PaidPlanId, { fit: string; capability: string; focus: string }> = {
  starter: {
    fit: "للانطلاق المنظم",
    capability: "تشغيل يومي مناسب لبداية متجر يبني حضوره",
    focus: "فيديو سريع، نصوص بيع، وصور أساسية للحملات الخفيفة",
  },
  growth: {
    fit: "للمتاجر النشطة",
    capability: "سعة أعلى لحملات منتظمة مع صور Pro عند الحاجة",
    focus: "أفضل توازن بين تكلفة التشغيل وكثافة المحتوى",
  },
  pro: {
    fit: "للإعلانات الجادة",
    capability: "تشغيل متقدم مع فيديو احترافي وصور Pro",
    focus: "مناسب للعروض المتكررة وإطلاق المنتجات المدفوعة",
  },
  business: {
    fit: "للفرق وتعدد الحملات",
    capability: "سعة موسعة للمتاجر والفرق التي تعمل على أكثر من حملة",
    focus: "تنظيم إنتاج متواصل مع مرونة أعلى للنمو",
  },
};

const STATUS_META: Record<
  string,
  { label: string; tone: "warning" | "info" | "success" | "danger" | "muted"; icon: typeof Clock }
> = {
  pending: { label: "قيد الانتظار", tone: "warning", icon: Clock },
  contacted: { label: "تم التواصل معك", tone: "info", icon: MessageCircle },
  activated: { label: "تم تفعيل الاشتراك ✨", tone: "success", icon: CheckCircle2 },
  rejected: { label: "تم الرفض", tone: "danger", icon: AlertCircle },
  expired: { label: "انتهت صلاحية الطلب", tone: "muted", icon: AlertCircle },
};

type Settings = {
  whatsapp_number: string;
};

type RequestRow = {
  id: string;
  plan: PaidPlanId;
  billing_cycle: string;
  store_name: string | null;
  whatsapp: string;
  email: string;
  payment_method: string | null;
  notes: string | null;
  status: keyof typeof STATUS_META;
  created_at: string;
};

function BillingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState<PaidPlanId>("growth");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [storeName, setStoreName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer_sa");
  const [notes, setNotes] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [settingsRes, reqRes] = await Promise.all([
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("subscription_requests")
        .select("id, plan, billing_cycle, store_name, whatsapp, email, payment_method, notes, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setSettings((settingsRes.data as Settings | null) ?? null);
    setRequests((reqRes.data as RequestRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadAll();
  }, [user, loadAll]);

  useEffect(() => {
    if (profile?.store_name) setStoreName(profile.store_name);
    if (profile?.whatsapp) setWhatsapp(formatSaudiPhoneDisplay(profile.whatsapp));
  }, [profile]);

  const whatsappNumber = settings?.whatsapp_number ?? "966582286215";
  const selected = PLAN_BY_ID[plan];
  const selectedGuide = PLAN_PURCHASE_GUIDE[plan];
  const price = billingCycle === "yearly" ? selected.yearlyPriceSar : selected.monthlyPriceSar;
  const selectedFastVideos = estimateVideoCount(selected.monthlyCredits, "fast", 5);
  const selectedQualityVideos = selected.videoQualityAllowed ? estimateVideoCount(selected.monthlyCredits, "quality", 5) : 0;
  const pendingRequest = useMemo(
    () => requests.find((r) => r.status === "pending" || r.status === "contacted"),
    [requests]
  );
  const isPaidUser = Boolean(profile?.plan && profile.plan !== "free");

  useEffect(() => {
    if (loading || !pendingRequest || isPaidUser) return;
    void navigate({
      to: "/dashboard/billing/confirm/$requestId",
      params: { requestId: pendingRequest.id },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingRequest?.id, isPaidUser]);

  function buildWhatsappUrl(reqId?: string) {
    const lines = [
      "السلام عليكم 👋",
      "أرغب بالاشتراك في رِفد بنظام نقاط الفيديو الجديد",
      "",
      `📦 الباقة: ${selected.name} ${billingCycle === "yearly" ? "(سنوي)" : "(شهري)"}`,
      `🎬 نقاط الفيديو: ${formatPlanNumber(selected.monthlyCredits)} نقطة`,
      `💰 السعر: ${price} ر.س (سعر الإطلاق + ضمان 7 أيام استرداد كامل)`,
      storeName ? `🏪 المتجر: ${storeName}` : "",
      `📱 واتساب: ${whatsapp}`,
      `📧 البريد: ${user?.email ?? ""}`,
      `💳 طريقة الدفع: ${paymentMethodLabel(paymentMethod)}`,
      reqId ? `🔖 رقم الطلب: ${reqId.slice(0, 8)}` : "",
      notes ? `📝 ملاحظة: ${notes}` : "",
    ].filter(Boolean).join("\n");
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!whatsapp.trim()) return toast.error("الرجاء إدخال رقم الواتساب");
    if (!validateSaudiPhone(whatsapp)) return toast.error(SAUDI_PHONE_ERROR);

    const normalizedWhatsapp = normalizeSaudiPhone(whatsapp)!;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("subscription_requests")
      .insert({
        user_id: user.id,
        plan,
        billing_cycle: billingCycle,
        store_name: storeName || null,
        whatsapp: normalizedWhatsapp,
        email: user.email ?? "",
        payment_method: paymentMethod,
        notes: notes || null,
      })
      .select("id")
      .single();
    setSubmitting(false);

    if (error || !data) {
      const code = (error as { code?: string } | null)?.code;
      toast.error(code === "23505" ? "لديك طلب معلّق بالفعل — افتح صفحة التأكيد أو انتظر التفعيل." : "فشل إرسال الطلب، حاول مرة أخرى");
      return;
    }

    toast.success("✅ تم استلام طلبك! ننتقل لصفحة التأكيد...");
    track("subscription_requested", { plan, billing_cycle: billingCycle, payment_method: paymentMethod });
    await refreshProfile();
    void navigate({ to: "/dashboard/billing/confirm/$requestId", params: { requestId: data.id } });
  }

  return (
    <DashboardShell>
      <div className="mb-4">
        <AnnualUpgradeBanner />
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-primary">المرحلة 5 من الخطة · التقدم 99%</p>
          <h1 className="mt-1 text-2xl font-extrabold">اختر قدرة النمو المناسبة لمتجرك</h1>
          <p className="mt-1 text-sm text-muted-foreground">الباقات هنا قدرات تشغيل للحملات: نقاط فيديو واضحة، صور Pro عند الحاجة، واستخدام يومي للنصوص والصور دون تحويلها إلى أرقام بيع.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/pricing">عرض صفحة الأسعار</Link>
        </Button>
      </div>

      <div className={cn("rounded-2xl border p-6 shadow-soft", isPaidUser ? "border-gold/40 bg-gradient-to-br from-gold/10 to-transparent" : "border-border bg-card")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {isPaidUser && <Sparkles className="h-5 w-5 text-gold" />}
              <h2 className="text-lg font-bold">باقتك الحالية: {PLAN_LABELS[(profile?.plan ?? "free") as PlanId] ?? profile?.plan}</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPaidUser ? "نقاطك الحالية مخصصة للفيديو فقط، والنصوص والصور لا تخصم منها." : "ابدأ مجاناً، ثم اختر باقة فيديو عندما تحتاج حملات إعلانية أكثر."}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
            <Film className="h-3.5 w-3.5" /> {VIDEO_QUALITY_LABELS.fast} {videoCreditCost("fast", 5)} · {VIDEO_QUALITY_LABELS.lite} {videoCreditCost("lite", 8)} · {VIDEO_QUALITY_LABELS.quality} {videoCreditCost("quality", 8)} نقطة
          </div>
        </div>
      </div>

      {pendingRequest && <PendingBanner request={pendingRequest} waUrl={buildWhatsappUrl(pendingRequest.id)} />}

      {!isPaidUser && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">اختر قدرة التشغيل</h2>
            </div>

            <div className="mb-5">
              <SubscribersCounter />
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {PAID_PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id as PaidPlanId)}
                  className={cn("rounded-xl border p-4 text-right transition-colors", plan === p.id ? "border-primary bg-primary/10" : "border-border bg-secondary/20 hover:border-primary/40")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold">{p.name}</span>
                    {p.badge && <Badge className="text-[10px]">{p.badge}</Badge>}
                  </div>
                  <div className="mt-2 text-2xl font-extrabold">{p.monthlyPriceSar} <span className="text-xs font-normal text-muted-foreground">ر.س</span></div>
                  <div className="mt-1 text-xs text-primary">{formatPlanNumber(p.monthlyCredits)} نقطة فيديو</div>
                  <div className="mt-1 text-[11px] font-semibold text-foreground">{PLAN_PURCHASE_GUIDE[p.id as PaidPlanId].fit}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{PLAN_PURCHASE_GUIDE[p.id as PaidPlanId].capability}</div>
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">الدورة</Label>
                <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as "monthly" | "yearly")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">شهري</SelectItem>
                    <SelectItem value="yearly">سنوي (شهران مجاناً)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">اسم المتجر</Label>
                <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="مثال: متجر ندى للعطور" />
              </div>
              <div>
                <Label className="mb-1.5 block">رقم الواتساب *</Label>
                <Input required dir="ltr" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder={SAUDI_PHONE_PLACEHOLDER} />
                <p className="mt-1 text-[11px] text-muted-foreground">رقم جوال سعودي يبدأ بـ 5 — نتواصل معك من خلاله</p>
              </div>
              <div>
                <Label className="mb-1.5 block">طريقة الدفع المفضلة</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer_sa">تحويل بنكي سعودي</SelectItem>
                    <SelectItem value="other">طريقة أخرى عبر واتساب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block">ملاحظة (اختياري)</Label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي تفاصيل إضافية تحب نعرفها قبل التواصل" />
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-extrabold text-primary">
                    <Zap className="h-4 w-4" /> {formatPlanNumber(selected.monthlyCredits)} نقطة فيديو
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    تقريباً {formatPlanNumber(selectedFastVideos)} فيديو سريع أو {selected.videoQualityAllowed ? `${formatPlanNumber(selectedQualityVideos)} فيديو احترافي` : "الاحترافي غير متاح"} — الفيديو محكوم بالنقاط.
                  </p>
                  <p className="mt-2 text-xs font-medium text-foreground">{selectedGuide.focus}</p>
                  <p className="mt-2 text-2xl font-extrabold">
                    {price} <span className="text-sm font-normal text-muted-foreground">ر.س / {billingCycle === "yearly" ? "سنوياً" : "شهرياً"}</span>
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                    <Sparkles className="h-3 w-3" /> {LAUNCH_BADGE_LABEL}
                  </span>
                </div>
                <Button type="submit" size="lg" disabled={submitting} className="gradient-primary text-primary-foreground shadow-elegant">
                  {submitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="ml-2 h-4 w-4" />}
                  إرسال الطلب وعرض بيانات التحويل
                </Button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-success/20 bg-success/5 p-3">
              <TrustBadges variant="row" items={4} />
            </div>
          </form>

          <div className="space-y-5">
            <FounderCard whatsappNumber={whatsappNumber} />
            <ActivationSteps />
            <aside className="rounded-2xl border-2 border-success/40 bg-gradient-to-br from-success/10 via-success/5 to-transparent p-6 shadow-soft">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-success" />
                <span className="text-xs font-bold uppercase tracking-wide text-success">{LAUNCH_BADGE_LABEL}</span>
              </div>
              <h3 className="mt-3 text-xl font-extrabold">جرّب رِفد بثقة كاملة</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                ادفع اليوم بسعر الإطلاق، وإن لم تكن التجربة مناسبة خلال أول 7 أيام نُعيد لك المبلغ كاملاً بدون أسئلة.
              </p>
              <div className="mt-4 rounded-xl border border-success/30 bg-card/50 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-bold text-success">
                  <ShieldCheck className="h-4 w-4" /> {REFUND_GUARANTEE_LABEL}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">على أول اشتراك مدفوع — استرجاع كامل بدون أسئلة.</p>
              </div>
              <ul className="mt-5 space-y-2.5 text-sm">
                {["نقاط فيديو واضحة دون رسوم مخفية", "النصوص والصور لا تخصم من نقاط الفيديو", "تأكيد فوري للطلب وتفعيل خلال 24 ساعة", "تفاصيل فوترة واضحة بعد كل دفعة"].map((item) => (
                  <li key={item} className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span>{item}</span></li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      )}

      {!isPaidUser && <div className="mt-6"><TrustBadges items={6} /></div>}

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h3 className="mb-4 text-base font-bold">طلباتك السابقة</h3>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">ما عندك أي طلبات سابقة. ابدأ بإرسال طلب من النموذج أعلاه.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">التاريخ</th>
                  <th className="px-2 py-2 font-medium">الباقة</th>
                  <th className="px-2 py-2 font-medium">الدورة</th>
                  <th className="px-2 py-2 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const meta = STATUS_META[r.status];
                  const Icon = meta.icon;
                  return (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="px-2 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar-SA")}</td>
                      <td className="px-2 py-3 font-medium">{PLAN_LABELS[r.plan]}</td>
                      <td className="px-2 py-3 text-xs text-muted-foreground">{r.billing_cycle === "yearly" ? "سنوي" : "شهري"}</td>
                      <td className="px-2 py-3"><Badge variant={toneToVariant(meta.tone)} className="gap-1"><Icon className="h-3 w-3" /> {meta.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function paymentMethodLabel(method: string) {
  return method === "bank_transfer_sa" ? "تحويل بنكي سعودي" : "أخرى";
}

function toneToVariant(tone: "warning" | "info" | "success" | "danger" | "muted"): "default" | "secondary" | "destructive" | "outline" {
  if (tone === "success") return "default";
  if (tone === "danger") return "destructive";
  if (tone === "warning" || tone === "info") return "secondary";
  return "outline";
}

function PendingBanner({ request, waUrl }: { request: RequestRow; waUrl: string }) {
  const meta = STATUS_META[request.status];
  return (
    <div className="mt-6 rounded-2xl border-2 border-warning/40 bg-gradient-to-br from-warning/10 to-transparent p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <h3 className="font-bold">عندك طلب نشط: {meta.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {PLAN_LABELS[request.plan]} • {request.billing_cycle === "yearly" ? "سنوي" : "شهري"} • أُرسل في {new Date(request.created_at).toLocaleDateString("ar-SA")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">افتح صفحة التأكيد لرفع إيصال التحويل ومتابعة الحالة.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="gradient-primary text-primary-foreground shadow-elegant">
            <Link to="/dashboard/billing/confirm/$requestId" params={{ requestId: request.id }}>
              <CheckCircle2 className="ml-2 h-4 w-4" /> فتح صفحة التأكيد
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-success text-success hover:bg-success/10">
            <a href={waUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="ml-2 h-4 w-4" /> واتساب</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
