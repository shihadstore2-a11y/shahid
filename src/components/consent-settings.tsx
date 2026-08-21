import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  recordConsent,
  withdrawConsent,
  getUserConsentStatus,
  type ConsentStatusMap,
  type ConsentType,
} from "@/server/consent-functions";

const ROWS: Array<{
  type: ConsentType;
  title: string;
  hint: string;
}> = [
  {
    type: "marketing_email",
    title: "نصائح وعروض البريد الإلكتروني",
    hint: "أفكار محتوى أسبوعية وعروض خاصة لأصحاب المتاجر.",
  },
  {
    type: "marketing_whatsapp",
    title: "تذكيرات وعروض واتساب",
    hint: "تذكير اشتراك وعروض حصرية. لن نشارك رقمك مع أي جهة.",
  },
  {
    type: "marketing_telegram",
    title: "إشعارات تيليجرام",
    hint: "تنبيهات سريعة عبر بوت @RifdBot. اكتب /unsubscribe لإلغاء.",
  },
  {
    type: "product_updates",
    title: "تحديثات المنتج وميزات جديدة",
    hint: "ملخص مختصر يصلك على البريد عند صدور ميزات جديدة.",
  },
];

function formatLastUpdated(iso: string | null): string {
  if (!iso) return "لم يُحدَّث بعد";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "—";
  }
}

export function ConsentSettings() {
  const [status, setStatus] = useState<ConsentStatusMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<ConsentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getUserConsentStatus();
        if (!cancelled) setStatus(result);
      } catch (err) {
        console.error("[consent-settings] load failed", err);
        if (!cancelled) toast.error("تعذّر تحميل تفضيلاتك");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async (type: ConsentType, next: boolean) => {
    if (!status || savingType) return;
    const previous = status[type];
    // Optimistic update
    setStatus({
      ...status,
      [type]: { ...previous, given: next, last_updated: new Date().toISOString(), source: "settings", version: "v1" },
    });
    setSavingType(type);
    try {
      if (next) {
        await recordConsent({
          data: { consent_type: type, consent_given: true, source: "settings" },
        });
      } else {
        await withdrawConsent({ data: { consent_type: type } });
      }
      toast.success("تم حفظ تفضيلاتك");
    } catch (err) {
      console.error("[consent-settings] save failed", err);
      // Rollback
      setStatus((current) => (current ? { ...current, [type]: previous } : current));
      toast.error("حدث خطأ، حاول مرة أخرى");
    } finally {
      setSavingType(null);
    }
  };

  return (
    <section
      aria-labelledby="consent-settings-title"
      className="rounded-xl border border-border bg-card p-5 shadow-soft"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 id="consent-settings-title" className="font-bold text-foreground">
            إعدادات التواصل والتسويق
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            تحكم بأنواع الرسائل التي تصلك من رِفد. تقدر تفعّل أو تلغي أي قناة في أي وقت.
          </p>
        </div>
        <span className="hidden shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-extrabold text-primary sm:inline-flex">
          <ShieldCheck className="h-3 w-3" />
          PDPL
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {ROWS.map((r) => (
            <Skeleton key={r.type} className="h-16 w-full" />
          ))}
        </div>
      ) : status ? (
        <ul className="divide-y divide-border">
          {ROWS.map((row) => {
            const item = status[row.type];
            const switchId = `consent-switch-${row.type}`;
            return (
              <li
                key={row.type}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={switchId}
                    className="block cursor-pointer text-sm font-bold text-foreground"
                  >
                    {row.title}
                  </label>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{row.hint}</p>
                  {item.last_updated && (
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      آخر تحديث: {formatLastUpdated(item.last_updated)}
                    </p>
                  )}
                </div>
                <Switch
                  id={switchId}
                  checked={item.given}
                  onCheckedChange={(v) => void handleToggle(row.type, v)}
                  disabled={savingType !== null}
                  aria-label={row.title}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">تعذّر تحميل التفضيلات.</p>
      )}
    </section>
  );
}
