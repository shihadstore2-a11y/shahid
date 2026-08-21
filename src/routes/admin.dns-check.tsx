/**
 * صفحة فحص DNS للأدمن — أداة تشخيص لنطاقات البريد.
 * تستدعي src/server/dns-check.ts عبر TanStack Server Function.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { AdminGuard, adminBeforeLoad } from "@/components/admin-guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Shield,
  Mail,
  Globe,
  KeyRound,
  ScrollText,
} from "lucide-react";
import { checkEmailDns, type DnsCheckResult, type RecordCheck } from "@/server/dns-check";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/dns-check")({
  beforeLoad: adminBeforeLoad,
  head: () => ({ meta: [{ title: "فحص DNS للبريد — لوحة الأدمن" }] }),
  component: () => (
    <AdminGuard loadingLabel="جاري تحميل أداة فحص DNS…">
      <DnsCheckPage />
    </AdminGuard>
  ),
});

const PRESET_DOMAINS = [
  { label: "mail.rifd.site", value: "mail.rifd.site" },
  { label: "rifd.site", value: "rifd.site" },
  { label: "notify.rifd.site", value: "notify.rifd.site" },
  { label: "send.rifd.site", value: "send.rifd.site" },
];

function DnsCheckPage() {
  const [domain, setDomain] = useState("mail.rifd.site");
  const [result, setResult] = useState<DnsCheckResult | null>(null);

  const mutation = useMutation({
    mutationFn: async (d: string) => {
      const res = await checkEmailDns({ data: { domain: d } });
      return res;
    },
    onSuccess: (data) => {
      setResult(data);
      const msg =
        data.overall === "ready"
          ? "✅ النطاق جاهز للإرسال"
          : data.overall === "partial"
            ? "⚠️ إعداد جزئي — راجع التفاصيل"
            : "❌ النطاق غير مُعدّ";
      toast.success(msg);
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "فشل الفحص");
    },
  });

  const handleCheck = (d?: string) => {
    const target = (d ?? domain).trim().toLowerCase();
    if (!target) {
      toast.error("أدخل اسم نطاق");
      return;
    }
    setDomain(target);
    mutation.mutate(target);
  };

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                فحص DNS لنطاقات البريد
              </h1>
              <p className="text-sm text-muted-foreground">
                تشخيص شامل لسجلات NS · MX · SPF · DKIM · DMARC عبر Cloudflare DoH
              </p>
            </div>
          </div>
        </header>

        {/* Input Card */}
        <Card className="p-5 md:p-6">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="domain-input"
                className="mb-2 block text-sm font-semibold text-foreground"
              >
                اسم النطاق
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="domain-input"
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="مثال: mail.rifd.site"
                  dir="ltr"
                  className="text-left font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCheck();
                  }}
                />
                <Button
                  onClick={() => handleCheck()}
                  disabled={mutation.isPending}
                  className="sm:w-auto"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الفحص…
                    </>
                  ) : (
                    <>
                      <Search className="ml-2 h-4 w-4" />
                      فحص
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Preset chips */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">اختصارات:</span>
              {PRESET_DOMAINS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handleCheck(p.value)}
                  disabled={mutation.isPending}
                  className="rounded-full border border-border bg-background px-3 py-1 font-mono text-xs text-foreground transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                  dir="ltr"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Loading skeleton */}
        {mutation.isPending && !result && (
          <Card className="p-8 text-center">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              جاري الاستعلام من Cloudflare DNS…
            </p>
          </Card>
        )}

        {/* Results */}
        {result && (
          <>
            <OverallStatus result={result} />
            <div className="space-y-3">
              {result.records.map((rec, i) => (
                <RecordCard key={`${rec.type}-${i}`} record={rec} />
              ))}
            </div>
            <Footer checkedAt={result.checked_at} />
          </>
        )}

        {/* Empty state */}
        {!result && !mutation.isPending && (
          <Card className="p-8 text-center">
            <Globe className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              أدخل اسم نطاق واضغط "فحص" لبدء التشخيص
            </p>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}

// ===== Overall Status Card =====
function OverallStatus({ result }: { result: DnsCheckResult }) {
  const config = {
    ready: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: CheckCircle2,
      title: "النطاق جاهز للإرسال",
      desc: "كل سجلات DNS الحرجة موجودة وصحيحة. يمكنك الإرسال بثقة.",
    },
    partial: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-700 dark:text-amber-400",
      icon: AlertTriangle,
      title: "إعداد جزئي",
      desc: "بعض السجلات موجودة لكن ينقص ضروريات. راجع التفاصيل أدناه.",
    },
    not_configured: {
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      text: "text-destructive",
      icon: XCircle,
      title: "النطاق غير مُعدّ",
      desc: "لا توجد سجلات بريد فعّالة. النطاق غير قادر على الإرسال أو الاستقبال.",
    },
  }[result.overall];

  const Icon = config.icon;

  return (
    <Card className={cn("border-2 p-5 md:p-6", config.bg, config.border)}>
      <div className="flex items-start gap-4">
        <Icon className={cn("h-10 w-10 shrink-0", config.text)} />
        <div className="flex-1 space-y-3">
          <div>
            <h2 className={cn("text-xl font-bold", config.text)}>{config.title}</h2>
            <p className="mt-1 text-sm text-foreground/80">{config.desc}</p>
            <p
              className="mt-2 font-mono text-xs text-muted-foreground"
              dir="ltr"
            >
              {result.domain}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              ✅ نجح: {result.summary.pass}
            </Badge>
            {result.summary.warn > 0 && (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                ⚠️ تحذير: {result.summary.warn}
              </Badge>
            )}
            {result.summary.missing > 0 && (
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                ❌ مفقود: {result.summary.missing}
              </Badge>
            )}
            {result.summary.fail > 0 && (
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                🔴 فشل: {result.summary.fail}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ===== Record Card =====
const RECORD_ICONS: Record<string, typeof Globe> = {
  NS: Globe,
  MX: Mail,
  SPF: Shield,
  DKIM: KeyRound,
  DMARC: ScrollText,
};

function RecordCard({ record }: { record: RecordCheck }) {
  const statusConfig = {
    pass: { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", label: "نجح" },
    warn: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", label: "تحذير" },
    fail: { icon: XCircle, color: "text-destructive", label: "فشل" },
    missing: { icon: HelpCircle, color: "text-muted-foreground", label: "مفقود" },
  }[record.status];

  const StatusIcon = statusConfig.icon;
  const RecordIcon = RECORD_ICONS[record.type] ?? Globe;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-4 p-4 md:p-5">
        <div className="rounded-lg bg-muted p-2">
          <RecordIcon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {record.type}
            </span>
            <span className="font-mono text-xs text-muted-foreground" dir="ltr">
              {record.name}
            </span>
            <div className={cn("ml-auto flex items-center gap-1.5", statusConfig.color)}>
              <StatusIcon className="h-4 w-4" />
              <span className="text-xs font-bold">{statusConfig.label}</span>
            </div>
          </div>

          <p className="text-sm text-foreground">{record.message}</p>

          {record.found.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">
                القيم الفعلية:
              </span>
              <div className="space-y-1">
                {record.found.map((val, i) => (
                  <code
                    key={i}
                    className="block break-all rounded bg-muted px-2 py-1 text-left text-xs"
                    dir="ltr"
                  >
                    {val}
                  </code>
                ))}
              </div>
            </div>
          )}

          {(record.status === "missing" || record.status === "fail") && (
            <div className="rounded-md border border-border bg-muted/50 p-2">
              <span className="text-xs font-semibold text-muted-foreground">
                المتوقع:{" "}
              </span>
              <code className="text-xs" dir="ltr">
                {record.expected}
              </code>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Footer({ checkedAt }: { checkedAt: string }) {
  const date = new Date(checkedAt);
  return (
    <p className="text-center text-xs text-muted-foreground">
      آخر فحص: {date.toLocaleString("ar-SA")} · مزود الاستعلام: Cloudflare DNS-over-HTTPS
    </p>
  );
}
