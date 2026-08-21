/**
 * Saudi Use Cases — حالات استخدام واقعية لأصحاب المتاجر السعودية.
 *
 * ملاحظة شفافية: هذه أمثلة قياسية لمخرجات رِفد الفعلية (نص يبيع، صورة إعلان،
 * فيديو ترويجي) — وليست شهادات أفراد. اختيار هذا الأسلوب لأن الادعاء بأسماء
 * عملاء بدون إذن موثّق يضرّ المصداقية ويخالف لغة المنتج.
 *
 * Light/Dark + RTL + Mobile/Tablet/Desktop عبر design tokens فقط.
 */
import { ImageIcon, Sparkles, Type, Video } from "lucide-react";

type UseCase = {
  icon: typeof Type;
  category: string;
  scenario: string;
  output: string;
  benefit: string;
};

const USE_CASES: UseCase[] = [
  {
    icon: Type,
    category: "متجر عطور",
    scenario: "يحتاج وصف منتج بنبرة قريبة من العميلة السعودية بدلاً من ترجمة آلية.",
    output: "اكتب نصاً يبيع — وصف عطر بـ60 ثانية مع CTA واضح.",
    benefit: "وقت إنتاج أقل بـ80% مقابل الكتابة اليدوية",
  },
  {
    icon: ImageIcon,
    category: "متجر إلكترونيات",
    scenario: "يحتاج صورة إعلان سناب احترافية بدون حجز مصمّم خارجي.",
    output: "صمّم صورة إعلان — قياس 9:16 بمنتجك وعرضك.",
    benefit: "تكلفة صفر مقابل 150ر للمصمّم الخارجي",
  },
  {
    icon: Video,
    category: "متجر أزياء",
    scenario: "يحتاج فيديو قصير أسبوعياً للحملات الموسمية.",
    output: "ولّد فيديو ترويجي — 5–8 ثواني بصوت ومنتج وهوية.",
    benefit: "حملة كاملة جاهزة في أقل من 10 دقائق",
  },
];

export function SaudiTestimonials() {
  return (
    <section
      dir="rtl"
      className="border-t border-border bg-background py-14"
      aria-label="حالات استخدام رِفد للمتاجر السعودية"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            مصمَّم للسوق السعودي
          </div>
          <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl">
            ثلاث حالات استخدام شائعة — مخرج واحد جاهز للنشر
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            رِفد لا يقدّم قوالب أجنبية مترجمة. كل مخرج مضبوط على نبرة عميلك السعودي وقنواتك المحلية.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {USE_CASES.map((u) => (
            <article
              key={u.category}
              className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/40 hover:shadow-elegant"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <u.icon className="size-5" aria-hidden="true" />
              </div>
              <div className="mt-4 text-xs font-extrabold text-primary">{u.category}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {u.scenario}
              </p>
              <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-sm font-bold text-foreground">
                {u.output}
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-extrabold text-success">
                {u.benefit}
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          سعر ضمان: ابدأ بـ1ر — استرداد كامل خلال 7 أيام بدون أسئلة.
        </p>
      </div>
    </section>
  );
}
