import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Mail,
  MessageCircle,
  MapPin,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  Phone,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "تواصل معنا — رِفد للأعمال" },
      {
        name: "description",
        content:
          "تواصل مع فريق رِفد للأعمال عبر النموذج الرسمي أو واتساب. نرد خلال 4 ساعات عمل (السبت–الخميس 9 ص – 12 ص بتوقيت الرياض).",
      },
      { property: "og:title", content: "تواصل معنا — رِفد للأعمال" },
      {
        property: "og:description",
        content:
          "اختر القناة الأنسب لك: نموذج رسمي، واتساب، أو بريد. نرد عليك خلال 4 ساعات عمل.",
      },
      { name: "twitter:title", content: "تواصل معنا — رِفد للأعمال" },
      {
        name: "twitter:description",
        content:
          "اختر القناة الأنسب لك: نموذج رسمي، واتساب، أو بريد. نرد عليك خلال 4 ساعات عمل.",
      },
    ],
    links: [{ rel: "canonical", href: "https://rifd.site/contact" }],
  }),
  component: ContactPage,
});

// ─── Schema (نفس الـserver schema) ───
const contactFormSchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جداً").max(80, "الاسم طويل جداً"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("بريد إلكتروني غير صالح")
    .max(254),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  subject: z
    .string()
    .trim()
    .min(3, "الموضوع قصير جداً")
    .max(120, "الموضوع طويل جداً"),
  message: z
    .string()
    .trim()
    .min(10, "اكتب 10 أحرف على الأقل")
    .max(2000, "الرسالة طويلة جداً"),
  website: z.string().max(0).optional(), // honeypot
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; id: string }
  | { kind: "error"; message: string };

