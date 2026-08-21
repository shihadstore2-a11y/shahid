import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, Blocks, BriefcaseBusiness, Building2, CheckCircle2, Compass, Workflow } from "lucide-react";
import { z } from "zod";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const tracks = [
  {
    icon: BriefcaseBusiness,
    title: "AI Content OS",
    bullets: ["ذاكرة متقدمة متعددة السياقات", "تقويم محتوى وحملات", "مخرجات قابلة للمراجعة والاعتماد"],
  },
  {
    icon: Building2,
    title: "Commerce Build",
    bullets: ["بناء أو تطوير المتجر", "تحسين UX وصفحات المنتجات", "صفحات هبوط ورفع التحويل"],
  },
  {
    icon: BarChart3,
    title: "Growth & Marketing System",
    bullets: ["إدارة حملات موسمية", "تشغيل نمو وتقارير", "تنسيق قنوات المحتوى والإعلانات"],
  },
  {
    icon: Workflow,
    title: "Business Systems",
    bullets: ["CRM وأتمتة", "تطبيقات داخلية", "أنظمة مخصصة مرتبطة بالذكاء الاصطناعي"],
  },
];

const signals = [
  "أكثر من قناة محتوى أو إعلان تُدار يدوياً",
  "تكرار في كتابة الحملات من البداية كل مرة",
  "حاجة إلى مواءمة بين المحتوى، المتجر، والعمليات",
  "رغبة في شريك تنفيذي لا مجرد أداة SaaS",
];

const deliveryFlow = [
  {
    title: "تشخيص",
    description: "نفهم القنوات، الفريق، نقاط التعطل، وما الذي يجب أن يبنى أولاً لتحقيق أثر ربحي واضح.",
  },
  {
    title: "تصميم المسار",
    description: "نحوّل الاحتياج إلى مسار واضح: محتوى، تحويل، أنظمة، أو طبقة نمو تشغيلية متكاملة.",
  },
  {
    title: "تنفيذ منضبط",
    description: "ننفذ على مراحل قابلة للقياس مع مخرجات واضحة ومسؤوليات مفهومة ومؤشرات متابعة.",
  },
];

const fitCases = [
  "علامات لديها مواسم قوية وتحتاج Campaign Packs متكررة وسريعة.",
  "وكالات تريد طبقة محتوى وتحويل أكثر انضباطاً لعملائها.",
  "متاجر كبيرة تحتاج مواءمة بين UX، العروض، والتشغيل بالذكاء الاصطناعي.",
];

const intakeSchema = z.object({
  name: z.string().trim().min(2, "اكتب الاسم أو اسم الجهة بصيغة أوضح").max(100, "الاسم طويل أكثر من اللازم"),
  businessType: z.string().trim().min(2, "حدد نوع النشاط").max(80, "نوع النشاط طويل أكثر من اللازم"),
  scope: z.string().trim().min(2, "اذكر نطاق العمل الحالي").max(120, "نطاق العمل طويل أكثر من اللازم"),
  teamSize: z.string().trim().min(1, "اذكر حجم الفريق").max(80, "وصف حجم الفريق طويل أكثر من اللازم"),
  channels: z.string().trim().min(10, "اذكر القنوات الحالية بتفصيل مختصر").max(500, "تفاصيل القنوات أطول من اللازم"),
  bottleneck: z.string().trim().min(10, "اشرح عنق الزجاجة الحالي باختصار مفيد").max(500, "وصف عنق الزجاجة أطول من اللازم"),
  goal: z.string().trim().min(10, "اذكر هدفاً واضحاً خلال 90 يوماً").max(500, "وصف الهدف أطول من اللازم"),
  supportType: z.string().trim().min(2, "حدد نوع الدعم المطلوب").max(100, "نوع الدعم طويل أكثر من اللازم"),
});

type IntakeForm = z.infer<typeof intakeSchema>;
type IntakeErrors = Partial<Record<keyof IntakeForm, string>>;

function mapZodErrors(error: z.ZodError<IntakeForm>): IntakeErrors {
  return error.issues.reduce<IntakeErrors>((acc, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in acc)) {
      acc[field as keyof IntakeForm] = issue.message;
    }
    return acc;
  }, {});
}

