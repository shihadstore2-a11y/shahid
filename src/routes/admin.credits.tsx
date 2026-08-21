/**
 * Phase 4 — إدارة شحن نقاط الفيديو (Admin)
 *
 * يعرض كل طلبات الشحن مع فلترة بالحالة + أزرار تفعيل/رفض + معاينة الإيصال.
 * كل عملية تُسجَّل في admin_audit_log عبر server functions.
 */

import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Receipt,
  Clock,
  FileCheck2,
  AlertCircle,
  RefreshCw,
  Coins,
  Search,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  listAdminTopups,
  activateTopup,
  rejectTopup,
  getTopupReceiptUrl,
  type AdminTopupPurchase,
} from "@/server/admin-credits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/credits")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "إدارة شحن نقاط الفيديو — رِفد" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل إدارة نقاط الفيديو…">
      <AdminCreditsPage />
    </AdminGuard>
  ),
});

const STATUS_TABS: Array<{ value: AdminTopupPurchase["status"] | "all"; label: string; tone: string }> = [
  { value: "all", label: "الكل", tone: "bg-muted" },
  { value: "paid", label: "بانتظار التفعيل", tone: "bg-warning/15 text-warning-foreground" },
  { value: "pending", label: "بدون إيصال", tone: "bg-muted/50" },
  { value: "activated", label: "مُفعَّل", tone: "bg-success/15 text-success" },
  { value: "rejected", label: "مرفوض", tone: "bg-destructive/15 text-destructive" },
  { value: "refunded", label: "مُرتجع", tone: "bg-muted text-muted-foreground" },
];

const STATUS_BADGE: Record<AdminTopupPurchase["status"], { label: string; icon: typeof Clock; tone: string }> = {
  pending: { label: "بانتظار إيصال", icon: Clock, tone: "bg-muted/50" },
  paid: { label: "بانتظار التفعيل", icon: FileCheck2, tone: "bg-warning/20 text-warning-foreground" },
  activated: { label: "مُفعَّل", icon: CheckCircle2, tone: "bg-success/15 text-success" },
  rejected: { label: "مرفوض", icon: AlertCircle, tone: "bg-destructive/15 text-destructive" },
  refunded: { label: "مُرتجع", icon: RefreshCw, tone: "bg-muted text-muted-foreground" },
};

function fmt(n: number) {
  return n.toLocaleString("ar-SA");
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });
}

