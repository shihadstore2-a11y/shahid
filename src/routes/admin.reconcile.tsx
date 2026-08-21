/**
 * Phase 5 — مزامنة usage_logs مع generations الفعلية.
 *
 * تُستدعى RPC `reconcile_usage_logs` (SECURITY DEFINER + admin guard) لكل شهر،
 * وتُعرض النتائج في جدول مرتَّب بمقدار الفجوة لتسهيل التدقيق.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Database,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { reconcileUsageLogs, type ReconcileResult } from "@/server/admin-reconcile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/reconcile")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "مزامنة عدّادات الاستخدام — رِفد" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل أداة المزامنة…">
      <ReconcilePage />
    </AdminGuard>
  ),
});

function fmt(n: number) {
  return n.toLocaleString("ar-SA");
}

function thisMonth(): string {
  // Riyadh time month (مطابق لـ usage-month.ts)
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ReconcilePage() {
  const runReconcile = useServerFn(reconcileUsageLogs);
  const [month, setMonth] = useState<string>(thisMonth());
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReconcileResult | null>(null);

  const sortedRows = useMemo(() => {
    if (!result) return [];
    return [...result.rows].sort(
      (a, b) => Math.abs(b.text_diff) + Math.abs(b.image_diff) - (Math.abs(a.text_diff) + Math.abs(a.image_diff))
    );
  }, [result]);

  async function handleRun() {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      toast.error("صيغة الشهر يجب أن تكون YYYY-MM");
      return;
    }
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("سجّل الدخول أولاً");
      const r = await runReconcile({
        data: { month },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setResult(r);
      if (r.users_corrected === 0) {
        toast.success("✅ كل العدّادات متطابقة — لا حاجة لتصحيح");
      } else {
        toast.success(`تمت مزامنة ${fmt(r.users_corrected)} مستخدم`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشلت المزامنة");
    } finally {
      setRunning(false);
    }
  }

  // تشغيل تلقائي للشهر الحالي عند الفتح (read-only — يعرض الفجوات بدون تعديل لأن الـRPC يصحّح؛
  // لذا نتركه يدوياً للتحكم).
  useEffect(() => {
    setResult(null);
  }, [month]);

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Database className="h-6 w-6 text-gold" /> مزامنة عدّادات الاستخدام
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            يقارن العدّادات في <code className="font-mono text-xs">usage_logs</code> مع
            العدد الفعلي في <code className="font-mono text-xs">generations</code> لشهر معيَّن،
            ويصحّح أي فجوات تلقائياً (مثلاً إذا فشل التريغر سابقاً). يُسجَّل في سجل التدقيق.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/credit-ledger">
              <ArrowLeft className="h-3.5 w-3.5" /> دفتر نقاط الفيديو
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/audit">
              <History className="h-3.5 w-3.5" /> سجل التدقيق
            </Link>
          </Button>
        </div>
      </div>

      {/* Run controls */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="month" className="text-xs">الشهر (YYYY-MM)</Label>
            <Input
              id="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="2026-04"
              className="mt-1 font-mono"
              disabled={running}
            />
          </div>
          <Button onClick={() => void handleRun()} disabled={running} className="gap-2">
            {running ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> جاري المزامنة…</>
            ) : (
              <><RefreshCw className="h-4 w-4" /> ابدأ المزامنة</>
            )}
          </Button>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-md bg-warning/10 p-2.5 text-[11px] text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            تشغيل المزامنة يُعدِّل <code className="font-mono">usage_logs</code> مباشرةً لمطابقة
            <code className="font-mono"> generations</code>. لا يمكن التراجع — لكن العملية idempotent (تشغيلها مرتين لا يضرّ).
          </span>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] text-muted-foreground">الشهر</p>
              <p className="mt-1 font-mono text-lg font-bold">{result.month}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] text-muted-foreground">مستخدمون مُصحَّحون</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{fmt(result.users_corrected)}</p>
            </div>
            <div
              className={cn(
                "rounded-xl border p-4",
                result.total_text_diff === 0
                  ? "border-success/30 bg-success/5"
                  : "border-warning/30 bg-warning/5"
              )}
            >
              <p className="text-[11px] text-muted-foreground">فرق النصوص</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">
                {result.total_text_diff > 0 ? "+" : ""}{fmt(result.total_text_diff)}
              </p>
            </div>
            <div
              className={cn(
                "rounded-xl border p-4",
                result.total_image_diff === 0
                  ? "border-success/30 bg-success/5"
                  : "border-warning/30 bg-warning/5"
              )}
            >
              <p className="text-[11px] text-muted-foreground">فرق الصور</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">
                {result.total_image_diff > 0 ? "+" : ""}{fmt(result.total_image_diff)}
              </p>
            </div>
          </div>

          {/* Empty state */}
          {sortedRows.length === 0 ? (
            <div className="rounded-2xl border border-success/30 bg-success/5 p-10 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success" />
              <p className="text-base font-bold text-success">جميع العدّادات متطابقة ✓</p>
              <p className="mt-1 text-sm text-muted-foreground">
                لا فجوات بين <code className="font-mono">usage_logs</code> و <code className="font-mono">generations</code> لهذا الشهر.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-5 py-3">
                <h3 className="text-sm font-bold">
                  المستخدمون ذوو الفجوات ({fmt(sortedRows.length)})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-right text-sm">
                  <thead className="border-b border-border bg-muted/20 text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">User</th>
                      <th className="py-2.5 px-3 font-medium">نصوص</th>
                      <th className="py-2.5 px-3 font-medium">Δ نص</th>
                      <th className="py-2.5 px-3 font-medium">صور</th>
                      <th className="py-2.5 px-3 font-medium">Δ صور</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedRows.map((r) => (
                      <tr key={r.user_id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-mono text-[11px]" title={r.user_id}>
                          {r.user_id.slice(0, 8)}…
                        </td>
                        <td className="py-2.5 px-3 tabular-nums whitespace-nowrap">
                          <span className="text-muted-foreground">{fmt(r.old_text_count)}</span>
                          <span className="mx-1 text-muted-foreground">→</span>
                          <span className="font-bold">{fmt(r.new_text_count)}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          {r.text_diff !== 0 ? (
                            <Badge
                              className={cn(
                                "tabular-nums",
                                r.text_diff > 0
                                  ? "bg-warning/15 text-warning-foreground"
                                  : "bg-destructive/15 text-destructive"
                              )}
                            >
                              {r.text_diff > 0 ? "+" : ""}{fmt(r.text_diff)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums whitespace-nowrap">
                          <span className="text-muted-foreground">{fmt(r.old_image_count)}</span>
                          <span className="mx-1 text-muted-foreground">→</span>
                          <span className="font-bold">{fmt(r.new_image_count)}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          {r.image_diff !== 0 ? (
                            <Badge
                              className={cn(
                                "tabular-nums",
                                r.image_diff > 0
                                  ? "bg-warning/15 text-warning-foreground"
                                  : "bg-destructive/15 text-destructive"
                              )}
                            >
                              {r.image_diff > 0 ? "+" : ""}{fmt(r.image_diff)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!result && !running && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <Database className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="text-sm">حدِّد الشهر واضغط «ابدأ المزامنة» لعرض النتائج</p>
        </div>
      )}
    </DashboardShell>
  );
}
