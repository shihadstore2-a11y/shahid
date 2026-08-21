/**
 * Phase 4 — دفتر نقاط الفيديو (Credit Ledger Audit) للأدمن
 *
 * يعرض كل حركات النقاط مع فلترة بنوع المعاملة + المستخدم،
 * ويسمح بإجراء ضبط يدوي (منح/سحب) مع توثيق السبب.
 */

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  Plus,
  Wand2,
  Coins,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  listCreditLedger,
  adminAdjustCredits,
  type AdminLedgerEntry,
} from "@/server/admin-credits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/credit-ledger")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "دفتر نقاط الفيديو — رِفد" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل الدفتر…">
      <CreditLedgerPage />
    </AdminGuard>
  ),
});

const TXN_LABELS: Record<string, string> = {
  plan_grant: "منح باقة",
  topup_purchase: "شحن إضافي",
  consume_video: "فيديو",
  refund: "استرجاع",
  admin_adjust: "ضبط يدوي",
  expire: "انتهاء صلاحية",
};

const TXN_TONES: Record<string, string> = {
  plan_grant: "bg-primary/15 text-primary",
  topup_purchase: "bg-success/15 text-success",
  consume_video: "bg-muted text-muted-foreground",
  refund: "bg-warning/20 text-warning-foreground",
  admin_adjust: "bg-gold/15 text-gold",
  expire: "bg-destructive/10 text-destructive",
};

function fmt(n: number) {
  return n.toLocaleString("ar-SA");
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });
}

function CreditLedgerPage() {
  const fetchList = useServerFn(listCreditLedger);
  const doAdjust = useServerFn(adminAdjustCredits);

  const [entries, setEntries] = useState<AdminLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchUser, setSearchUser] = useState("");

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjUser, setAdjUser] = useState("");
  const [adjAmount, setAdjAmount] = useState<string>("");
  const [adjSource, setAdjSource] = useState<"plan" | "topup">("topup");
  const [adjReason, setAdjReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("لا توجد جلسة");
      const r = await fetchList({
        data: { txnType: filterType as never, limit: 200 },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setEntries(r.entries);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحميل");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  async function handleAdjust() {
    const amount = parseInt(adjAmount, 10);
    if (!adjUser.trim()) return toast.error("أدخل user_id صالح");
    if (!Number.isFinite(amount) || amount === 0) return toast.error("أدخل كمية صحيحة (موجبة أو سالبة)");
    if (adjReason.trim().length < 5) return toast.error("اكتب سبباً واضحاً (5 أحرف على الأقل)");

    setAdjusting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("لا توجد جلسة");
      const r = await doAdjust({
        data: { userId: adjUser.trim(), amount, source: adjSource, reason: adjReason },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      toast.success(
        `✅ ${amount > 0 ? "مُنح" : "سُحب"} ${fmt(Math.abs(amount))} نقطة فيديو — الرصيد الجديد: plan=${fmt(r.new_plan)}, topup=${fmt(r.new_topup)}`
      );
      setAdjustOpen(false);
      setAdjUser(""); setAdjAmount(""); setAdjReason("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الضبط");
    } finally {
      setAdjusting(false);
    }
  }

  const filtered = entries.filter((e) => {
    if (!searchUser.trim()) return true;
    const s = searchUser.toLowerCase();
    return e.user_email?.toLowerCase().includes(s) || e.user_id.toLowerCase().includes(s);
  });

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Coins className="h-6 w-6 text-gold" /> دفتر نقاط الفيديو
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تدقيق كامل لكل حركات نقاط الفيديو — للمراجعة والاسترجاع وحل النزاعات
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> تحديث
          </Button>
          <Button size="sm" onClick={() => setAdjustOpen(true)}>
            <Wand2 className="h-4 w-4" /> ضبط يدوي
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحركات</SelectItem>
            {Object.entries(TXN_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث بالمستخدم: إيميل / user_id…"
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
            className="pr-9"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          <Coins className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p>لا توجد حركات</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {filtered.map((e) => {
              const isPositive = e.amount > 0;
              const Icon = isPositive ? TrendingUp : TrendingDown;
              return (
                <div key={e.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn(TXN_TONES[e.txn_type] ?? "bg-muted")}>
                        {TXN_LABELS[e.txn_type] ?? e.txn_type}
                      </Badge>
                      {e.refunded_at && (
                        <Badge variant="outline" className="text-warning-foreground">مُسترجع</Badge>
                      )}
                      <span className={cn("flex items-center gap-1 text-sm font-bold tabular-nums", isPositive ? "text-success" : "text-destructive")}>
                        <Icon className="h-3.5 w-3.5" />
                        {isPositive ? "+" : ""}{fmt(e.amount)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        ({e.source ?? "—"})
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{e.user_email ?? e.user_id.slice(0, 8)}</span>
                      <span className="mx-1">·</span>
                      <span>{fmtDate(e.created_at)}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      رصيد بعد: plan={fmt(e.balance_after_plan)} · topup={fmt(e.balance_after_topup)}
                      {e.metadata && typeof e.metadata === "object" && "reason" in e.metadata && (
                        <span> · 📝 {String((e.metadata as { reason?: string }).reason)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-gold" /> ضبط يدوي لنقاط الفيديو
            </DialogTitle>
            <DialogDescription>
              منح أو سحب نقاط فيديو من مستخدم. كل عملية موثَّقة في الدفتر وفي سجل التدقيق.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">User ID *</label>
              <Input
                placeholder="UUID للمستخدم"
                value={adjUser}
                onChange={(e) => setAdjUser(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">الكمية * (سالب للسحب)</label>
                <Input
                  type="number"
                  placeholder="مثال: 1000 أو -500"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">المصدر</label>
                <Select value={adjSource} onValueChange={(v) => setAdjSource(v as typeof adjSource)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="topup">شحن إضافي</SelectItem>
                    <SelectItem value="plan">باقة شهرية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">السبب *</label>
              <Textarea
                placeholder="مثال: تعويض عن خطأ في توليد سابق / منحة مجانية / تصحيح حركة قديمة"
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex items-start gap-2 rounded-md bg-warning/10 p-2.5 text-[11px] text-warning-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>هذه العملية موثَّقة ولا يمكن التراجع عنها تلقائياً — أي تصحيح يحتاج عملية ضبط معاكسة.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>إلغاء</Button>
            <Button onClick={() => void handleAdjust()} disabled={adjusting}>
              {adjusting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> جاري الضبط…</>
              ) : (
                <><Plus className="h-4 w-4" /> تأكيد</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
