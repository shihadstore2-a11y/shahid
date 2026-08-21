import { CheckCircle2, MessageCircle, CreditCard, Sparkles } from "lucide-react";

const STEPS = [
  {
    icon: CheckCircle2,
    title: "تأكيد فوري للطلب",
    desc: "يصلك تأكيد لحظي بعد إرسال النموذج",
    duration: "فوراً",
  },
  {
    icon: MessageCircle,
    title: "نتواصل معك واتساب",
    desc: "رد سريع من المؤسس خلال ساعات العمل",
    duration: "خلال ساعات",
  },
  {
    icon: CreditCard,
    title: "تحوّل المبلغ",
    desc: "تحويل بنكي سعودي + رفع الإيصال",
    duration: "5 دقائق",
  },
  {
    icon: Sparkles,
    title: "تفعيل باقتك المختارة",
    desc: "تفعيل خلال 24 ساعة + تفاصيل فوترة واضحة",
    duration: "≤ 24 ساعة",
  },
] as const;

export function ActivationSteps() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-bold text-success">
          تأكيد فوري للطلب
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
          تفعيل ≤ 24 ساعة
        </span>
      </div>
      <h2 className="mt-2 text-lg font-bold">كيف يتم التفعيل؟</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        تأكيد طلبك فوري، ويتم تفعيل الحساب خلال 24 ساعة كحدّ أقصى من رفع الإيصال
      </p>

      <ol className="mt-5 space-y-3">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="relative flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3"
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-sm font-extrabold text-primary-foreground shadow-elegant">
              {i + 1}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-9 right-1/2 h-3 w-px translate-x-1/2 bg-border"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <s.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">{s.title}</span>
                </div>
                <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                  {s.duration}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
