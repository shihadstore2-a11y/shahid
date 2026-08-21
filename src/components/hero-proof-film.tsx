import { Link } from "@tanstack/react-router";
import { ArrowLeft, Clapperboard, Images, MessageSquareText, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroProofVideoPlayer } from "@/components/hero-proof-video-player";

const proofSignals = ["وصف واحد", "4 مخرجات مترابطة", "جاهزة لبداية حملة"];

const steps = [
  {
    title: "1) وصف سريع",
    body: "اسم المتجر + نوع المنتج + الجمهور = نقطة بداية واضحة بدون تعقيد.",
    icon: Wand2,
  },
  {
    title: "2) نص سعودي مقنع",
    body: "منشور رئيسي، هوكات، ودعوة شراء واضحة تبدو كأنها مكتوبة لمتجرك تحديداً.",
    icon: MessageSquareText,
  },
  {
    title: "3) مخرج بصري جاهز للحملة",
    body: "فكرة صورة رئيسية، بوستر، واتجاه بصري يترجم الهوية إلى مادة قابلة للتنفيذ.",
    icon: Images,
  },
  {
    title: "4) فكرة ريلز",
    body: "افتتاحية بصرية، تسلسل لقطات، وزاوية بيع مختصرة تختصر عليك بداية المحتوى المرئي.",
    icon: Clapperboard,
  },
];

export function HeroProofFilm() {
  return (
    <section className="border-t border-border bg-background py-16 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
            <Clapperboard className="h-3.5 w-3.5" />
            فيديو الإثبات — كيف يتحول الطلب إلى حملة
          </div>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
            لا يبهرك رِفد بالواجهة فقط — <span className="text-gradient-primary">يُريك كيف يخرج النص والصورة وفكرة الريلز من نفس الطلب.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            هذه ليست معاينة شكلية. هذا هو منطق الإقناع في رِفد: وصف بسيط يدخل، ثم ترى أمامك نصاً وصورة وفكرة فيديو ضمن حزمة واحدة قابلة للتشغيل.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {proofSignals.map((signal) => (
              <span
                key={signal}
                className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground/85"
              >
                {signal}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {steps.map((step) => (
              <article key={step.title} className="rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-extrabold sm:text-base">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="w-full gradient-primary text-primary-foreground shadow-elegant sm:w-auto">
              <Link to="/onboarding">
                ابدأ التجربة المجانية
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/proof-center">شاهد إثباتات أكثر عمقاً</Link>
            </Button>
          </div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            إذا كان هدفك حسم القرار بسرعة، فهذا القسم يجيب على سؤال <span className="font-bold text-foreground">"كيف يختلف رِفد عملياً؟"</span> قبل أن تنتقل إلى مركز الإثبات أو صفحة الأسعار.
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-[2rem] bg-primary/10 blur-3xl" aria-hidden />
          <HeroProofVideoPlayer />

          <div className="mt-4 rounded-[1.5rem] border border-gold/25 bg-gold/10 p-4 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-bold text-gold-foreground">المحصلة النهائية</div>
                <div className="mt-1 text-sm font-extrabold">وصف واحد يجهّز لك منشوراً + صورة + فكرة ريلز + دعوة شراء</div>
              </div>
              <div className="inline-flex self-start rounded-full bg-background px-3 py-1 text-xs font-bold text-foreground sm:self-auto">جاهزية V9: 98%</div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              تم تحويل الإثبات من شرح وصفي إلى أصل حيّ قابل للمشاهدة داخل الصفحة الرئيسية.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}