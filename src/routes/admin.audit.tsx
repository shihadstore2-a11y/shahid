import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { Loader2, RefreshCw, ArrowLeft, Filter, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
// useAuth removed — protection handled by <AdminGuard>
import { supabase } from "@/integrations/supabase/client";
import {
  listAdminAudit,
  type AuditEntry,
  type AuditFacets,
} from "@/server/admin-audit";

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => {
    if (value === null || value === undefined) return "—";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);
  const isEmpty = text === "—";
  const onCopy = async () => {
    if (isEmpty) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`تم نسخ ${label}`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("تعذّر النسخ");
    }
  };
  return (
    <div className="rounded-lg border border-border bg-muted/30">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-bold">{label}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={onCopy}
          disabled={isEmpty}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "تم" : "نسخ"}
        </Button>
      </div>
      <pre
        dir="ltr"
        className="max-h-[40vh] overflow-auto px-3 py-2 text-left text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words"
      >
        {text}
      </pre>
    </div>
  );
}

export const Route = createFileRoute("/admin/audit")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "سجل تعديلات الأدمن — رِفد" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل سجل التعديلات…">
      <AdminAuditPage />
    </AdminGuard>
  ),
});

const ACTION_LABEL: Record<string, string> = {
  update_plan_limit: "تعديل حد باقة",
  create_plan_limit: "إنشاء حد باقة",
  activate_subscription: "تفعيل اشتراك",
  reject_subscription: "رفض اشتراك",
  contact_subscription: "تواصل مع طلب",
  update_subscription_status: "تحديث حالة اشتراك",
  reconcile_usage_logs: "مزامنة عدّادات الاستخدام",
};

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  activate_subscription: "default",
  reject_subscription: "destructive",
  contact_subscription: "secondary",
  update_plan_limit: "outline",
  create_plan_limit: "outline",
  update_subscription_status: "secondary",
  reconcile_usage_logs: "default",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarize(entry: AuditEntry): string {
  const before = entry.before_value as Record<string, unknown> | null;
  const after = entry.after_value as Record<string, unknown> | null;

  if (entry.target_table === "plan_limits") {
    const b = (before?.monthly_limit as number | undefined) ?? "—";
    const a = (after?.monthly_limit as number | undefined) ?? "—";
    return `${entry.target_id}: ${b} → ${a}`;
  }
  if (entry.target_table === "subscription_requests") {
    const meta = entry.metadata as Record<string, unknown> | null;
    const email = (meta?.email as string | undefined) ?? "";
    const plan = (meta?.plan as string | undefined) ?? "";
    const bs = (before?.status as string | undefined) ?? "—";
    const as_ = (after?.status as string | undefined) ?? "—";
    return `${email} (${plan}): ${bs} → ${as_}`;
  }
  if (entry.action === "reconcile_usage_logs") {
    const corrected = (after?.users_corrected as number | undefined) ?? 0;
    return `شهر ${entry.target_id} — صُحِّح ${corrected} مستخدم`;
  }
  return entry.target_id ?? "—";
}

function AdminAuditPage() {
  // الحماية مضمونة عبر <AdminGuard>.
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [facets, setFacets] = useState<AuditFacets>({ actions: [], tables: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState<string>("__all__");
  const [tableFilter, setTableFilter] = useState<string>("__all__");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("سجّل الدخول أولاً");

      const payload: {
        action?: string;
        target_table?: string;
        from?: string;
        to?: string;
        limit: number;
      } = { limit: 200 };
      if (actionFilter !== "__all__") payload.action = actionFilter;
      if (tableFilter !== "__all__") payload.target_table = tableFilter;
      if (fromDate) payload.from = new Date(fromDate).toISOString();
      if (toDate) {
        const t = new Date(toDate);
        t.setHours(23, 59, 59, 999);
        payload.to = t.toISOString();
      }

      const result = await listAdminAudit({
        data: payload,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setEntries(result.entries);
      setFacets(result.facets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التحميل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetFilters = () => {
    setActionFilter("__all__");
    setTableFilter("__all__");
    setFromDate("");
    setToDate("");
  };

  const hasFilters = useMemo(
    () => actionFilter !== "__all__" || tableFilter !== "__all__" || !!fromDate || !!toDate,
    [actionFilter, tableFilter, fromDate, toDate]
  );

  return (
    <DashboardShell>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">سجل تعديلات الأدمن</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            كل تعديلات الأدمن (تفعيل/رفض الاشتراكات، تعديل حدود الباقات) مع قيم قبل/بعد.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> تحديث
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/analytics">التحليلات <ArrowLeft className="h-3.5 w-3.5" /></Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/plan-limits">حدود الباقات</Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">فلاتر</h3>
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={resetFilters} className="ms-auto h-7 text-xs">
              <X className="h-3 w-3" /> مسح
            </Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">الإجراء</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل الإجراءات</SelectItem>
                {facets.actions.map((a) => (
                  <SelectItem key={a} value={a}>{ACTION_LABEL[a] ?? a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">الجدول</Label>
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل الجداول</SelectItem>
                {facets.tables.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from" className="text-xs">من تاريخ</Label>
            <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to" className="text-xs">إلى تاريخ</Label>
            <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={load} disabled={loading}>
            تطبيق الفلاتر
          </Button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "لا توجد نتائج بهذه الفلاتر" : "لا توجد تعديلات بعد"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <p className="mb-3 text-xs text-muted-foreground">
            عرض <span className="font-mono">{entries.length}</span> سجل
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">التاريخ</th>
                  <th className="py-2 font-medium">الأدمن</th>
                  <th className="py-2 font-medium">الإجراء</th>
                  <th className="py-2 font-medium">الجدول</th>
                  <th className="py-2 font-medium">الملخّص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setSelected(e)}
                    className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    tabIndex={0}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        setSelected(e);
                      }
                    }}
                  >
                    <td className="py-2 font-mono text-xs">{fmtDate(e.created_at)}</td>
                    <td className="py-2 text-xs">
                      {e.admin_email ?? <span className="font-mono">{e.admin_user_id.slice(0, 8)}</span>}
                    </td>
                    <td className="py-2">
                      <Badge variant={ACTION_VARIANT[e.action] ?? "outline"} className="text-[10px]">
                        {ACTION_LABEL[e.action] ?? e.action}
                      </Badge>
                    </td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">{e.target_table}</td>
                    <td className="py-2 text-xs">{summarize(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="text-right">
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  <Badge variant={ACTION_VARIANT[selected.action] ?? "outline"} className="text-[10px]">
                    {ACTION_LABEL[selected.action] ?? selected.action}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{selected.target_table}</span>
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {fmtDate(selected.created_at)}
                  {" · "}
                  {selected.admin_email ?? selected.admin_user_id.slice(0, 8)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border bg-muted/30 p-2">
                    <div className="text-muted-foreground">target_id</div>
                    <div dir="ltr" className="mt-0.5 break-all text-left font-mono">
                      {selected.target_id ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2">
                    <div className="text-muted-foreground">id</div>
                    <div dir="ltr" className="mt-0.5 break-all text-left font-mono">
                      {selected.id}
                    </div>
                  </div>
                </div>

                <JsonBlock label="before_value" value={selected.before_value} />
                <JsonBlock label="after_value" value={selected.after_value} />
                <JsonBlock label="metadata" value={selected.metadata} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardShell>
  );
}
