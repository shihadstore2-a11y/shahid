import { Layers3, ListChecks, TimerReset } from "lucide-react";

const firstWeekOutputs = [
  {
    title: "زاوية بيع قابلة للتكرار",
    description:
      "ليست فكرة منشور واحدة، بل زاوية تستطيع أن تبني عليها منشوراً رئيسياً، نسخة بديلة، وامتداداً بصرياً دون فقدان نفس المنطق.",
  },
  {
    title: "حزمة نشر أولية",
    description:
      "نص أساسي، هوكات بديلة، CTA أوضح، واتجاه أول للصورة أو الـ Reel حتى لا يبدأ التنفيذ من نقاط منفصلة.",
  },
  {
    title: "قائمة تشغيل أسبوعية",
    description:
      "تصير لديك نقطة بداية عملية للأسبوع: ماذا تنشر أولاً، ماذا تعيد تدويره، وأين تختصر وقت المراجعة الداخلية.",
  },
];

const operationalChecks = [
  "اختصار وقت البحث عن الزاوية البيعية قبل الكتابة.",
  "تقليل التشتت بين النص والصورة والـ Reel داخل نفس الحملة.",
  "تسريع جولة المراجعة لأن الرسالة الأساسية أوضح من البداية.",
  "رفع قابلية التكرار الأسبوعي بدل إعادة بناء الحملة من الصفر كل مرة.",
];

const readinessSignals = [
  {
    title: "ابقَ على التجربة المجانية",
    description: "إذا كان هدفك الآن فقط التحقق من أن المخرج أوضح من طريقتك الحالية على متجر واحد.",
  },
  {
    title: "انتقل إلى احترافي",
    description: "إذا أصبح لديك احتياج أسبوعي ثابت وتريد تحويل هذا المنطق إلى روتين محتوى مستمر لا مجرد تجربة متقطعة.",
  },
  {
    title: "اذهب إلى رِفد للأعمال",
    description: "إذا كان القرار عندك مرتبطاً بفريق، تعدد متاجر، أو مسار تسليم وتأهيل يتجاوز الاستخدام الفردي.",
  },
];

export function ProofCenterOperationalProof() {
  return (
    <section id="operational-proof" className="mt-8 space-y-4 scroll-mt-28">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
        <div className="flex items-center gap-2 text-primary">
          <ListChecks className="h-5 w-5" />
          <h2 className="text-2xl font-extrabold">ما الذي يجب أن تراه فعلياً في أول أسبوع؟</h2>
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">
          النسخة السابقة كانت تشرح الأثر منطقياً، لكنها لم تكن كافية لإغلاق آخر اعتراض قبل الشراء: "ماذا سأحصل عليه عملياً؟". هنا يصبح الإثبات تشغيلياً لا وصفياً.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {firstWeekOutputs.map((item) => (
            <article key={item.title} className="rounded-xl border border-border bg-secondary/30 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers3 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-extrabold">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-soft">
          <div className="flex items-center gap-2 text-primary">
            <TimerReset className="h-5 w-5" />
            <h2 className="text-xl font-extrabold">أين يظهر اختصار الوقت تحديداً؟</h2>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-foreground/85">
            {operationalChecks.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="text-xl font-extrabold">كيف تعرف أن الوقت حان للانتقال؟</h2>
          <div className="mt-4 space-y-3">
            {readinessSignals.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-background px-4 py-4">
                <h3 className="text-sm font-extrabold">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}