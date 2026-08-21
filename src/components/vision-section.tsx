import { HeartHandshake } from "lucide-react";

/**
 * قسم الروية — بدون صورة مزيفة، بأسلوب توقيع صادق.
 */
export function VisionSection() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-gradient-to-br from-primary/5 via-background to-gold/5 py-16 sm:py-20">
      <div className="pointer-events-none absolute -top-32 right-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-4 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-primary-foreground shadow-elegant">
          <HeartHandshake className="h-7 w-7" />
        </div>

        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          ليش بنينا <span className="text-gradient-primary">رِفد</span>؟
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-foreground/85">
          لأن صاحب المتجر السعودي يستاهل أداة تتكلّم لغته —
          <br className="hidden sm:block" />
          مو ترجمة من أداة أمريكية صُممت لجمهور آخر.
        </p>

        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          مهمتنا: نخلّي كل صاحب متجر سعودي ينشر محتوى احترافي في دقائق —
          بدون مصمم، بدون كاتب، بدون معاناة.
        </p>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium backdrop-blur">
          <span className="text-base">— فريق رِفد</span>
          <span className="text-base">🇸🇦</span>
        </div>
      </div>
    </section>
  );
}