function AdminCreditsPage() {
  const fetchList = useServerFn(listAdminTopups);
  const fetchUrl = useServerFn(getTopupReceiptUrl);
  const doActivate = useServerFn(activateTopup);
  const doReject = useServerFn(rejectTopup);

  const [filter, setFilter] = useState<AdminTopupPurchase["status"] | "all">("paid");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AdminTopupPurchase[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<AdminTopupPurchase | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Activate dialog
  const [activateTarget, setActivateTarget] = useState<AdminTopupPurchase | null>(null);
  const [activateNotes, setActivateNotes] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("لا توجد جلسة");
      const r = await fetchList({
        data: { status: filter },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setRows(r.rows);
      setCounts(r.counts);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحميل");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function openReceipt(path: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const r = await fetchUrl({
        data: { path },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      window.open(r.url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل فتح الإيصال");
    }
  }

  async function handleActivate() {
    if (!activateTarget) return;
    setActionId(activateTarget.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("لا توجد جلسة");
      const r = await doActivate({
        data: { purchaseId: activateTarget.id, adminNotes: activateNotes || undefined },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      toast.success(`✅ تم تفعيل ${fmt(r.credits_added)} نقطة فيديو — رصيد المستخدم الآن: ${fmt(r.new_topup_balance)}`);
      setActivateTarget(null);
      setActivateNotes("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التفعيل");
    } finally {
      setActionId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      toast.error("اكتب سبباً واضحاً (3 أحرف على الأقل)");
      return;
    }
    setActionId(rejectTarget.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("لا توجد جلسة");
      await doReject({
        data: { purchaseId: rejectTarget.id, reason: rejectReason },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      toast.success("تم رفض الطلب");
      setRejectTarget(null);
      setRejectReason("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الرفض");
    } finally {
      setActionId(null);
    }
  }

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      r.user_email?.toLowerCase().includes(s) ||
      r.user_store?.toLowerCase().includes(s) ||
      r.id.toLowerCase().includes(s)
    );
  });

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Coins className="h-6 w-6 text-gold" /> إدارة شحن نقاط الفيديو
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            راجع طلبات شحن نقاط الفيديو، فعّلها أو ارفضها مع توثيق كامل
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> تحديث
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/credit-ledger">
              <Settings2 className="h-4 w-4" /> دفتر نقاط الفيديو
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/reconcile">
              <RefreshCw className="h-4 w-4" /> مزامنة الاستخدام
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATUS_TABS.filter((t) => t.value !== "all").map((t) => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={cn(
              "rounded-xl border p-3 text-right transition-all",
              filter === t.value ? "border-primary shadow-elegant" : "border-border hover:border-primary/40"
            )}
          >
            <p className="text-[11px] text-muted-foreground">{t.label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{fmt(counts[t.value as string] ?? 0)}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_TABS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث: إيميل / متجر / ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <Receipt className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="text-sm">لا توجد طلبات بهذه الحالة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const meta = STATUS_BADGE[r.status];
            const Icon = meta.icon;
            const canActivate = r.status === "paid" || r.status === "pending";
            const canReject = r.status !== "activated" && r.status !== "rejected" && r.status !== "refunded";
            return (
              <div
                key={r.id}
                className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("gap-1", meta.tone)}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </Badge>
                      <span className="text-sm font-bold tabular-nums">{fmt(r.credits)} نقطة فيديو</span>
                      <span className="text-xs text-muted-foreground">· {fmt(r.price_sar)} ر.س</span>
                      <span className="text-[10px] text-muted-foreground">· {r.package_id}</span>
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {r.user_store || r.user_email || r.user_id.slice(0, 8)}
                      </span>
                      {r.user_email && <span> · {r.user_email}</span>}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      أُنشئ: {fmtDate(r.created_at)}
                      {r.activated_at && ` · فُعِّل: ${fmtDate(r.activated_at)}`}
                    </div>
                    {r.admin_notes && (
                      <p className="mt-1.5 text-xs text-muted-foreground">📝 {r.admin_notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {r.receipt_path && (
                      <Button size="sm" variant="outline" onClick={() => void openReceipt(r.receipt_path!)}>
                        <Receipt className="h-3.5 w-3.5" /> عرض الإيصال
                      </Button>
                    )}
                    {canActivate && (
                      <Button
                        size="sm"
                        onClick={() => { setActivateTarget(r); setActivateNotes(""); }}
                        disabled={actionId === r.id || !r.receipt_path}
                        title={!r.receipt_path ? "لا يوجد إيصال — فعّل بعد رفع الإيصال" : ""}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> تفعيل
                      </Button>
                    )}
                    {canReject && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { setRejectTarget(r); setRejectReason(""); }}
                        disabled={actionId === r.id}
                      >
                        <XCircle className="h-3.5 w-3.5" /> رفض
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Activate Dialog */}
      <Dialog open={!!activateTarget} onOpenChange={(v) => !v && setActivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفعيل طلب الشحن</DialogTitle>
            <DialogDescription>
              سيتم إضافة <span className="font-bold tabular-nums">{fmt(activateTarget?.credits ?? 0)}</span> نقطة فيديو لرصيد
              المستخدم <span className="font-bold">{activateTarget?.user_email || activateTarget?.user_id}</span>.
              هذه العملية موثَّقة ولا يمكن التراجع عنها (يمكنك الاسترجاع لاحقاً).
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs font-medium">ملاحظة إدارية (اختياري)</label>
            <Textarea
              placeholder="مثال: تأكيد التحويل من بنك الراجحي بتاريخ ٢٤/٠٤"
              value={activateNotes}
              onChange={(e) => setActivateNotes(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateTarget(null)}>إلغاء</Button>
            <Button onClick={() => void handleActivate()} disabled={actionId === activateTarget?.id}>
              {actionId === activateTarget?.id ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> جاري التفعيل…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> تأكيد التفعيل</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(v) => !v && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رفض طلب الشحن</DialogTitle>
            <DialogDescription>
              سيتم إعلام المستخدم بسبب الرفض. اكتب سبباً واضحاً وموجزاً.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs font-medium">سبب الرفض *</label>
            <Textarea
              placeholder="مثال: الإيصال غير واضح، أو المبلغ المحوَّل لا يطابق سعر الباقة"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={() => void handleReject()}
              disabled={actionId === rejectTarget?.id || rejectReason.trim().length < 3}
            >
              {actionId === rejectTarget?.id ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> جاري الرفض…</>
              ) : (
                <><XCircle className="h-4 w-4" /> تأكيد الرفض</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
