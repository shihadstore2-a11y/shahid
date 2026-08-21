/**
 * صفحة شحن نقاط الفيديو الإضافية (Top-up).
 * تتيح للمستخدم:
 *  1) رؤية رصيده الحالي (من useCreditsSummary)
 *  2) اختيار باقة شحن من topup_packages
 *  3) إنشاء طلب topup_purchase + رفع إيصال
 *  4) متابعة حالة الطلبات السابقة (pending/paid/activated/rejected)
 *
 * يعتمد على trg_lock_topup_from_package لمنع التلاعب بالكميات/الأسعار.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Coins,
  Loader2,
  Plus,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Crown,
  FileCheck2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCreditsSummary } from "@/hooks/use-credits-summary";
import { listTopupPackages } from "@/server/credits";
import { cn } from "@/lib/utils";
import { estimateVideoCount, VIDEO_QUALITY_LABELS, videoCreditCost } from "@/lib/plan-catalog";

export const Route = createFileRoute("/dashboard/credits")({
  head: () => ({ meta: [{ title: "نقاط الفيديو: وقود حملاتك المرئية — رِفد" }] }),
  component: CreditsPage,
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];

type Package = {
  id: string;
  display_name: string;
  credits: number;
  price_sar: number;
  display_order: number;
};

type Purchase = {
  id: string;
  package_id: string;
  credits: number;
  price_sar: number;
  status: "pending" | "paid" | "activated" | "rejected" | "refunded";
  receipt_path: string | null;
  created_at: string;
  activated_at: string | null;
  admin_notes: string | null;
};

const STATUS_META: Record<Purchase["status"], { label: string; tone: string; icon: typeof Clock }> = {
  pending: { label: "بانتظار رفع إيصال", tone: "bg-warning/20 text-warning-foreground", icon: Clock },
  paid: { label: "بانتظار تأكيد الأدمن", tone: "bg-primary/15 text-primary", icon: FileCheck2 },
  activated: { label: "تم الإضافة ✨", tone: "bg-success/15 text-success", icon: CheckCircle2 },
  rejected: { label: "تم الرفض", tone: "bg-destructive/15 text-destructive", icon: AlertCircle },
  refunded: { label: "تم الاسترجاع", tone: "bg-muted text-muted-foreground", icon: RefreshCw },
};

function fmt(n: number) {
  return n.toLocaleString("ar-SA");
}

function CreditsPage() {
  const { user } = useAuth();
  const fetchPackages = useServerFn(listTopupPackages);
  const { data: summary, refresh: refreshCredits } = useCreditsSummary();
  const [packages, setPackages] = useState<Package[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeUploadFor, setActiveUploadFor] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    const [pkgRes, purchaseRes] = await Promise.all([
      fetchPackages({ headers: { Authorization: `Bearer ${session.access_token}` } }),
      supabase
        .from("topup_purchases")
        .select("id, package_id, credits, price_sar, status, receipt_path, created_at, activated_at, admin_notes")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setPackages((pkgRes?.packages as Package[]) ?? []);
    setPurchases((purchaseRes.data as Purchase[]) ?? []);
    setLoading(false);
  }, [fetchPackages]);

  useEffect(() => {
    if (!user) return;
    void loadAll();
  }, [user, loadAll]);

  const pendingPurchase = useMemo(
    () => purchases.find((p) => p.status === "pending" || p.status === "paid"),
    [purchases]
  );

  async function handleCreatePurchase(pkg: Package) {
    if (!user) return;
    if (pendingPurchase) {
      toast.error("لديك طلب شحن قيد المعالجة — أكمله أولاً");
      return;
    }
    setSubmittingId(pkg.id);
    // مفتاح فريد قوي يمنع التكرار حتى لو ضُغط الزر مرتين بنفس الميلي ثانية
    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${user.id}-${pkg.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { data, error } = await supabase
      .from("topup_purchases")
      .insert({
        user_id: user.id,
        package_id: pkg.id,
        credits: pkg.credits, // سيُستبدل بالقيم الموثوقة من trigger
        price_sar: pkg.price_sar,
        idempotency_key: idempotencyKey,
        status: "pending",
        payment_method: "bank_transfer_sa",
      })
      .select("*")
      .single();
    setSubmittingId(null);

    if (error || !data) {
      toast.error(`فشل إنشاء الطلب: ${error?.message ?? "خطأ غير معروف"}`);
      return;
    }
    toast.success("تم إنشاء الطلب ✓ — ارفع إيصال التحويل لإكمال الشحن");
    setActiveUploadFor(data.id);
    await loadAll();
    // افتح منتقي الملفات تلقائياً
    setTimeout(() => fileRef.current?.click(), 100);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset
    if (!file || !activeUploadFor || !user) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("الصيغة غير مدعومة (JPG/PNG/WEBP/PDF فقط)");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("الحد الأقصى 5 ميجابايت");
      return;
    }

    setUploadingId(activeUploadFor);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/topup-${activeUploadFor}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("payment-receipts")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (upErr) {
      setUploadingId(null);
      toast.error(`فشل الرفع: ${upErr.message}`);
      return;
    }

    const { error: updErr } = await supabase
      .from("topup_purchases")
      .update({
        receipt_path: path,
        receipt_uploaded_at: new Date().toISOString(),
        status: "paid",
      })
      .eq("id", activeUploadFor);

    setUploadingId(null);
    setActiveUploadFor(null);

    if (updErr) {
      toast.error(`فشل تحديث الحالة: ${updErr.message}`);
      return;
    }
    toast.success("✅ تم رفع الإيصال — سنفعّل نقاط الفيديو خلال 24 ساعة");
    await loadAll();
    void refreshCredits();
  }

  function triggerUpload(purchaseId: string) {
    setActiveUploadFor(purchaseId);
    setTimeout(() => fileRef.current?.click(), 50);
  }

  const total = summary?.totalCredits ?? 0;
  const planCr = summary?.planCredits ?? 0;
  const topupCr = summary?.topupCredits ?? 0;
  const fastVideos = estimateVideoCount(total, "fast", 5);
  const adVideos = estimateVideoCount(total, "lite", 8);
  const proVideos = estimateVideoCount(total, "quality", 8);

  return (
    <DashboardShell>
      <input
        ref={fileRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold text-primary">المرحلة 5 من الخطة · التقدم 97%</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
            <Coins className="h-6 w-6 text-gold" /> نقاط الفيديو: وقود حملاتك المرئية
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            اشحن رصيداً إضافياً للفيديو عند تكثيف الحملات؛ نقاط الشحن لا تختفي مع تجدّد الباقة.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/billing">
            <ArrowLeft className="h-4 w-4" />
            ترقية الباقة
          </Link>
        </Button>
      </div>

      {/* Current Balance Card */}
      <div className="mb-6 rounded-2xl gradient-primary p-5 text-primary-foreground shadow-elegant">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs opacity-80">رصيد حملات الفيديو الآن</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">
              {fmt(total)} <span className="text-base font-medium opacity-80">نقطة فيديو</span>
            </p>
            <p className="mt-2 text-xs opacity-80">
              يكفي تقريباً {fmt(fastVideos)} فيديو {VIDEO_QUALITY_LABELS.fast} أو {fmt(adVideos)} فيديو {VIDEO_QUALITY_LABELS.lite} أو {fmt(proVideos)} فيديو {VIDEO_QUALITY_LABELS.quality}.
            </p>
          </div>
          <div className="hidden rounded-full bg-primary-foreground/15 p-4 sm:block">
            <Sparkles className="h-7 w-7" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md bg-primary-foreground/10 p-2.5">
            <p className="opacity-70">رصيد الباقة الشهري</p>
            <p className="mt-0.5 font-bold tabular-nums">{fmt(planCr)}</p>
          </div>
          <div className="rounded-md bg-primary-foreground/10 p-2.5">
            <p className="opacity-70">رصيد شحن لا ينتهي</p>
            <p className="mt-0.5 font-bold tabular-nums">{fmt(topupCr)}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {(["fast", "lite", "quality"] as const).map((quality) => {
          const duration = quality === "fast" ? 5 : 8;
          const cost = videoCreditCost(quality, duration);
          const count = estimateVideoCount(total, quality, duration);
          return (
            <div key={quality} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-bold">فيديو {VIDEO_QUALITY_LABELS[quality]}</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{fmt(count)}</p>
              <p className="mt-1 text-xs text-muted-foreground">تقريباً · {fmt(cost)} نقطة للفيديو</p>
            </div>
          );
        })}
      </div>

      {/* Pending purchase banner */}
      {pendingPurchase && (
        <div className="mb-6 rounded-xl border border-warning/50 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-warning-foreground" />
            <div className="flex-1">
              <p className="font-bold text-warning-foreground">
                لديك طلب شحن {pendingPurchase.status === "pending" ? "بانتظار رفع إيصال" : "بانتظار تأكيد الأدمن"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fmt(pendingPurchase.credits)} نقطة فيديو بسعر {fmt(pendingPurchase.price_sar)} ر.س
              </p>
              {pendingPurchase.status === "pending" && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => triggerUpload(pendingPurchase.id)}
                  disabled={uploadingId === pendingPurchase.id}
                >
                  {uploadingId === pendingPurchase.id ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري الرفع…</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5" /> رفع إيصال التحويل</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Packages grid */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-bold">اختر وقود حملتك التالية</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg, idx) => {
              const isMid = idx === 1;
              const pricePerCredit = (pkg.price_sar / pkg.credits) * 1000;
              return (
                <div
                  key={pkg.id}
                  className={cn(
                    "relative rounded-2xl border bg-card p-5 transition-all",
                    isMid
                      ? "border-primary shadow-elegant ring-1 ring-primary/30"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  {isMid && (
                    <Badge className="absolute -top-2.5 right-4 bg-gold text-gold-foreground">
                      الأفضل قيمة
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        isMid ? "gradient-primary text-primary-foreground" : "bg-secondary text-foreground"
                      )}
                    >
                      <Coins className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{pkg.display_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        تعادل تقريباً {fmt(estimateVideoCount(pkg.credits, "lite", 8))} فيديو {VIDEO_QUALITY_LABELS.lite}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tabular-nums">{fmt(pkg.credits)}</span>
                    <span className="text-sm text-muted-foreground">نقطة فيديو</span>
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="font-bold text-primary">{fmt(pkg.price_sar)} ر.س</span>{" "}
                    <span className="text-xs text-muted-foreground">~{pricePerCredit.toFixed(1)} هللة لكل 1000 نقطة</span>
                  </div>
                  <p className="mt-3 rounded-lg bg-secondary/60 p-2 text-xs text-muted-foreground">
                    مناسب عند إطلاق عرض جديد أو تشغيل عدة نسخ فيديو للحملة نفسها.
                  </p>

                  <Button
                    className="mt-4 w-full"
                    variant={isMid ? "default" : "outline"}
                    disabled={Boolean(pendingPurchase) || submittingId === pkg.id}
                    onClick={() => handleCreatePurchase(pkg)}
                  >
                    {submittingId === pkg.id ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> جاري الإنشاء…</>
                    ) : pendingPurchase ? (
                      "أكمل الطلب الحالي أولاً"
                    ) : (
                      <><Plus className="h-4 w-4" /> اشحن الآن</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Purchase History */}
      {purchases.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-bold">سجل الشحنات</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="divide-y divide-border">
              {purchases.map((p) => {
                const meta = STATUS_META[p.status];
                const Icon = meta.icon;
                return (
                  <div key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-gold" />
                        <span className="font-bold tabular-nums">{fmt(p.credits)} نقطة فيديو</span>
                        <span className="text-xs text-muted-foreground">
                          · {fmt(p.price_sar)} ر.س
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("ar-SA")}
                        {p.activated_at && ` · فُعّل ${new Date(p.activated_at).toLocaleDateString("ar-SA")}`}
                      </p>
                      {p.admin_notes && (
                        <p className="mt-1 text-[11px] text-muted-foreground">📝 {p.admin_notes}</p>
                      )}
                    </div>
                    <span className={cn("inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[11px] font-bold", meta.tone)}>
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Trust footer */}
      <div className="mt-8 rounded-xl border border-border bg-secondary/30 p-4 text-center">
        <Crown className="mx-auto h-5 w-5 text-gold" />
          <p className="mt-2 text-xs text-muted-foreground">
          نقاط الشحن الإضافية تبقى في رصيدك بعد تجدد الباقة · يتم التفعيل خلال 24 ساعة
        </p>
      </div>
    </DashboardShell>
  );
}
