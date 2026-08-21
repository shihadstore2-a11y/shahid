import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { Loader2, Save, RefreshCw, ArrowLeft, History } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// useAuth removed — protection handled by <AdminGuard>
import { supabase } from "@/integrations/supabase/client";
import {
  listPlanLimits,
  updatePlanLimit,
  listAuditLog,
  type PlanLimitRow,
  type AuditLogRow,
} from "@/server/admin-plan-limits";

export const Route = createFileRoute("/admin/plan-limits")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "حدود الباقات — رِفد" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل حدود الباقات…">
      <AdminPlanLimitsPage />
    </AdminGuard>
  ),
});

const PLANS = ["free", "starter", "growth", "pro", "business"] as const;
const KINDS = ["text", "image"] as const;
type Plan = (typeof PLANS)[number];
type Kind = (typeof KINDS)[number];

const PLAN_LABEL: Record<Plan, string> = {
  free: "مجاني",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  business: "Business",
};
const KIND_LABEL: Record<Kind, string> = { text: "نصوص", image: "صور" };

function AdminPlanLimitsPage() {
  // الحماية مضمونة عبر <AdminGuard>.
  const [rows, setRows] = useState<PlanLimitRow[]>([]);
  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const keyOf = (plan: Plan, kind: Kind) => `${plan}:${kind}`;
  const getRow = (plan: Plan, kind: Kind) =>
    rows.find((r) => r.plan === plan && r.kind === kind);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("سجّل الدخول أولاً");
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [limits, log] = await Promise.all([
        listPlanLimits({ headers }),
        listAuditLog({ headers }),
      ]);
      setRows(limits);
      setAudit(log);
      const initial: Record<string, string> = {};
      for (const r of limits) initial[keyOf(r.plan as Plan, r.kind as Kind)] = String(r.monthly_limit);
      setEdits(initial);
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

  const onSave = async (plan: Plan, kind: Kind) => {
    const k = keyOf(plan, kind);
    const raw = edits[k] ?? "";
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
      toast.error("القيمة يجب أن تكون رقمًا صحيحًا بين 0 و 1,000,000");
      return;
    }
    const current = getRow(plan, kind);
    if (current && current.monthly_limit === n) {
      toast.info("لا يوجد تغيير");
      return;
    }
    setSaving(k);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("سجّل الدخول أولاً");
      await updatePlanLimit({
        data: { plan, kind, monthly_limit: n },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      toast.success(`تم حفظ ${PLAN_LABEL[plan]} / ${KIND_LABEL[kind]} = ${n}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={load} variant="outline" size="sm" className="mt-4">
            <RefreshCw className="h-4 w-4" /> حاول مجدداً
          </Button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">حدود الباقات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            راجع سقوف الحماية للنصوص والصور لكل باقة. نقاط الفيديو تُدار من نظام الرصيد والشحن.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" /> تحديث
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/audit">سجل المراجعة</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/analytics">التحليلات <ArrowLeft className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {PLANS.map((plan) => (
          <div key={plan} className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <h3 className="text-base font-bold">{PLAN_LABEL[plan]}</h3>
            <div className="mt-4 space-y-4">
              {KINDS.map((kind) => {
                const k = keyOf(plan, kind);
                const row = getRow(plan, kind);
                const isSaving = saving === k;
                return (
                  <div key={kind} className="space-y-1.5">
                    <Label htmlFor={k} className="text-xs">
                      {KIND_LABEL[kind]} (سقف حماية)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={k}
                        type="number"
                        min={0}
                        max={1_000_000}
                        value={edits[k] ?? ""}
                        onChange={(e) => setEdits((p) => ({ ...p, [k]: e.target.value }))}
                        disabled={isSaving}
                      />
                      <Button
                        size="sm"
                        onClick={() => onSave(plan, kind)}
                        disabled={isSaving || !row}
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        حفظ
                      </Button>
                    </div>
                    {row && (
                      <p className="text-[11px] text-muted-foreground">
                        الحالي: <span className="font-mono">{row.monthly_limit}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Audit log */}
      <div className="mt-8 rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-base font-bold">سجل تعديلات الأدمن (آخر 50)</h3>
        </div>
        {audit.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لا توجد تعديلات بعد.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">التاريخ</th>
                  <th className="py-2 font-medium">الأدمن</th>
                  <th className="py-2 font-medium">الإجراء</th>
                  <th className="py-2 font-medium">الهدف</th>
                  <th className="py-2 font-medium">قبل</th>
                  <th className="py-2 font-medium">بعد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {audit.map((a) => {
                  const before = a.before_value as { monthly_limit?: number } | null;
                  const after = a.after_value as { monthly_limit?: number } | null;
                  return (
                    <tr key={a.id}>
                      <td className="py-2 font-mono text-xs">
                        {new Date(a.created_at).toLocaleString("ar-SA")}
                      </td>
                      <td className="py-2 text-xs">{a.admin_email ?? a.admin_user_id.slice(0, 8)}</td>
                      <td className="py-2 font-mono text-xs">{a.action}</td>
                      <td className="py-2 font-mono text-xs">{a.target_id ?? "—"}</td>
                      <td className="py-2 font-mono">{before?.monthly_limit ?? "—"}</td>
                      <td className="py-2 font-mono">{after?.monthly_limit ?? "—"}</td>
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