function ContactPage() {
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
      website: "",
    },
  });

  const onSubmit = async (values: ContactFormValues) => {
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/public/contact-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setState({
          kind: "error",
          message:
            data.message ??
            (res.status === 429
              ? "تجاوزت الحد المسموح. حاول بعد ساعة أو راسلنا واتساب."
              : "تعذّر الإرسال. حاول مرة أخرى أو راسلنا واتساب."),
        });
        return;
      }
      setState({ kind: "success", id: data.id ?? "" });
      reset();
    } catch {
      setState({
        kind: "error",
        message: "تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم حاول مجدداً.",
      });
    }
  };

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="gradient-hero py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary sm:text-sm">
            <ShieldCheck className="h-4 w-4" />
            رد خلال 4 ساعات عمل
          </div>
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
            تواصل معنا{" "}
            <span className="text-gradient-primary">مباشرة</span>
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:mt-4 sm:text-lg">
            نموذج رسمي أو واتساب — اختر الأسرع لك ونرد عليك في أقرب وقت.
          </p>
        </div>
      </section>

      {/* Quick channels */}
      <section className="bg-background pt-10 sm:pt-12">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="https://wa.me/966582286215"
              target="_blank"
              rel="noreferrer noopener"
              className="group rounded-2xl border border-success/30 bg-success/5 p-5 transition-all hover:border-success hover:shadow-elegant sm:p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/15 text-success">
                <MessageCircle className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-base font-bold sm:text-lg">
                واتساب — الأسرع
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                رد مباشر خلال دقائق ضمن ساعات العمل
              </p>
              <div
                className="mt-3 text-sm font-bold text-success"
                dir="ltr"
              >
                +966 58 228 6215
              </div>
            </a>

            <a
              href="mailto:hello@rifd.site"
              className="group rounded-2xl border border-primary/30 bg-primary/5 p-5 transition-all hover:border-primary hover:shadow-elegant sm:p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Mail className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-base font-bold sm:text-lg">
                البريد الإلكتروني
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                للاستفسارات التفصيلية والشراكات
              </p>
              <div className="mt-3 text-sm font-bold text-primary">
                hello@rifd.site
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="bg-background py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
            <div className="mb-6 text-center sm:text-right">
              <h2 className="text-xl font-bold sm:text-2xl">
                أرسل لنا رسالة
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                املأ الحقول وسنرد عليك على بريدك خلال ساعات العمل.
              </p>
            </div>

            {/* SUCCESS state */}
            {state.kind === "success" && (
              <div className="rounded-xl border border-success/40 bg-success/5 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-foreground sm:text-lg">
                      تم استلام رسالتك بنجاح ✅
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      أرسلنا تأكيداً على بريدك. سنرد عليك خلال 4 ساعات عمل.
                      للاستعجال يمكنك مراسلتنا واتساب.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button
                        asChild
                        size="sm"
                        className="bg-success text-success-foreground hover:bg-success/90"
                      >
                        <a
                          href="https://wa.me/966582286215"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          <MessageCircle className="ml-2 h-4 w-4" />
                          فتح واتساب
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setState({ kind: "idle" })}
                      >
                        إرسال رسالة أخرى
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FORM state (idle/submitting/error) */}
            {state.kind !== "success" && (
              <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="space-y-4"
              >
                {/* Honeypot — مخفي عن البشر، البوت يملأه */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-10000px",
                    width: "1px",
                    height: "1px",
                    overflow: "hidden",
                  }}
                >
                  <label htmlFor="website">لا تملأ هذا الحقل</label>
                  <input
                    id="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    {...register("website")}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">
                      الاسم <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="محمد العتيبي"
                      autoComplete="name"
                      aria-invalid={!!errors.name}
                      {...register("name")}
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive">
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">
                      البريد الإلكتروني <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      dir="ltr"
                      placeholder="you@example.com"
                      autoComplete="email"
                      aria-invalid={!!errors.email}
                      {...register("email")}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">
                      الجوال{" "}
                      <span className="text-xs text-muted-foreground">
                        (اختياري)
                      </span>
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      dir="ltr"
                      placeholder="+966 5X XXX XXXX"
                      autoComplete="tel"
                      aria-invalid={!!errors.phone}
                      {...register("phone")}
                    />
                    {errors.phone && (
                      <p className="text-xs text-destructive">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="subject">
                      الموضوع <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="subject"
                      placeholder="استفسار عن باقة الأعمال"
                      aria-invalid={!!errors.subject}
                      {...register("subject")}
                    />
                    {errors.subject && (
                      <p className="text-xs text-destructive">
                        {errors.subject.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">
                    رسالتك <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    rows={6}
                    placeholder="اكتب تفاصيل استفسارك هنا…"
                    aria-invalid={!!errors.message}
                    {...register("message")}
                    className="resize-y"
                  />
                  {errors.message && (
                    <p className="text-xs text-destructive">
                      {errors.message.message}
                    </p>
                  )}
                </div>

                {/* Error banner */}
                {state.kind === "error" && (
                  <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <p className="text-sm text-foreground">{state.message}</p>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    بإرسالك توافق على{" "}
                    <a
                      href="/legal/privacy"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      سياسة الخصوصية
                    </a>
                    .
                  </p>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting || state.kind === "submitting"}
                    className="w-full sm:w-auto"
                  >
                    {state.kind === "submitting" || isSubmitting ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري الإرسال…
                      </>
                    ) : (
                      <>
                        <Send className="ml-2 h-4 w-4" />
                        إرسال الرسالة
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Info cards */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                ساعات العمل
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                السبت – الخميس: 9:00 ص – 12:00 ص
                <br />
                الجمعة: 4:00 م – 12:00 ص (بتوقيت الرياض GMT+3)
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                المقر
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                رِفد للأعمال — مدينة الرياض
                <br />
                المملكة العربية السعودية 🇸🇦
              </p>
            </div>
          </div>

          {/* Specialty channels */}
          <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Phone className="h-4 w-4 text-primary" />
              قنوات متخصصة
            </h3>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <li>
                <span className="text-muted-foreground">الدعم الفني: </span>
                <a
                  className="text-primary hover:underline"
                  href="mailto:support@rifd.site"
                >
                  support@rifd.site
                </a>
              </li>
              <li>
                <span className="text-muted-foreground">الخصوصية: </span>
                <a
                  className="text-primary hover:underline"
                  href="mailto:privacy@rifd.site"
                >
                  privacy@rifd.site
                </a>
              </li>
              <li>
                <span className="text-muted-foreground">الاسترجاع: </span>
                <a
                  className="text-primary hover:underline"
                  href="mailto:refund@rifd.site"
                >
                  refund@rifd.site
                </a>
              </li>
              <li>
                <span className="text-muted-foreground">الشراكات: </span>
                <a
                  className="text-primary hover:underline"
                  href="mailto:hello@rifd.site"
                >
                  hello@rifd.site
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
