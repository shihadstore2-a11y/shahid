import { UserPlus, LayoutTemplate, Send } from "lucide-react";

const STEPS = [
  {
    n: "1",
    icon: UserPlus,
    title: "أدخل بيانات متجرك",
    desc: "اسم المتجر، نوع المنتج، نبرة الكلام — مرة وحدة فقط (30 ثانية).",
    time: "30 ثانية",
  },
  {
    n: "2",
    icon: LayoutTemplate,
    title: "اختر القالب",
    desc: "مكتبة قوالب سعودية: منشورات، كابشن، إعلان، وصف منتج، رسالة واتساب…",
    time: "10 ثوانٍ",
  },
  {
    n: "3",
    icon: Send,
    title: "ولّد، انسخ، انشر",
    desc: "نتيجة بالعامية السعودية جاهزة للنسخ المباشر إلى منصاتك.",
    time: "10 ثوانٍ",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
            ⚡ 3 خطوات فقط
          </span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            كيف يعمل <span className="text-gradient-primary">رِفد</span>؟
          </h2>
          <p className="mt-3 text-muted-foreground">
            من الصفر إلى منشور احترافي بأقل من دقيقة
          </p>
        </div>

        <div className="relative mt-12 grid gap-6 md:grid-cols-3">
          {/* خط رابط بين الخطوات (ديسكتوب فقط) */}
          <div
            aria-hidden
            className="absolute right-[16.6%] left-[16.6%] top-10 hidden h-0.5 bg-gradient-to-l from-primary/0 via-primary/30 to-primary/0 md:block"
          />

          {STEPS.map((step) => (
            <div
              key={step.n}
              className="relative rounded-2xl border border-border bg-card p-6 text-center shadow-soft transition-all hover:border-primary/40 hover:shadow-elegant"
            >
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-primary/10" />
                <step.icon className="relative h-9 w-9 text-primary" />
                <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full gradient-primary text-xs font-extrabold text-primary-foreground shadow-elegant">
                  {step.n}
                </span>
              </div>

              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
                ⏱ {step.time}
              </span>
            </div>
          ))}
        </div>

        {/* خلاصة */}
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-gold/30 bg-gradient-to-l from-gold/10 to-primary/5 p-4 text-center">
          <p className="text-sm font-medium">
            <strong className="text-gold-foreground/90">الإجمالي:</strong> أقل من{" "}
            <strong className="text-primary">دقيقة واحدة</strong> لمنشور جاهز للنشر 🚀
          </p>
        </div>
      </div>
    </section>
  );
}
