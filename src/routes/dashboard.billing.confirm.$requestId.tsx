import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  CheckCircle2,
  Clock,
  MessageCircle,
  Copy,
  Upload,
  FileCheck2,
  AlertCircle,
  Crown,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Building2,
  Receipt,
  ChevronDown,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { getReceiptSignedUrl, markSubscriptionReceiptUploaded } from "@/server/receipts";
import { PLAN_BY_ID, type PlanId } from "@/lib/plan-catalog";

export const Route = createFileRoute("/dashboard/billing/confirm/$requestId")({
  head: () => ({ meta: [{ title: "تأكيد طلب الاشتراك — رِفد" }] }),
  component: ConfirmRequestPage,
});

const PLAN_LABELS = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  business: "Business",
} as const;
const TRANSFER_REASON = "اشتراك رِفد";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];

type RequestRow = {
  id: string;
  user_id: string;
  plan: "starter" | "growth" | "pro" | "business";
  billing_cycle: string;
  store_name: string | null;
  whatsapp: string;
  email: string;
  notes: string | null;
  status: "pending" | "contacted" | "activated" | "rejected" | "expired";
  receipt_path: string | null;
  receipt_uploaded_at: string | null;
  created_at: string;
};

type Settings = {
  whatsapp_number: string;
  bank_account_holder: string | null;
  bank_iban: string | null;
  bank_name: string | null;
};

