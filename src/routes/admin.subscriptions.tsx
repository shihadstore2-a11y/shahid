import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import {
  Loader2,
  Crown,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Receipt,
  FileX,
  Download,
  ExternalLink,
  Bell,
  Settings2,
  Search,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatSaudiPhoneDisplay, normalizeSaudiPhone } from "@/lib/phone";
import { sendTransactionalEmail } from "@/lib/email/send";
import { listAdminSubscriptionRequests, updateAdminSubscriptionStatus } from "@/server/admin-subscriptions";

export const Route = createFileRoute("/admin/subscriptions")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "إدارة الاشتراكات — رِفد" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل إدارة الاشتراكات…">
      <AdminSubscriptionsPage />
    </AdminGuard>
  ),
});

type Req = {
  id: string;
  user_id: string;
  plan: "starter" | "growth" | "pro" | "business";
  billing_cycle: string;
  store_name: string | null;
  whatsapp: string;
  email: string;
  payment_method: string | null;
  notes: string | null;
  admin_notes: string | null;
  status: "pending" | "contacted" | "activated" | "rejected" | "expired";
  receipt_path: string | null;
  receipt_uploaded_at: string | null;
  activated_at: string | null;
  activated_until: string | null;
  created_at: string;
};

const PLAN_LABELS = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  business: "Business",
} as const;

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  contacted: "secondary",
  activated: "default",
  rejected: "destructive",
  expired: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد الانتظار",
  contacted: "تم التواصل",
  activated: "مفعّل",
  rejected: "مرفوض",
  expired: "منتهي",
};

function AdminSubscriptionsPage() {
  const fetchRequests = useServerFn(listAdminSubscriptionRequests);
  const updateRequestStatus = useServerFn(updateAdminSubscriptionStatus);
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    const { requests: rows } = await fetchRequests();
    setRequests(rows as Req[]);
    setLoading(false);
  }

  async function updateStatus(req: Req, newStatus: Req["status"], adminNotes?: string) {
    setSavingId(req.id);
    let result: { activated_until: string | null };
    try {
      result = await updateRequestStatus({ data: { id: req.id, status: newStatus, adminNotes } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل تحديث الطلب");
      setSavingId(null);
      return;
    }

    if (newStatus === "activated") {
      toast.success(`تم تفعيل باقة ${PLAN_LABELS[req.plan]} ومنح نقاط الفيديو للمستخدم ✨`);

      // إرسال بريد إشعار التفعيل للعميل (لا يكسر التدفق إن فشل)
      try {
        const activatedUntilDate = result.activated_until
          ? new Date(result.activated_until).toLocaleDateString("ar-SA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : undefined;
        await sendTransactionalEmail({
          templateName: "subscription-activated",
          recipientEmail: req.email,
          idempotencyKey: `sub-activated-${req.id}`,
          templateData: {
            fullName: req.store_name ?? undefined,
            planLabel: PLAN_LABELS[req.plan],
            billingCycleLabel:
              req.billing_cycle === "yearly" ? "سنوي" : "شهري",
            activatedUntil: activatedUntilDate,
            invoiceUrl: `${window.location.origin}/api/invoice/${req.id}`,
            dashboardUrl: `${window.location.origin}/dashboard/billing`,
          },
        });
      } catch (e) {
        console.warn("فشل إرسال بريد التفعيل:", e);
        toast.warning("تم التفعيل لكن لم يُرسَل بريد الإشعار");
      }
    } else {
      toast.success("تم تحديث حالة الطلب");
    }

    setSavingId(null);
    await loadRequests();
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardShell>
    );
  }

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    contacted: requests.filter((r) => r.status === "contacted").length,
    activated: requests.filter((r) => r.status === "activated").length,
  };

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <Crown className="h-5 w-5 text-gold" /> إدارة الاشتراكات
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            مراجعة طلبات الأعضاء المؤسسين وتفعيل الباقات
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NotificationsTools />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل ({requests.length})</SelectItem>
              <SelectItem value="pending">قيد الانتظار ({counts.pending})</SelectItem>
              <SelectItem value="contacted">تم التواصل ({counts.contacted})</SelectItem>
              <SelectItem value="activated">مفعّل ({counts.activated})</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
              <SelectItem value="expired">منتهي</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="قيد الانتظار 🔥" value={counts.pending} tone="warning" />
        <StatCard label="تم التواصل" value={counts.contacted} tone="info" />
        <StatCard label="مفعّل" value={counts.activated} tone="success" />
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">لا توجد طلبات.</p>
        ) : (
          filtered.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              saving={savingId === r.id}
              onUpdate={updateStatus}
            />
          ))
        )}
      </div>
    </DashboardShell>
  );
}

