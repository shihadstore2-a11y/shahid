import { Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, Clapperboard, Images, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const proofItems = [
  {
    icon: MessageSquareText,
    title: "قبل / بعد واضح",
    description: "ترى الفرق بين طلب خام ومخرج بيعي منظم بدل الاكتفاء بوعود عامة.",
  },
  {
    icon: Images,
    title: "أمثلة قطاعية متخصصة",
    description: "عطور، أزياء، هدايا، إلكترونيات، أطفال، ومنزل بأمثلة مصممة لأسئلة كل قطاع لا نسخة عامة مكررة.",
  },
  {
    icon: Clapperboard,
    title: "حزم حملة كاملة",
    description: "منشور + هوكات + صورة + Reel concept + CTA ضمن منطق حملة واحد.",
  },
  {
    icon: ShieldCheck,
    title: "اعتراضات مجاب عنها",
    description: "هل الناتج جاهز؟ هل يناسب المتجر السعودي؟ هل يوفر وقتاً؟ كلها تُجاب عملياً.",
  },
];

const quickAnswers = ["هل النتيجة جاهزة؟", "هل تناسب نوع متجري؟", "هل تختصر وقتاً فعلاً؟"];

export function ProofCenterPreview() {
  return (
    <section className="border-t border-border bg-secondary/30 py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
              <BadgeCheck className="h-3.5 w-3.5" />
              Proof Center
            </div>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              مركز إثبات أوسع — يجاوب السؤال الحقيقي: <span className="text-gradient-primary">هل يناسب متجري فعلاً؟</span>
            </h2>
            <p className="mt-3 text-muted-foreground">
              أمثلة قطاعية، قبل/بعد، واعتراضات وردود تشغيلية توضح كيف يتحول الطلب البسيط إلى قرار شراء أوضح وثقة أعلى.
            </p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              وستعرف أيضاً متى يكفيك الاشتراك داخل المنتج، ومتى يكون القرار الصحيح هو الانتقال إلى <span className="font-bold text-foreground">رِفد للأعمال</span> كمسار مؤسسي منفصل.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {quickAnswers.map((answer) => (
                <span
                  key={answer}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-foreground/80"
                >
                  <Sparkles className="h-3 w-3 text-primary" />
                  {answer}
                </span>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild className="w-full gap-2 sm:w-auto">
              <Link to="/onboarding">
                ابدأ التجربة
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full gap-2 self-start sm:w-auto sm:self-auto">
              <Link to="/proof-center">ادخل مركز الإثبات</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {proofItems.map((item) => (
            <article key={item.title} className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-extrabold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}