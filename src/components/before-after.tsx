import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * مقارنة بصرية "قبل/بعد" — ChatGPT vs رِفد.
 * يضرب الألم مباشرة ويظهر القيمة في 3 ثواني.
 */
const SAMPLES = [
  {
    prompt: "اكتب منشور إنستقرام لمتجر عطور",
    chatgpt:
      "اكتشف عالم العطور الفاخرة معنا! تشكيلة واسعة من العطور الأصلية بأسعار منافسة. تسوق الآن واستمتع بالتوصيل المجاني.",
    rifd:
      "🌹 عطورنا تخلّيك ما تنتسي 💚\nبصمتك المختلفة تستاهل عطر يليق فيها — ثبات 12 ساعة + عيّنة هدية مع كل طلب.\nاطلبي قبل لا تنفد 👇",
  },
  {
    prompt: "اكتب وصف منتج لعباية كاجوال",
    chatgpt:
      "عباية أنيقة ومريحة، مصنوعة من قماش عالي الجودة. مناسبة لجميع المناسبات. متوفرة بألوان متعددة.",
    rifd:
      "عبايتك اليومية اللي تجمع الراحة والستايل ✨\nقماش يتنفس + قصة فضفاضة تليق بكل المناسبات — من البيت للدوام للقهوة مع الصديقات.\n💚 متوفرة 5 ألوان • مقاسات S-XXL",
  },
];

const painPoints = ["عامية سعودية", "زاوية بيع واضحة", "دعوة شراء جاهزة"];

export function BeforeAfter() {
  return (
    <section className="border-t border-border bg-secondary/30 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
            🔥 الفرق اللي يخلّيك تبيع
          </span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            ChatGPT يكتب لك <span className="text-destructive">إعلان جامد</span>،
            <br />
            رِفد يكتب لك <span className="text-gradient-primary">منشور يبيع</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            نفس الطلب — نتيجتان مختلفتان كلياً. شوف بنفسك ↓
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {painPoints.map((point) => (
              <span key={point} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-foreground/80">
                {point}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {SAMPLES.map((s, idx) => (
            <div key={idx} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="mb-4 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
                طلب: "{s.prompt}"
              </div>

              <div className="grid gap-3">
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold text-destructive">
                    <X className="h-4 w-4" /> ChatGPT (فصحى مكسّرة)
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.chatgpt}</p>
                </div>

                <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 shadow-elegant">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold text-primary">
                    <Check className="h-4 w-4" /> رِفد (عامية تبيع)
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {s.rifd}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-xs font-bold text-success">
                النتيجة هنا ليست صياغة أفضل فقط — بل مخرج أقرب للنشر والبيع مباشرة.
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link to="/onboarding">
              جرّب على متجرك الآن
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/vs-chatgpt">شاهد مقارنة أوسع</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