function ConfirmRequestPage() {
  const { requestId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [request, setRequest] = useState<RequestRow | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      void navigate({ to: "/auth" });
      return;
    }
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, requestId]);

  // Realtime: تحديث الحالة لحظياً عند تغييرها من الأدمن
  useEffect(() => {
    if (!requestId) return;
    const channel = supabase
      .channel(`request-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "subscription_requests",
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          setRequest((prev) => (prev ? { ...prev, ...(payload.new as RequestRow) } : prev));
          if ((payload.new as RequestRow).status === "activated") {
            toast.success("🎉 تم تفعيل اشتراكك! مرحباً بك في الأعضاء المؤسسين");
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [requestId]);

  async function loadAll() {
    setLoading(true);
    const [reqRes, appRes, payRes] = await Promise.all([
      supabase
        .from("subscription_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle(),
      supabase.from("app_settings").select("whatsapp_number").eq("id", 1).maybeSingle(),
      supabase
        .from("payment_settings")
        .select("bank_name, bank_account_holder, bank_iban")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    if (!reqRes.data) {
      toast.error("لم نجد هذا الطلب");
      void navigate({ to: "/dashboard/billing" });
      return;
    }
    setRequest(reqRes.data as RequestRow);
    setSettings({
      whatsapp_number: appRes.data?.whatsapp_number ?? "966582286215",
      bank_name: payRes.data?.bank_name ?? null,
      bank_account_holder: payRes.data?.bank_account_holder ?? null,
      bank_iban: payRes.data?.bank_iban ?? null,
    });
    setLoading(false);

    if ((reqRes.data as RequestRow).receipt_path) {
      void loadReceiptPreview((reqRes.data as RequestRow).receipt_path!);
    }
  }

  async function loadReceiptPreview(path: string) {
    try {
      const data = await getReceiptSignedUrl({ data: { path } });
      if (data.url) setPreviewUrl(data.url);
    } catch (err) {
      console.warn("[billing-confirm] failed to load receipt preview", err);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !request) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("النوع غير مدعوم. الرجاء رفع JPG, PNG, WebP أو PDF");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`حجم الملف كبير. الحد الأقصى ${MAX_FILE_SIZE / 1024 / 1024} ميجابايت`);
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/${request.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-receipts")
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        toast.error(`فشل الرفع: ${uploadError.message}`);
        return;
      }

      await markSubscriptionReceiptUploaded({ data: { requestId: request.id, path } });

      // Fire-and-forget OCR check (admin-side note only, never blocks user)
      const { data: { session } } = await supabase.auth.getSession();
      void fetch("/api/public/hooks/ocr-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ request_id: request.id }),
      }).catch(() => {});

      toast.success("✅ تم رفع الإيصال — رائع! سيُسرّع التفعيل");
      await loadAll();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function copyToClipboard(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label}`);
  }

  if (authLoading || loading) {
    return (
      <DashboardShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardShell>
    );
  }

  if (!request) return null;

  const planInfo = PLAN_BY_ID[request.plan as PlanId];
  const price = request.billing_cycle === "yearly" ? planInfo.yearlyPriceSar : planInfo.monthlyPriceSar;
  const planLabel = PLAN_LABELS[request.plan];
  const cycleLabel = request.billing_cycle === "yearly" ? "سنوي" : "شهري";
  const isActivated = request.status === "activated";
  const isRejected = request.status === "rejected";
  const hasReceipt = Boolean(request.receipt_path);
  const shortId = request.id.slice(0, 4).toUpperCase();

  // بيانات البنك
  const bankHolder = settings?.bank_account_holder ?? "محمود محمد علي";
  const bankIban = settings?.bank_iban ?? "SA0805000068204185025000";
  const bankName = settings?.bank_name ?? "مصرف الإنماء";
  const bankAccountNumber = "68204185025000";
  const whatsappNumber = settings?.whatsapp_number ?? "966582286215";

  const waConfirmUrl = buildConfirmedWhatsappUrl({
    whatsappNumber,
    shortId,
    planLabel,
    cycleLabel,
    price,
    storeName: request.store_name,
  });
  const waHelpUrl = buildHelpWhatsappUrl({
    whatsappNumber,
    shortId,
    planLabel,
  });

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl">
        {/* Back link */}
        <Link
          to="/dashboard/billing"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-3 w-3 rotate-180" /> العودة للفوترة
        </Link>

        {/* Status banners */}
        {isActivated && <ActivatedBanner />}
        {isRejected && <RejectedBanner whatsappUrl={waHelpUrl} />}

        {!isActivated && !isRejected && (
          <>
            {/* Slim status bar */}
            <StatusBar status={request.status} hasReceipt={hasReceipt} />

            {/* Order summary card */}
            <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">رقم الطلب</p>
                  <p className="font-mono text-lg font-extrabold">#{shortId}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">الباقة</p>
                  <p className="font-bold">
                    {planLabel} <span className="text-xs text-muted-foreground">({cycleLabel})</span>
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-muted-foreground">المبلغ</p>
                  <p className="text-2xl font-extrabold text-primary">
                    {price.toLocaleString("ar-SA")}{" "}
                    <span className="text-sm font-normal text-muted-foreground">ر.س</span>
                  </p>
                </div>
              </div>
            </section>

            {/* Bank transfer details — the heart of the page */}
            <section className="mt-4 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6 shadow-elegant">
              <h2 className="mb-1 text-lg font-bold">حوّل المبلغ على هذا الحساب</h2>
              <p className="mb-5 text-xs text-muted-foreground">
                انسخ التفاصيل، افتح تطبيق بنكك، وحوّل المبلغ. ثم اضغط الزر الأخضر بالأسفل.
              </p>

              <div className="space-y-3">
                <BankRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="البنك"
                  value={bankName}
                />
                <BankRow
                  label="اسم المستفيد"
                  value={bankHolder}
                  copyable
                  onCopy={() => copyToClipboard(bankHolder, "اسم المستفيد")}
                />
                <BankRow
                  label="رقم الحساب"
                  value={bankAccountNumber}
                  copyable
                  ltr
                  onCopy={() => copyToClipboard(bankAccountNumber, "رقم الحساب")}
                />
                <BankRow
                  label="رقم الآيبان (IBAN)"
                  value={bankIban}
                  copyable
                  ltr
                  highlighted
                  onCopy={() => copyToClipboard(bankIban, "رقم الآيبان")}
                />

                {/* Transfer reason — bright orange box, single static value */}
                <div className="rounded-xl border-2 border-warning/50 bg-warning/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-warning">
                        ⚠️ سبب التحويل (مهم — ضعه كما هو)
                      </div>
                      <div className="mt-1.5 text-lg font-extrabold text-foreground">
                        {TRANSFER_REASON}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(TRANSFER_REASON, "سبب التحويل")}
                      className="shrink-0 bg-warning text-warning-foreground hover:bg-warning/90"
                    >
                      <Copy className="ml-1 h-3 w-3" /> نسخ
                    </Button>
                  </div>
                </div>

                {/* Final amount — copyable */}
                <BankRow
                  label="المبلغ"
                  value={`${price} ر.س`}
                  copyable
                  highlighted
                  onCopy={() => copyToClipboard(String(price), "المبلغ")}
                />
              </div>

              {/* QR for IBAN */}
              <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-medium text-muted-foreground">امسح لنسخ الآيبان بسرعة</p>
                <div className="rounded-lg bg-white p-3">
                  <QRCodeSVG value={bankIban} size={128} level="M" />
                </div>
                <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                  {bankIban}
                </p>
              </div>
            </section>

            {/* HERO CTA — confirm payment via WhatsApp */}
            <section className="mt-4 rounded-2xl border-2 border-success bg-gradient-to-br from-success/10 via-success/5 to-transparent p-6 shadow-elegant">
              <h2 className="text-center text-xl font-extrabold">بعد ما تحوّل المبلغ</h2>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                اضغط الزر وأرسل لنا الرسالة الجاهزة على واتساب — التفعيل خلال دقائق ⚡
              </p>
              <Button
                asChild
                size="lg"
                className="mt-4 h-14 w-full bg-success text-base font-bold text-success-foreground shadow-elegant hover:bg-success/90"
              >
                <a href={waConfirmUrl} target="_blank" rel="noopener noreferrer">
                  <CheckCircle2 className="ml-2 h-5 w-5" />
                  ✅ أكدت الدفع — تواصل عبر واتساب
                </a>
              </Button>

              <div className="mt-3 text-center">
                <a
                  href={waHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <MessageCircle className="h-3 w-3" /> محتاج مساعدة في الدفع؟
                </a>
              </div>
            </section>

            {/* Optional receipt upload — collapsed by default */}
            <details className="group mt-4 rounded-2xl border border-border bg-card shadow-soft">
              <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-bold">
                    ارفع إيصال التحويل (اختياري — لتسريع التفعيل ⚡)
                  </span>
                  {hasReceipt && (
                    <Badge className="bg-success/15 text-success hover:bg-success/15">
                      ✓ تم الرفع
                    </Badge>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>

              <div className="border-t border-border p-5">
                {hasReceipt ? (
                  <div className="rounded-xl border-2 border-success/40 bg-success/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <FileCheck2 className="mt-0.5 h-6 w-6 shrink-0 text-success" />
                        <div>
                          <p className="font-bold text-success">تم استلام إيصالك</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            رُفع في {new Date(request.receipt_uploaded_at!).toLocaleString("ar-SA")}
                          </p>
                        </div>
                      </div>
                      {previewUrl && (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-border bg-card p-1 transition hover:scale-105"
                        >
                          {previewUrl.includes(".pdf") ? (
                            <div className="flex h-20 w-20 items-center justify-center rounded bg-muted">
                              <Receipt className="h-8 w-8 text-muted-foreground" />
                            </div>
                          ) : (
                            <img
                              src={previewUrl}
                              alt="إيصال التحويل"
                              className="h-20 w-20 rounded object-cover"
                            />
                          )}
                        </a>
                      )}
                    </div>
                    {request.status === "pending" && (
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="ml-1 h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="ml-1 h-3 w-3" />
                        )}
                        استبدال الإيصال
                      </Button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-background p-6 transition",
                      "hover:border-success hover:bg-success/5",
                      uploading && "cursor-not-allowed opacity-60"
                    )}
                  >
                    {uploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-success" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-bold">
                        {uploading ? "جاري الرفع..." : "اضغط لرفع لقطة شاشة من إشعار البنك"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        JPG, PNG, WebP أو PDF • حد أقصى 5MB
                      </p>
                    </div>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </details>

            {/* Trust footer */}
            <div className="mt-4 rounded-xl border border-success/20 bg-success/5 p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <div className="text-xs text-muted-foreground">
                  <strong className="text-foreground">ضمان الخدمة:</strong> إذا لم يتم تفعيل اشتراكك خلال 24 ساعة من تأكيد الدفع،
                  ستحصل على شهر إضافي مجاناً + استرداد كامل عند الطلب خلال 7 أيام بدون أسئلة.
                  بياناتك البنكية محمية ولن نطلب منك أبداً أي معلومات بنكية حساسة.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

// ============= Sub-components =============

function BankRow({
  icon,
  label,
  value,
  copyable,
  ltr,
  highlighted,
  onCopy,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  copyable?: boolean;
  ltr?: boolean;
  highlighted?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border p-3",
        highlighted ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div
          dir={ltr ? "ltr" : undefined}
          className={cn(
            "mt-1 truncate font-bold",
            highlighted ? "text-primary" : "text-foreground",
            ltr ? "font-mono text-sm" : "text-base"
          )}
        >
          {value}
        </div>
      </div>
      {copyable && (
        <Button size="sm" variant="outline" onClick={onCopy} className="shrink-0">
          <Copy className="ml-1 h-3 w-3" /> نسخ
        </Button>
      )}
    </div>
  );
}

function StatusBar({ status, hasReceipt }: { status: string; hasReceipt: boolean }) {
  const steps = useMemo(
    () => [
      { label: "تم استلام الطلب", done: true },
      {
        label: "بانتظار تأكيد الدفع",
        done: status === "contacted",
        active: status === "pending",
      },
      { label: "مراجعة وتفعيل", done: false, active: status === "contacted" },
    ],
    [status]
  );
  // hasReceipt is informational only in this slim bar
  void hasReceipt;

  return (
    <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-xs">
      {steps.map((step, i) => (
        <div key={i} className="flex flex-1 items-center gap-2">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition",
              step.done
                ? "bg-success text-success-foreground"
                : step.active
                  ? "bg-primary text-primary-foreground animate-pulse"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {step.done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
          </div>
          <span
            className={cn(
              "truncate font-medium",
              step.done ? "text-success" : step.active ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <div className={cn("h-0.5 flex-1", step.done ? "bg-success" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}

function ActivatedBanner() {
  return (
    <div className="mt-6 rounded-2xl border-2 border-success bg-gradient-to-br from-success/15 via-success/5 to-transparent p-6 shadow-elegant">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-success">🎉 تم تفعيل اشتراكك!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              مرحباً بك في عائلة الأعضاء المؤسسين. سعرك ثابت مدى الحياة.
            </p>
          </div>
        </div>
        <Button asChild className="bg-success text-success-foreground hover:bg-success/90">
          <Link to="/dashboard">
            <ArrowRight className="ml-2 h-4 w-4 rotate-180" />
            ابدأ الإنشاء الآن
          </Link>
        </Button>
      </div>
    </div>
  );
}

function RejectedBanner({ whatsappUrl }: { whatsappUrl: string }) {
  return (
    <div className="mt-6 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
        <div className="flex-1">
          <h2 className="text-lg font-bold text-destructive">تم رفض الطلب</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            للأسف لم نستطع تأكيد هذا الطلب. تواصل معنا عبر واتساب لمعرفة السبب وحل المشكلة.
          </p>
          <Button asChild className="mt-3 bg-success text-success-foreground hover:bg-success/90">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="ml-2 h-4 w-4" /> تواصل مع الدعم
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function buildConfirmedWhatsappUrl({
  whatsappNumber,
  shortId,
  planLabel,
  cycleLabel,
  price,
  storeName,
}: {
  whatsappNumber: string;
  shortId: string;
  planLabel: string;
  cycleLabel: string;
  price: number;
  storeName: string | null;
}) {
  const lines = [
    "السلام عليكم 👋",
    `أكدت تحويل ${price} ر.س`,
    `رقم الطلب: #${shortId}`,
    `الباقة: ${planLabel} (${cycleLabel})`,
    storeName ? `المتجر: ${storeName}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines)}`;
}

function buildHelpWhatsappUrl({
  whatsappNumber,
  shortId,
  planLabel,
}: {
  whatsappNumber: string;
  shortId: string;
  planLabel: string;
}) {
  const lines = [
    "السلام عليكم 👋",
    `محتاج مساعدة في إتمام الدفع`,
    `رقم الطلب: #${shortId}`,
    `الباقة: ${planLabel}`,
  ].join("\n");
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines)}`;
}
