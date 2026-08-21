import { useEffect, useMemo, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  MessageCircle,
  Mail,
  Eye,
  Phone,
  Clock,
  CheckCheck,
  CircleDot,
  Archive,
} from "lucide-react";
import {
  getContactSubmissions,
  updateContactStatus,
  type ContactSubmission,
  type ContactStatus,
  type ContactSubmissionsList,
} from "@/server/admin-contact-submissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/contact-submissions")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "رسائل التواصل — لوحة الأدمن" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل رسائل التواصل…">
      <ContactSubmissionsPage />
    </AdminGuard>
  ),
});

type StatusFilter = ContactStatus | "all";

const STATUS_META: Record<
  ContactStatus,
  { label: string; className: string; icon: typeof CircleDot }
> = {
  new: {
    label: "جديدة",
    className:
      "border-primary/40 bg-primary/10 text-primary",
    icon: CircleDot,
  },
  contacted: {
    label: "تم التواصل",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: CheckCheck,
  },
  closed: {
    label: "مغلقة",
    className: "border-muted-foreground/30 bg-muted text-muted-foreground",
    icon: Archive,
  },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `قبل ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `قبل ${hrs} س`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `قبل ${days} يوم`;
  return formatDate(iso);
}

function ContactSubmissionsPage() {
  const fetchList = useServerFn(getContactSubmissions);
  const updateStatus = useServerFn(updateContactStatus);

  const [data, setData] = useState<ContactSubmissionsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selected, setSelected] = useState<ContactSubmission | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await fetchList({
          data: { status: statusFilter, q: debouncedQ, limit: 200 },
        });
        setData(res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "فشل التحميل";
        toast.error(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchList, statusFilter, debouncedQ],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedQ]);

  const onChangeStatus = async (row: ContactSubmission, next: ContactStatus) => {
    if (row.status === next) return;
    setUpdatingId(row.id);
    try {
      await updateStatus({ data: { id: row.id, status: next } });
      toast.success("تم تحديث الحالة");
      // Optimistic local update + refresh counters
      setData((d) =>
        d
          ? {
              ...d,
              rows: d.rows.map((r) => (r.id === row.id ? { ...r, status: next } : r)),
              counts: {
                ...d.counts,
                [row.status]: Math.max(0, d.counts[row.status] - 1),
                [next]: d.counts[next] + 1,
              },
            }
          : d,
      );
      if (selected?.id === row.id) setSelected({ ...row, status: next });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل التحديث";
      toast.error(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const counts = data?.counts ?? { new: 0, contacted: 0, closed: 0 };
  const total = data?.total ?? 0;

  const stats = useMemo(
    () => [
      { key: "all" as const, label: "إجمالي", value: total, tone: "default" },
      { key: "new" as const, label: "جديدة", value: counts.new, tone: "primary" },
      { key: "contacted" as const, label: "تم التواصل", value: counts.contacted, tone: "amber" },
      { key: "closed" as const, label: "مغلقة", value: counts.closed, tone: "muted" },
    ],
    [total, counts],
  );

  return (
    <DashboardShell>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Inbox className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-bold sm:text-2xl">رسائل التواصل</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              إدارة الرسائل الواردة من نموذج "تواصل معنا" — حدّث الحالة بعد الرد.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("ml-2 h-4 w-4", refreshing && "animate-spin")} />
            تحديث
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={cn(
                "rounded-xl border p-4 text-right transition-all hover:shadow-sm",
                statusFilter === s.key
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card",
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-extrabold">{s.value}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو البريد أو الموضوع…"
                className="pr-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="new">جديدة</SelectItem>
                <SelectItem value="contacted">تم التواصل</SelectItem>
                <SelectItem value="closed">مغلقة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Empty */}
        {!loading && data && data.rows.length === 0 && (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-base font-bold">لا توجد رسائل</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {debouncedQ || statusFilter !== "all"
                ? "جرّب تغيير الفلاتر"
                : "ستظهر الرسائل هنا عندما تصل."}
            </p>
          </Card>
        )}

        {/* Desktop table */}
        {!loading && data && data.rows.length > 0 && (
          <>
            <Card className="hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-right">المرسل</th>
                      <th className="px-4 py-3 text-right">الموضوع</th>
                      <th className="px-4 py-3 text-right">الحالة</th>
                      <th className="px-4 py-3 text-right">الوقت</th>
                      <th className="px-4 py-3 text-right">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.rows.map((row) => (
                      <DesktopRow
                        key={row.id}
                        row={row}
                        onView={() => setSelected(row)}
                        onChangeStatus={onChangeStatus}
                        updating={updatingId === row.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {data.rows.map((row) => (
                <MobileCard
                  key={row.id}
                  row={row}
                  onView={() => setSelected(row)}
                  onChangeStatus={onChangeStatus}
                  updating={updatingId === row.id}
                />
              ))}
            </div>
          </>
        )}

        {/* Detail dialog */}
        <DetailDialog
          row={selected}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          onChangeStatus={onChangeStatus}
          updating={!!selected && updatingId === selected.id}
        />
      </div>
    </DashboardShell>
  );
}

// ─────────── Desktop row ───────────
function DesktopRow({
  row,
  onView,
  onChangeStatus,
  updating,
}: {
  row: ContactSubmission;
  onView: () => void;
  onChangeStatus: (row: ContactSubmission, next: ContactStatus) => void;
  updating: boolean;
}) {
  const meta = STATUS_META[row.status];
  return (
    <tr className="hover:bg-muted/20">
      <td className="px-4 py-3 align-top">
        <div className="font-semibold text-foreground">{row.name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
          {row.email}
        </div>
        {row.phone && (
          <div className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
            {row.phone}
          </div>
        )}
      </td>
      <td className="max-w-md px-4 py-3 align-top">
        <div className="line-clamp-1 font-medium text-foreground">{row.subject}</div>
        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {row.message}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <Badge variant="outline" className={cn("gap-1", meta.className)}>
          <meta.icon className="h-3 w-3" />
          {meta.label}
        </Badge>
      </td>
      <td className="px-4 py-3 align-top text-xs text-muted-foreground" title={formatDate(row.created_at)}>
        {formatRelative(row.created_at)}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={onView} title="عرض التفاصيل">
            <Eye className="h-4 w-4" />
          </Button>
          {row.phone && (
            <Button size="sm" variant="ghost" asChild title="واتساب">
              <a
                href={`https://wa.me/${row.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <MessageCircle className="h-4 w-4 text-success" />
              </a>
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild title="بريد">
            <a href={`mailto:${row.email}?subject=Re: ${encodeURIComponent(row.subject)}`}>
              <Mail className="h-4 w-4 text-primary" />
            </a>
          </Button>
          <Select
            value={row.status}
            onValueChange={(v) => onChangeStatus(row, v as ContactStatus)}
            disabled={updating}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">جديدة</SelectItem>
              <SelectItem value="contacted">تم التواصل</SelectItem>
              <SelectItem value="closed">مغلقة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </td>
    </tr>
  );
}