export const Route = createFileRoute("/business-solutions")({
  head: () => ({
    meta: [
      { title: "رِفد للأعمال — حلول التحول التجاري بالذكاء الاصطناعي" },
      {
        name: "description",
        content:
          "رِفد للأعمال يقدّم للمتاجر الكبيرة والوكالات طبقة تشغيل تشمل المحتوى، التحويل، الأنظمة، والعمليات المدعومة بالذكاء الاصطناعي.",
      },
      { property: "og:title", content: "رِفد للأعمال" },
      {
        property: "og:description",
        content: "خط أعمال مخصص للوكالات والمتاجر الكبيرة والشركات التي تريد تحولاً تجارياً عملياً بالذكاء الاصطناعي.",
      },
      { name: "twitter:title", content: "رِفد للأعمال" },
      { name: "twitter:description", content: "تشخيص احتياج، intake مؤسسي، ومسار تحول تجاري منضبط بالذكاء الاصطناعي." },
    ],
    links: [{ rel: "canonical", href: "https://rifd.site/business-solutions" }],
  }),
  component: BusinessSolutionsPage,
});

function BusinessSolutionsPage() {
  const [form, setForm] = React.useState({
    name: "",
    businessType: "",
    scope: "",
    teamSize: "",
    channels: "",
    bottleneck: "",
    goal: "",
    supportType: "",
  });
  const [errors, setErrors] = React.useState<IntakeErrors>({});

  const normalizedForm = React.useMemo<IntakeForm>(
    () => ({
      name: form.name.trim(),
      businessType: form.businessType.trim(),
      scope: form.scope.trim(),
      teamSize: form.teamSize.trim(),
      channels: form.channels.trim(),
      bottleneck: form.bottleneck.trim(),
      goal: form.goal.trim(),
      supportType: form.supportType.trim(),
    }),
    [form],
  );

  const validation = React.useMemo(() => intakeSchema.safeParse(normalizedForm), [normalizedForm]);
  const isValid = validation.success;

  const intakeMessage = React.useMemo(
    () =>
      [
        "السلام عليكم، أريد تقييم مسار رِفد للأعمال.",
        `الاسم / الجهة: ${normalizedForm.name || "..."}`,
        `نوع النشاط: ${normalizedForm.businessType || "..."}`,
        `نطاق العمل الحالي: ${normalizedForm.scope || "..."}`,
        `حجم الفريق: ${normalizedForm.teamSize || "..."}`,
        `القنوات الحالية: ${normalizedForm.channels || "..."}`,
        `أكبر عنق زجاجة: ${normalizedForm.bottleneck || "..."}`,
        `الهدف خلال 90 يوماً: ${normalizedForm.goal || "..."}`,
        `نوع الدعم المطلوب: ${normalizedForm.supportType || "..."}`,
      ].join("\n"),
    [normalizedForm],
  );

  const whatsappHref = `https://wa.me/966582286215?text=${encodeURIComponent(intakeMessage)}`;
  const emailHref = `mailto:hello@rifd.site?subject=${encodeURIComponent("طلب تقييم — رِفد للأعمال")}&body=${encodeURIComponent(intakeMessage)}`;
  const formErrorSummary = !isValid && Object.keys(errors).length > 0 ? "أكمل الحقول المطلوبة أولاً بصياغة أوضح قبل الإرسال." : null;

  function updateField<K extends keyof IntakeForm>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validateBeforeSend(event: React.MouseEvent<HTMLAnchorElement>) {
    const result = intakeSchema.safeParse(normalizedForm);
    if (!result.success) {
      event.preventDefault();
      setErrors(mapZodErrors(result.error));
      return;
    }
    setErrors({});
  }

  return (
    <MarketingLayout>
      <section className="gradient-hero border-b border-border py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-foreground">
            <Blocks className="h-3.5 w-3.5 text-gold" />
            رِفد للأعمال (حلول التحول التجاري بالذكاء الاصطناعي)
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-tight sm:text-5xl">
            عندما يصبح المحتوى وحده غير كافٍ، <span className="text-gradient-gold">يتوسع رِفد ليصبح نظام تشغيل للنمو.</span>
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
            هذا المسار مخصص للوكالات، والعلامات متعددة المتاجر، والشركات التي تريد بنية تشغيل ومحتوى وأنظمة وواجهات متصلة بالذكاء الاصطناعي ضمن خدمة أكثر عمقاً وإشرافاً.
          </p>
          <div className="mt-5 max-w-3xl rounded-2xl border border-gold/25 bg-card/80 p-4 text-sm leading-7 text-muted-foreground shadow-soft">
            <span className="font-extrabold text-foreground">مهم:</span> هذه الصفحة تشرح <span className="font-extrabold text-gold">مسار رِفد للأعمال المؤسسي</span>،
            وليست باقة الاشتراك الشهرية <span className="font-extrabold text-foreground">"أعمال"</span> الموجودة في صفحة الأسعار. إذا كان احتياجك اشتراكاً أعلى داخل المنتج فقط، فابدأ من الأسعار أولاً.
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {signals.map((signal) => (
              <div key={signal} className="rounded-xl border border-border bg-card/70 px-4 py-4 text-sm text-muted-foreground shadow-soft backdrop-blur-sm">
                {signal}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="gradient-gold text-gold-foreground shadow-gold">
              <a href="#business-intake">
                اطلب تشخيص احتياجك
                <ArrowLeft className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link to="/contact">تواصل معنا مباشرة</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-background py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-5 md:grid-cols-2">
            {tracks.map((track) => (
              <article key={track.title} className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
                  <track.icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-xl font-extrabold">{track.title}</h2>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {track.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-gold/25 bg-card p-6 shadow-soft">
              <h2 className="text-xl font-extrabold">كيف نعمل معك؟</h2>
              <div className="mt-5 space-y-4">
                {deliveryFlow.map((step, index) => (
                  <div key={step.title} className="flex gap-3 rounded-xl border border-border bg-secondary/30 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-sm font-extrabold text-gold">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-bold">{step.title}</h3>
                      <p className="mt-1 text-sm leading-7 text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <Compass className="h-3.5 w-3.5" />
                متى يكون هذا المسار مناسباً؟
              </div>
              <div className="mt-5 grid gap-3">
                {fitCases.map((item) => (
                  <div key={item} className="rounded-xl border border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl border border-primary/15 bg-primary/5 p-4">
                <h3 className="font-bold">النتيجة المتوقعة</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  ليس مجرد محتوى أكثر، بل وضوح أعلى في الرسائل، سرعة أكبر في الإطلاقات، وتقليل للتشظي بين المتجر، الحملات، والعمليات التشغيلية.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-2xl gradient-primary p-8 text-primary-foreground shadow-elegant">
            <h2 className="text-2xl font-extrabold sm:text-3xl">هل تريد معرفة إن كان رِفد للأعمال مناسباً لك؟</h2>
            <p className="mt-3 max-w-3xl text-primary-foreground/90">
              أرسل لنا نبذة قصيرة عن متجرك، قنواتك الحالية، وما الذي يبطئ النمو عندك — وسنقترح عليك المسار الأنسب بوضوح وبدون مبالغة.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary">
                <a href="#business-intake">
                  ابدأ التقييم الآن
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/pricing">أبحث عن باقة داخل المنتج أولاً</Link>
              </Button>
            </div>
          </div>

          <section id="business-intake" className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-elegant sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
                  <BriefcaseBusiness className="h-3.5 w-3.5" />
                  intake مؤسسي منظم
                </div>
                <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl">هل يناسبك رِفد للأعمال أم تكفيك باقة داخل المنتج؟</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                  املأ هذه النبذة المختصرة ثم أرسلها مباشرة. النموذج مصمم ليغطي حجم الفريق، حالة المتجر، القنوات، والأولوية التنفيذية حتى لا يبدأ التقييم من محادثة عامة.
                </p>

                <div className="mt-5 space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">1) حجم النشاط: متجر واحد / عدة متاجر / وكالة / فريق داخلي</div>
                  <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">2) القنوات الحالية: متجر — إعلانات — واتساب — محتوى — CRM</div>
                  <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">3) عنق الزجاجة: المحتوى / التحويل / الأنظمة / التشغيل</div>
                  <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">4) المخرج المطلوب: تشخيص / تنفيذ / بناء نظام / تشغيل حملات</div>
                </div>
              </div>

              <div className="rounded-2xl border border-gold/25 bg-secondary/20 p-5">
                <h3 className="text-lg font-extrabold">نموذج التأهيل المؤسسي</h3>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label htmlFor="business-name">الاسم أو اسم الجهة</Label>
                    <Input id="business-name" aria-invalid={Boolean(errors.name)} className="mt-2 bg-background" value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="مثلاً: متجر كذا / وكالة كذا" />
                    {errors.name ? <p className="mt-2 text-xs font-medium text-destructive">{errors.name}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="business-type">نوع النشاط</Label>
                    <Input id="business-type" aria-invalid={Boolean(errors.businessType)} className="mt-2 bg-background" value={form.businessType} onChange={(e) => updateField("businessType", e.target.value)} placeholder="متجر واحد / عدة متاجر / وكالة / فريق داخلي" />
                    {errors.businessType ? <p className="mt-2 text-xs font-medium text-destructive">{errors.businessType}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="business-scope">نطاق العمل الحالي</Label>
                    <Input id="business-scope" aria-invalid={Boolean(errors.scope)} className="mt-2 bg-background" value={form.scope} onChange={(e) => updateField("scope", e.target.value)} placeholder="عدد المتاجر أو الملفات أو العلامات" />
                    {errors.scope ? <p className="mt-2 text-xs font-medium text-destructive">{errors.scope}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="team-size">حجم الفريق</Label>
                    <Input id="team-size" aria-invalid={Boolean(errors.teamSize)} className="mt-2 bg-background" value={form.teamSize} onChange={(e) => updateField("teamSize", e.target.value)} placeholder="مثلاً: 4 أشخاص / 12 شخصاً" />
                    {errors.teamSize ? <p className="mt-2 text-xs font-medium text-destructive">{errors.teamSize}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="support-type">نوع الدعم المطلوب</Label>
                    <Input id="support-type" aria-invalid={Boolean(errors.supportType)} className="mt-2 bg-background" value={form.supportType} onChange={(e) => updateField("supportType", e.target.value)} placeholder="تشخيص / تنفيذ / بناء نظام / تشغيل حملات" />
                    {errors.supportType ? <p className="mt-2 text-xs font-medium text-destructive">{errors.supportType}</p> : null}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="channels">القنوات الحالية</Label>
                    <Textarea id="channels" aria-invalid={Boolean(errors.channels)} className="mt-2 min-h-[88px] bg-background" value={form.channels} onChange={(e) => updateField("channels", e.target.value)} placeholder="المتجر، الإعلانات، واتساب، المحتوى، CRM، وأي أدوات تشغيل حالية" />
                    {errors.channels ? <p className="mt-2 text-xs font-medium text-destructive">{errors.channels}</p> : null}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="bottleneck">أكبر عنق زجاجة حالياً</Label>
                    <Textarea id="bottleneck" aria-invalid={Boolean(errors.bottleneck)} className="mt-2 min-h-[88px] bg-background" value={form.bottleneck} onChange={(e) => updateField("bottleneck", e.target.value)} placeholder="هل المشكلة في المحتوى، التحويل، الأنظمة، التشغيل، أو الربط بين القنوات؟" />
                    {errors.bottleneck ? <p className="mt-2 text-xs font-medium text-destructive">{errors.bottleneck}</p> : null}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="goal">الهدف خلال 90 يوماً</Label>
                    <Textarea id="goal" aria-invalid={Boolean(errors.goal)} className="mt-2 min-h-[88px] bg-background" value={form.goal} onChange={(e) => updateField("goal", e.target.value)} placeholder="مثلاً: رفع التحويل، تسريع الإطلاقات، بناء نظام محتوى وتشغيل، أو توحيد رحلة العميل" />
                    {errors.goal ? <p className="mt-2 text-xs font-medium text-destructive">{errors.goal}</p> : null}
                  </div>
                </div>
                {formErrorSummary ? <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">{formErrorSummary}</div> : null}
                <div className="mt-5 rounded-xl border border-border bg-background p-4">
                  <div className="text-sm font-extrabold">الملخص الجاهز للإرسال</div>
                  <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-8 text-foreground">{intakeMessage}</pre>
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="gradient-gold text-gold-foreground shadow-gold sm:w-auto">
                    <a href={whatsappHref} target="_blank" rel="noreferrer noopener" aria-disabled={!isValid} onClick={validateBeforeSend}>
                      أرسل التقييم عبر واتساب
                      <ArrowLeft className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="sm:w-auto">
                    <a href={emailHref} aria-disabled={!isValid} onClick={validateBeforeSend}>أرسل نفس التقييم عبر البريد</a>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </MarketingLayout>
  );
}
