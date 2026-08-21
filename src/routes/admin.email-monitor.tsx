import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import {
  Mail,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/email-monitor")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "مراقبة البريد — لوحة الأدمن" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل مراقبة البريد…">
      <EmailMonitorPage />
    </AdminGuard>
  ),
});

type EmailRow = {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

type DlqHealth = {
  auth_dlq: number;
  transactional_dlq: number;
  auth_pending: number;
  transactional_pending: number;
  total_dlq: number;
  checked_at: string;
};

type RangeKey = "24h" | "7d" | "30d";
type StatusFilter = "all" | "sent" | "dlq" | "suppressed" | "pending" | "failed" | "bounced";

const RANGE_HOURS: Record<RangeKey, number> = { "24h": 24, "7d": 168, "30d": 720 };

function statusBadgeClass(status: string): string {
  switch (status) {
    case "sent":
      return "bg-success/15 text-success border-success/30";
    case "dlq":
    case "failed":
    case "bounced":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "suppressed":
    case "complained":
      return "bg-warning/15 text-warning border-warning/30";
    case "pending":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

function formatArDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "short",
      timeStyle: "short",
      calendar: "gregory",
      numberingSystem: "latn",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function EmailMonitorPage() {
  // الحماية مضمونة عبر <AdminGuard> — لا حاجة لإعادة فحص دور الأدمن.
  const [range, setRange] = useState<RangeKey>("7d");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");

  const [rows, setRows] = useState<EmailRow[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [health, setHealth] = useState<DlqHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadAll() {
    setRefreshing(true);
    const sinceIso = new Date(
      Date.now() - RANGE_HOURS[range] * 60 * 60 * 1000
    ).toISOString();

    // Fetch up to 500 rows then dedupe client-side by message_id (latest wins)
    const { data: raw } = await supabase
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(500);

    const seen = new Set<string>();
    const deduped: EmailRow[] = [];
    for (const r of (raw ?? []) as EmailRow[]) {
      const key = r.message_id ?? `__id__${r.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }
    setRows(deduped);

    // distinct templates for filter dropdown
    const tplSet = new Set<string>();
    for (const r of deduped) tplSet.add(r.template_name);
    setTemplates(Array.from(tplSet).sort());

    // DLQ health snapshot (best-effort; admins read via RPC — falls back gracefully)
    try {
      // Direct count from email_send_log as a proxy when RPC isn't reachable from client
      const { data: dlqRows } = await supabase
        .from("email_send_log")
        .select("template_name", { count: "exact", head: false })
        .eq("status", "dlq")
        .gte("created_at", sinceIso);
      const list = (dlqRows ?? []) as Array<{ template_name: string }>;
      const auth_dlq = list.filter((r) => r.template_name === "auth_emails").length;
      const transactional_dlq = list.length - auth_dlq;
      setHealth({
        auth_dlq,
        transactional_dlq,
        auth_pending: 0,
        transactional_pending: 0,
        total_dlq: list.length,
        checked_at: new Date().toISOString(),
      });
    } catch {
      setHealth(null);
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
      return true;
    });
  }, [rows, statusFilter, templateFilter]);

  const stats = useMemo(() => {
    const out = { sent: 0, failed: 0, suppressed: 0, total: rows.length };
    for (const r of rows) {
      if (r.status === "sent") out.sent++;
      else if (["dlq", "failed", "bounced"].includes(r.status)) out.failed++;
      else if (["suppressed", "complained"].includes(r.status)) out.suppressed++;
    }
    return out;
  }, [rows]);

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <Mail className="h-6 w-6 text-primary" />
            مراقبة البريد
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            عرض حيّ لحالة الرسائل المرسلة والفاشلة والمعلّقة في طابور البريد.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadAll()}
            disabled={refreshing}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            تحديث
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/analytics">تحليلات الأدمن</Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">الفترة</label>
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">آخر 24 ساعة</SelectItem>
              <SelectItem value="7d">آخر 7 أيام</SelectItem>
              <SelectItem value="30d">آخر 30 يوم</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">القالب</label>
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل القوالب</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">الحالة</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="sent">مرسلة</SelectItem>
              <SelectItem value="dlq">فاشلة (DLQ)</SelectItem>
              <SelectItem value="suppressed">محظورة</SelectItem>
              <SelectItem value="pending">معلّقة</SelectItem>
              <SelectItem value="bounced">مرتدّة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">إجمالي فريد</div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-extrabold">{stats.total.toLocaleString("ar-SA")}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-success">مرسلة</div>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-success">
            {stats.sent.toLocaleString("ar-SA")}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-destructive">فاشلة (DLQ)</div>
            <XCircle className="h-4 w-4 text-destructive" />
          </div>
          <div
            className={cn(
              "mt-2 text-2xl font-extrabold",
              stats.failed > 0 ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {stats.failed.toLocaleString("ar-SA")}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-warning">محظورة</div>
            <ShieldAlert className="h-4 w-4 text-warning" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-warning">
            {stats.suppressed.toLocaleString("ar-SA")}
          </div>
        </Card>
      </div>

      {/* DLQ health banner */}
      {health && health.total_dlq > 0 && (
        <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <div className="text-sm">
              <div className="font-bold text-destructive">
                يوجد {health.total_dlq} رسالة في طابور الفشل (DLQ)
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Auth DLQ: {health.auth_dlq} • Transactional DLQ: {health.transactional_dlq}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                آخر فحص: {formatArDateTime(health.checked_at)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email log table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-secondary/30 px-4 py-2 text-xs font-bold text-muted-foreground">
          آخر {Math.min(filtered.length, 50)} رسالة (مُلغى التكرار حسب message_id)
        </div>
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-right font-medium">القالب</th>
                <th className="px-4 py-2 text-right font-medium">المستلم</th>
                <th className="px-4 py-2 text-right font-medium">الحالة</th>
                <th className="px-4 py-2 text-right font-medium">التوقيت</th>
                <th className="px-4 py-2 text-right font-medium">خطأ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    لا توجد رسائل تطابق الفلاتر
                  </td>
                </tr>
              )}
              {filtered.slice(0, 50).map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-4 py-2 font-mono text-xs">{r.template_name}</td>
                  <td className="px-4 py-2 text-xs" title={r.recipient_email}>
                    {r.recipient_email.length > 30
                      ? `${r.recipient_email.slice(0, 27)}…`
                      : r.recipient_email}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={statusBadgeClass(r.status)}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground" dir="ltr">
                    {formatArDateTime(r.created_at)}
                  </td>
                  <td
                    className="max-w-[240px] truncate px-4 py-2 text-xs text-destructive/80"
                    title={r.error_message ?? ""}
                  >
                    {r.error_message ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