// ─────────── Mobile card ───────────
function MobileCard({
  row,
  onView,
  onChangeStatus,
  updating,
}: {
  row: ContactSubmission;
  onView: () => void;
  onChangeStatus: (row: ContactSubmission, next: ContactStatus) => void;
  updating: boolean;
}) {
  const meta = STATUS_META[row.status];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-foreground">{row.name}</h3>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {row.email}
          </p>
        </div>
        <Badge variant="outline" className={cn("shrink-0 gap-1", meta.className)}>
          <meta.icon className="h-3 w-3" />
          {meta.label}
        </Badge>
      </div>

      <div className="mt-3">
        <p className="line-clamp-1 text-sm font-semibold">{row.subject}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.message}</p>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>{formatRelative(row.created_at)}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onView} className="flex-1">
          <Eye className="ml-1 h-4 w-4" />
          تفاصيل
        </Button>
        {row.phone && (
          <Button size="sm" variant="outline" asChild>
            <a
              href={`https://wa.me/${row.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              <MessageCircle className="h-4 w-4 text-success" />
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <a href={`mailto:${row.email}?subject=Re: ${encodeURIComponent(row.subject)}`}>
            <Mail className="h-4 w-4 text-primary" />
          </a>
        </Button>
      </div>

      <div className="mt-3">
        <Select
          value={row.status}
          onValueChange={(v) => onChangeStatus(row, v as ContactStatus)}
          disabled={updating}
        >
          <SelectTrigger className="h-9 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">جديدة</SelectItem>
            <SelectItem value="contacted">تم التواصل</SelectItem>
            <SelectItem value="closed">مغلقة</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}

// ─────────── Detail dialog ───────────
function DetailDialog({
  row,
  open,
  onOpenChange,
  onChangeStatus,
  updating,
}: {
  row: ContactSubmission | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChangeStatus: (row: ContactSubmission, next: ContactStatus) => void;
  updating: boolean;
}) {
  if (!row) return null;
  const meta = STATUS_META[row.status];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-lg">{row.subject}</DialogTitle>
            <Badge variant="outline" className={cn("gap-1", meta.className)}>
              <meta.icon className="h-3 w-3" />
              {meta.label}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            {formatDate(row.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBlock label="الاسم" value={row.name} />
            <InfoBlock label="البريد" value={row.email} dir="ltr" />
            {row.phone && <InfoBlock label="الجوال" value={row.phone} dir="ltr" />}
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              الرسالة
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {row.message}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {row.phone && (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={`https://wa.me/${row.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <MessageCircle className="ml-1 h-4 w-4 text-success" />
                  واتساب
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <a href={`mailto:${row.email}?subject=Re: ${encodeURIComponent(row.subject)}`}>
                <Mail className="ml-1 h-4 w-4 text-primary" />
                رد بالبريد
              </a>
            </Button>
            {row.phone && (
              <Button size="sm" variant="outline" asChild>
                <a href={`tel:${row.phone}`}>
                  <Phone className="ml-1 h-4 w-4" />
                  اتصال
                </a>
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Select
            value={row.status}
            onValueChange={(v) => onChangeStatus(row, v as ContactStatus)}
            disabled={updating}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">جديدة</SelectItem>
              <SelectItem value="contacted">تم التواصل</SelectItem>
              <SelectItem value="closed">مغلقة</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoBlock({ label, value, dir }: { label: string; value: string; dir?: "ltr" | "rtl" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-all text-sm font-medium text-foreground" dir={dir}>
        {value}
      </p>
    </div>
  );
}