type DiscoveredChat = {
  chat_id: number;
  type: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  title?: string;
};

type BotInfo = {
  id?: number;
  username?: string;
  first_name?: string;
};

function NotificationsTools() {
  const [setupLoading, setSetupLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [chats, setChats] = useState<DiscoveredChat[]>([]);
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [savingChatId, setSavingChatId] = useState<number | null>(null);

  async function getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function handleSetup() {
    setSetupLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error("الجلسة منتهية، أعد تسجيل الدخول");
        return;
      }
      const res = await fetch("/api/setup-notify-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) toast.success("تم تخزين إعدادات الإشعار ✅");
      else toast.error(`فشل: ${data.error ?? res.status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ غير معروف");
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleTest() {
    setTestLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("internal_config")
        .select("key,value")
        .in("key", ["notify_webhook_secret", "telegram_admin_chat_id"]);

      if (error || !rows || rows.length === 0) {
        toast.error("شغّل 'إعداد الإشعارات' و 'اكتشاف Chat ID' أولاً");
        return;
      }
      const secret = rows.find((r) => r.key === "notify_webhook_secret")?.value;
      const chatId = rows.find((r) => r.key === "telegram_admin_chat_id")?.value;
      if (!secret) {
        toast.error("السرّ غير مخزّن — شغّل 'إعداد الإشعارات' أولاً");
        return;
      }
      if (!chatId) {
        toast.error("Chat ID غير مخزّن — استخدم 'اكتشاف Chat ID' أولاً");
        return;
      }

      const res = await fetch("/api/notify-telegram-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": secret,
        },
        body: JSON.stringify({ test: true, chat_id: chatId }),
      });
      const data = await res.json();
      if (res.ok) toast.success("تم إرسال إشعار تجريبي ✅");
      else toast.error(`فشل: ${data.error ?? res.status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ غير معروف");
    } finally {
      setTestLoading(false);
    }
  }

  async function handleDiscover() {
    setDiscoverLoading(true);
    setDiscoverOpen(true);
    setChats([]);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error("الجلسة منتهية، أعد تسجيل الدخول");
        setDiscoverOpen(false);
        return;
      }
      const res = await fetch("/api/telegram-discover-chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`فشل الاكتشاف: ${data.error ?? res.status}`);
        return;
      }
      setChats(data.chats ?? []);
      setBot(data.bot ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ غير معروف");
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function handleSelectChat(chat: DiscoveredChat) {
    setSavingChatId(chat.chat_id);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error("الجلسة منتهية، أعد تسجيل الدخول");
        return;
      }
      const res = await fetch("/api/telegram-set-chat-id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ chat_id: chat.chat_id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`تم اعتماد المحادثة ✅ (${chat.chat_id})`);
        setDiscoverOpen(false);
      } else {
        toast.error(`فشل الحفظ: ${data.error ?? res.status}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ غير معروف");
    } finally {
      setSavingChatId(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleSetup}
        disabled={setupLoading}
        title="تخزين رابط + سرّ الإشعارات في DB (مرة واحدة)"
      >
        {setupLoading ? (
          <Loader2 className="ml-1 h-3 w-3 animate-spin" />
        ) : (
          <Settings2 className="ml-1 h-3 w-3" />
        )}
        إعداد الإشعارات
      </Button>

      <Dialog open={discoverOpen} onOpenChange={setDiscoverOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDiscover}
            disabled={discoverLoading}
            title="اقرأ آخر المحادثات من البوت واختر وجهة الإشعارات"
          >
            {discoverLoading ? (
              <Loader2 className="ml-1 h-3 w-3 animate-spin" />
            ) : (
              <Search className="ml-1 h-3 w-3" />
            )}
            اكتشاف Chat ID
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>اختر وجهة إشعارات تيليجرام</DialogTitle>
          </DialogHeader>

          {bot?.username && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="text-muted-foreground mb-1">البوت المتصل:</div>
              <a
                href={`https://t.me/${bot.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-primary hover:underline inline-flex items-center gap-1"
                dir="ltr"
              >
                @{bot.username}
                <ExternalLink className="h-3 w-3" />
              </a>
              {bot.first_name && (
                <span className="text-muted-foreground"> · {bot.first_name}</span>
              )}
            </div>
          )}

          <div className="mt-2 space-y-2 max-h-[60vh] overflow-auto">
            {discoverLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!discoverLoading && chats.length === 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm text-foreground space-y-3">
                <p className="font-bold">لم نجد أي محادثات بعد.</p>
                <ol className="list-decimal pr-5 space-y-1 text-muted-foreground">
                  <li>
                    افتح البوت{" "}
                    {bot?.username ? (
                      <a
                        href={`https://t.me/${bot.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        dir="ltr"
                      >
                        @{bot.username}
                      </a>
                    ) : (
                      "في تيليجرام"
                    )}
                    .
                  </li>
                  <li>
                    اضغط <strong>Start</strong> أو أرسل{" "}
                    <code className="rounded bg-muted px-1">/start</code>.
                  </li>
                  <li>أرسل أي رسالة (مثلاً: مرحبا).</li>
                  <li>ارجع هنا واضغط "إعادة المحاولة".</li>
                </ol>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDiscover}
                  disabled={discoverLoading}
                  className="w-full"
                >
                  {discoverLoading ? (
                    <Loader2 className="ml-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Search className="ml-1 h-3 w-3" />
                  )}
                  إعادة المحاولة
                </Button>
              </div>
            )}
            {chats.map((c) => {
              const name =
                c.title ??
                [c.first_name, c.last_name].filter(Boolean).join(" ") ??
                "بدون اسم";
              return (
                <div
                  key={c.chat_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{name}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {c.username ? `@${c.username} · ` : ""}
                      {c.type} · {c.chat_id}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSelectChat(c)}
                    disabled={savingChatId !== null}
                  >
                    {savingChatId === c.chat_id ? (
                      <Loader2 className="ml-1 h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="ml-1 h-3 w-3" />
                    )}
                    استخدم هذا
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Button
        size="sm"
        variant="outline"
        onClick={handleTest}
        disabled={testLoading}
      >
        {testLoading ? (
          <Loader2 className="ml-1 h-3 w-3 animate-spin" />
        ) : (
          <Bell className="ml-1 h-3 w-3" />
        )}
        اختبار تيليجرام
      </Button>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "info" | "success";
}) {
  const colors = {
    warning: "border-warning/40 bg-warning/5 text-warning",
    info: "border-primary/40 bg-primary/5 text-primary",
    success: "border-success/40 bg-success/5 text-success",
  } as const;
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-1 text-3xl font-extrabold">{value}</div>
    </div>
  );
}

function RequestCard({
  request,
  saving,
  onUpdate,
}: {
  request: Req;
  saving: boolean;
  onUpdate: (r: Req, status: Req["status"], notes?: string) => Promise<void>;
}) {
  const [adminNotes, setAdminNotes] = useState(request.admin_notes ?? "");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const normalizedWa = normalizeSaudiPhone(request.whatsapp);
  const waUrl = `https://wa.me/${normalizedWa ?? request.whatsapp.replace(/[^\d]/g, "")}`;
  const hasReceipt = Boolean(request.receipt_path);
  const isPdf = request.receipt_path?.toLowerCase().endsWith(".pdf");

  async function downloadInvoice() {
    setDownloadingInvoice(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("الجلسة منتهية، أعد تسجيل الدخول");
        return;
      }
      const res = await fetch(`/api/invoice/${request.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let msg = `فشل التنزيل (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg = `فشل: ${j.error}`;
        } catch {
          // ignore
        }
        toast.error(msg);
        return;
      }
      const blob = await res.blob();
      // اسم الملف من Content-Disposition إن وُجد، وإلا اسم افتراضي
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] ?? `invoice-${request.id.slice(0, 8)}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("تم تنزيل الفاتورة ✅");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ غير معروف");
    } finally {
      setDownloadingInvoice(false);
    }
  }


  async function loadReceipt() {
    if (!request.receipt_path || receiptUrl) return;
    setLoadingReceipt(true);
    const { data, error } = await supabase.storage
      .from("payment-receipts")
      .createSignedUrl(request.receipt_path, 300);
    setLoadingReceipt(false);
    if (error || !data?.signedUrl) {
      toast.error("فشل تحميل الإيصال");
      return;
    }
    setReceiptUrl(data.signedUrl);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_BADGE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
            <span className="font-bold">{PLAN_LABELS[request.plan]}</span>
            <span className="text-xs text-muted-foreground">
              ({request.billing_cycle === "yearly" ? "سنوي" : "شهري"})
            </span>
            {hasReceipt ? (
              <Badge className="gap-1 bg-success/15 text-success hover:bg-success/15">
                <Receipt className="h-3 w-3" /> إيصال جاهز
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
                <FileX className="h-3 w-3" /> بدون إيصال
              </Badge>
            )}
          </div>
          <h3 className="mt-2 font-bold">{request.store_name || "بدون اسم متجر"}</h3>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>📧 {request.email}</span>
            <span dir="ltr">📱 {formatSaudiPhoneDisplay(request.whatsapp)}</span>
            <span>💳 {request.payment_method === "bank_transfer_sa" ? "تحويل بنكي" : "أخرى"}</span>
            <span>🕐 {new Date(request.created_at).toLocaleString("ar-SA")}</span>
            {request.receipt_uploaded_at && (
              <span className="text-success">
                🧾 رُفع: {new Date(request.receipt_uploaded_at).toLocaleString("ar-SA")}
              </span>
            )}
          </div>
          {request.notes && (
            <p className="mt-2 rounded-md bg-secondary/50 p-2 text-sm">📝 {request.notes}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {hasReceipt && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={loadReceipt}>
                  <Receipt className="ml-1 h-3 w-3" /> عرض الإيصال
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>إيصال التحويل البنكي</DialogTitle>
                </DialogHeader>
                <div className="mt-2 max-h-[70vh] overflow-auto">
                  {loadingReceipt && (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {receiptUrl && !isPdf && (
                    <img
                      src={receiptUrl}
                      alt="إيصال التحويل"
                      className="mx-auto max-h-[60vh] rounded-lg border border-border object-contain"
                    />
                  )}
                  {receiptUrl && isPdf && (
                    <iframe
                      src={receiptUrl}
                      title="إيصال التحويل (PDF)"
                      className="h-[60vh] w-full rounded-lg border border-border"
                    />
                  )}
                </div>
                {receiptUrl && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="ml-1 h-3 w-3" /> فتح في تبويب جديد
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href={receiptUrl} download>
                        <Download className="ml-1 h-3 w-3" /> تحميل
                      </a>
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
          <Button asChild variant="outline" size="sm">
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="ml-1 h-3 w-3" /> واتساب
            </a>
          </Button>
          {request.status === "activated" && (
            <Button
              variant="outline"
              size="sm"
              onClick={downloadInvoice}
              disabled={downloadingInvoice}
              title="تنزيل الفاتورة الضريبية PDF"
            >
              {downloadingInvoice ? (
                <Loader2 className="ml-1 h-3 w-3 animate-spin" />
              ) : (
                <FileText className="ml-1 h-3 w-3" />
              )}
              فاتورة PDF
            </Button>
          )}
        </div>
      </div>

      <Textarea
        value={adminNotes}
        onChange={(e) => setAdminNotes(e.target.value)}
        placeholder="ملاحظات الإدارة (مرئية للأدمن فقط)"
        rows={2}
        className="mt-3"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {request.status !== "contacted" && request.status !== "activated" && (
          <Button
            size="sm"
            variant="secondary"
            disabled={saving}
            onClick={() => onUpdate(request, "contacted", adminNotes)}
          >
            <MessageCircle className="ml-1 h-3 w-3" /> تم التواصل
          </Button>
        )}
        {request.status !== "activated" && (
          <Button
            size="sm"
            disabled={saving}
            onClick={() => onUpdate(request, "activated", adminNotes)}
            className="bg-success text-success-foreground hover:bg-success/90"
          >
            <CheckCircle2 className="ml-1 h-3 w-3" /> تفعيل الباقة
          </Button>
        )}
        {request.status !== "rejected" && (
          <Button
            size="sm"
            variant="destructive"
            disabled={saving}
            onClick={() => onUpdate(request, "rejected", adminNotes)}
          >
            <XCircle className="ml-1 h-3 w-3" /> رفض
          </Button>
        )}
        {saving && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
      </div>
    </div>
  );
}
