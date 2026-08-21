import { ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CONSENT_TEXTS } from "@/server/consent-functions";

export type ConsentDialogValues = {
  email: boolean;
  whatsapp: boolean;
  productUpdates: boolean;
};

export type ConsentDialogKey = keyof ConsentDialogValues;

interface ConsentDialogProps {
  values: ConsentDialogValues;
  onChange: (key: ConsentDialogKey, value: boolean) => void;
  disabled?: boolean;
}

const ITEMS: Array<{
  key: ConsentDialogKey;
  id: string;
  title: string;
  hint: string;
  legal: string;
}> = [
  {
    key: "email",
    id: "consent-email",
    title: "نصائح وعروض البريد الإلكتروني",
    hint: "أفكار محتوى أسبوعية + عروض حصرية لأصحاب المتاجر.",
    legal: CONSENT_TEXTS.marketing_email,
  },
  {
    key: "whatsapp",
    id: "consent-whatsapp",
    title: "تذكيرات وعروض واتساب",
    hint: "تذكير اشتراك + عروض حصرية. لن نشارك رقمك مع أي جهة.",
    legal: CONSENT_TEXTS.marketing_whatsapp,
  },
  {
    key: "productUpdates",
    id: "consent-product-updates",
    title: "إشعارات تحديثات المنتج",
    hint: "ميزات جديدة وتحسينات تصلك أول بأول عبر البريد.",
    legal: CONSENT_TEXTS.product_updates,
  },
];

export function ConsentDialog({ values, onChange, disabled = false }: ConsentDialogProps) {
  return (
    <section
      aria-labelledby="consent-dialog-title"
      className="rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-extrabold text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          متوافق مع نظام حماية البيانات السعودي (PDPL)
        </span>
      </div>
      <h3 id="consent-dialog-title" className="text-base font-extrabold text-foreground">
        تفضيلات التواصل
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        اختر الذي يناسبك. اختياري بالكامل، وتقدر تغيّرها أي وقت من الإعدادات.
      </p>

      <ul className="mt-4 space-y-3">
        {ITEMS.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/30"
          >
            <Checkbox
              id={item.id}
              checked={values[item.key]}
              onCheckedChange={(checked) => onChange(item.key, checked === true)}
              disabled={disabled}
              className="mt-0.5 h-5 w-5"
              aria-describedby={`${item.id}-legal`}
            />
            <div className="min-w-0 flex-1">
              <Label
                htmlFor={item.id}
                className="block cursor-pointer text-sm font-bold leading-5 text-foreground"
              >
                {item.title}
              </Label>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.hint}</p>
              <p
                id={`${item.id}-legal`}
                className="mt-1.5 text-[11px] leading-5 text-muted-foreground/80"
              >
                {item.legal}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
