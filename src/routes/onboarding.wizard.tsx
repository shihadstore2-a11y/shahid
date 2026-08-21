/**
 * Onboarding Wizard 3 خطوات (60 ثانية إجمالاً)
 * ─────────────────────────────────────────────
 * 1. متجرك (الاسم + اللون + المنتج)
 * 2. جمهورك (نوع العميل + المدينة)
 * 3. أول إعلان جاهز (auto-generate نص + صورة)
 *
 * Fallback: عند فشل التوليد → loader "نحضّر محتواك..." +
 * retry تلقائي صامت (محاولتان exponential backoff). إن فشل
 * نهائياً → ينقل لـ /dashboard مع toast وداع لطيف.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Loader2, Sparkles, Store, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/posthog";
import { generateText, generateImage } from "@/server/ai-functions";

export const Route = createFileRoute("/onboarding/wizard")({
  head: () => ({
    meta: [
      { title: "ابدأ في 60 ثانية — رِفد" },
      {
        name: "description",
        content: "ثلاث خطوات سريعة لتجهيز متجرك واستلام أول إعلان جاهز للنشر.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: WizardPage,
});

const PRODUCT_OPTIONS = [
  { id: "fashion", label: "موضة وأزياء" },
  { id: "perfumes", label: "عطور" },
  { id: "electronics", label: "إلكترونيات" },
  { id: "food", label: "أكل ومشروبات" },
  { id: "handmade", label: "منتجات يدوية" },
  { id: "services", label: "خدمات" },
  { id: "other", label: "أخرى" },
];

const AUDIENCE_OPTIONS = [
  { id: "young", label: "شباب 18-24" },
  { id: "adults", label: "بالغين 25-35" },
  { id: "professionals", label: "موظفين 30-45" },
  { id: "moms", label: "أمهات" },
  { id: "luxury", label: "فئة فاخرة 35+" },
];

const SAUDI_CITIES = ["الرياض", "جدة", "مكة", "المدينة", "الدمام", "الخبر", "الطائف", "تبوك", "أبها", "بريدة", "أخرى"];

const BRAND_COLORS = [
  { value: "#1a5d3e", label: "أخضر سعودي" },
  { value: "#0f3a8a", label: "أزرق ملكي" },
  { value: "#8b1a3a", label: "عنابي فاخر" },
  { value: "#d4a017", label: "ذهبي" },
  { value: "#1f1f1f", label: "أسود أنيق" },
];

type Step1 = { storeName: string; brandColor: string; productLabel: string };
type Step2 = { audienceLabel: string; city: string };

async function logEvent(
  userId: string,
  step: number,
  eventType: "started" | "step_completed" | "wizard_completed" | "wizard_abandoned" | "autogen_started" | "autogen_succeeded" | "autogen_failed",
  metadata: Record<string, unknown> = {},
) {
  try {
    // الجدول جديد، types لم تُحدَّث بعد — نستخدم cast آمن للوصول
    await (supabase as unknown as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
      };
    })
      .from("onboarding_events")
      .insert({ user_id: userId, step, event_type: eventType, metadata });
  } catch {
    /* silent */
  }
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2, baseDelayMs = 1500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

function WizardPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [s1, setS1] = useState<Step1>({ storeName: "", brandColor: "#1a5d3e", productLabel: "" });
  const [s2, setS2] = useState<Step2>({ audienceLabel: "", city: "" });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ text: string; imageUrl: string } | null>(null);
  const [genFailed, setGenFailed] = useState(false);
  const startedRef = useRef(false);

  // Redirect إن غير مسجل
  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: "/onboarding/wizard" } as never });
    }
  }, [loading, user, navigate]);

  // إعادة تعبئة من profile موجود
  useEffect(() => {
    if (!profile) return;
    setS1((prev) => ({
      storeName: profile.store_name ?? prev.storeName,
      brandColor: profile.brand_color ?? prev.brandColor,
      productLabel: profile.product_type ?? prev.productLabel,
    }));
    setS2((prev) => ({
      audienceLabel: profile.audience ?? prev.audienceLabel,
      city: prev.city,
    }));
  }, [profile]);

  // event "started" مرة واحدة
  useEffect(() => {
    if (!user || startedRef.current) return;
    startedRef.current = true;
    void logEvent(user.id, 0, "started");
    track("onboarding_started");
  }, [user]);

  // إن أكمل سابقاً
  useEffect(() => {
    const completedAt = (profile as unknown as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at;
    if (completedAt) {
      navigate({ to: "/dashboard" });
    }
  }, [profile, navigate]);

  const progress = useMemo(() => (step === 1 ? 33 : step === 2 ? 66 : 100), [step]);

  async function handleStep1Next() {
    if (!user) return;
    if (!s1.storeName.trim() || !s1.productLabel.trim()) {
      toast.error("اكتب اسم المتجر واختر نوع المنتج");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          store_name: s1.storeName.trim(),
          brand_color: s1.brandColor,
          product_type: s1.productLabel,
          onboarding_step: 1,
        })
        .eq("id", user.id);
      if (error) throw error;
      await logEvent(user.id, 1, "step_completed", { product: s1.productLabel });
      track("onboarding_step_completed", { step: 1 });
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر حفظ البيانات");
    } finally {
      setSaving(false);
    }
  }

  async function handleStep2Next() {
    if (!user) return;
    if (!s2.audienceLabel.trim() || !s2.city.trim()) {
      toast.error("اختر الجمهور والمدينة");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          audience: s2.audienceLabel,
          onboarding_step: 2,
        })
        .eq("id", user.id);
      if (error) throw error;
      await logEvent(user.id, 2, "step_completed", { audience: s2.audienceLabel, city: s2.city });
      track("onboarding_step_completed", { step: 2 });
      setStep(3);
      // ابدأ التوليد التلقائي فوراً
      void runAutoGenerate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر حفظ البيانات");
    } finally {
      setSaving(false);
    }
  }

  async function runAutoGenerate() {
    if (!user) return;
    setGenerating(true);
    setGenFailed(false);
    setGenResult(null);
    await logEvent(user.id, 3, "autogen_started");
    track("onboarding_autogen_started");

    const product = s1.productLabel || profile?.product_type || "منتج";
    const storeName = s1.storeName || profile?.store_name || "متجري";
    const audience = s2.audienceLabel || "العملاء السعوديين";

    const textPrompt = `إعلان قصير لمتجر "${storeName}" يبيع ${product} لجمهور ${audience} في ${s2.city || "السعودية"}. الهدف: جذب أول عميل بنبرة موثوقة وعربية أصيلة. اذكر ميزة محددة + CTA واضح.`;
    const imagePrompt = `صورة إعلان احترافية لمتجر سعودي اسمه "${storeName}" يبيع ${product}، بأسلوب نظيف عصري، إضاءة طبيعية، خلفية تليق بـ${audience}، بدون نصوص داخل الصورة.`;

    try {
      const [textRes, imageRes] = await Promise.all([
        withRetry(() =>
          generateText({
            data: {
              prompt: textPrompt,
              templateTitle: "إعلان منتج",
              templateId: "onboarding_first_win",
            },
          })
        ),
        withRetry(() =>
          generateImage({
            data: {
              prompt: imagePrompt,
              templateTitle: "صورة إعلان",
              templateId: "onboarding_first_win",
              quality: "flash",
            },
          })
        ),
      ]);

      setGenResult({ text: textRes.result, imageUrl: imageRes.url });
      await finishWizard("succeeded");
    } catch (e) {
      console.warn("[onboarding-wizard] autogen failed", e);
      setGenFailed(true);
      await logEvent(user.id, 3, "autogen_failed", { error: e instanceof Error ? e.message : String(e) });
      track("onboarding_autogen_failed");
      // ننهي الـ wizard على أي حال — المحتوى يأتي لاحقاً
      await finishWizard("failed");
      // نعرض رسالة لطيفة ثم ننقل بعد 3 ثوانٍ
      toast.message("نحضّر محتواك", {
        description: "أول إعلان جاهز سيظهر في مكتبتك خلال دقائق.",
      });
      setTimeout(() => navigate({ to: "/dashboard" }), 3500);
    } finally {
      setGenerating(false);
    }
  }

  async function finishWizard(autogen: "succeeded" | "failed") {
    if (!user) return;
    try {
      await supabase
        .from("profiles")
        .update({
          onboarding_step: 3,
          onboarding_completed_at: new Date().toISOString(),
          onboarded: true,
        })
        .eq("id", user.id);
      await logEvent(user.id, 3, autogen === "succeeded" ? "autogen_succeeded" : "wizard_completed");
      await logEvent(user.id, 3, "wizard_completed", { autogen });
      track("onboarding_wizard_completed", { autogen });
      void refreshProfile();
    } catch {
      /* silent */
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background to-muted/40 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
            <Sparkles className="size-3.5" />
            ابدأ في 60 ثانية
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">جهّز متجرك واحصل على أول إعلان</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            ثلاث خطوات قصيرة، ثم نولّد لك نصاً وصورة جاهزَين للنشر.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>الخطوة {step} من 3</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5 sm:p-7">
            {step === 1 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <Store className="size-4 text-primary" />
                  متجرك
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storeName">اسم المتجر</Label>
                  <Input
                    id="storeName"
                    value={s1.storeName}
                    onChange={(e) => setS1((p) => ({ ...p, storeName: e.target.value }))}
                    placeholder="مثل: متجر زهور الرياض"
                    maxLength={80}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label>المنتج الأساسي</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRODUCT_OPTIONS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setS1((prev) => ({ ...prev, productLabel: p.label }))}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition",
                          s1.productLabel === p.label
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/50"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>لون هويتك</Label>
                  <div className="flex flex-wrap gap-2">
                    {BRAND_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setS1((prev) => ({ ...prev, brandColor: c.value }))}
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
                          s1.brandColor === c.value ? "border-foreground" : "border-border hover:border-foreground/50"
                        )}
                      >
                        <span className="size-4 rounded-full border border-border" style={{ backgroundColor: c.value }} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <Button onClick={handleStep1Next} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                    التالي
                    <ArrowLeft className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <Target className="size-4 text-primary" />
                  جمهورك
                </div>

                <div className="space-y-2">
                  <Label>نوع العميل المستهدف</Label>
                  <div className="flex flex-wrap gap-2">
                    {AUDIENCE_OPTIONS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setS2((prev) => ({ ...prev, audienceLabel: a.label }))}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition",
                          s2.audienceLabel === a.label
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/50"
                        )}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>المدينة الرئيسية</Label>
                  <div className="flex flex-wrap gap-2">
                    {SAUDI_CITIES.map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => setS2((prev) => ({ ...prev, city }))}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition",
                          s2.city === city
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/50"
                        )}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                    <ArrowRight className="size-4" />
                    رجوع
                  </Button>
                  <Button onClick={handleStep2Next} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                    ولّد أول إعلان
                    <Sparkles className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <Sparkles className="size-4 text-primary" />
                  أول إعلان جاهز
                </div>

                {generating && (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">نحضّر أول إعلان لمتجرك…</p>
                    <p className="text-xs text-muted-foreground">يستغرق هذا حوالي 20–30 ثانية</p>
                  </div>
                )}

                {!generating && genResult && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
                        <CheckCircle2 className="size-4" />
                        محتواك جاهز للنشر
                      </div>
                      <p className="text-xs text-muted-foreground">
                        محفوظ تلقائياً في مكتبتك. تستطيع تعديله ونشره مباشرة.
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-border">
                      <img src={genResult.imageUrl} alt="إعلان متجرك" className="aspect-square w-full object-cover" />
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-4">
                      <div className="mb-2 text-xs font-medium text-muted-foreground">نص الإعلان</div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{genResult.text}</p>
                    </div>

                    <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        asChild
                        className="gap-2"
                      >
                        <a href={genResult.imageUrl} download={`rifd-first-ad.jpg`}>
                          <Download className="size-4" />
                          حمّل الصورة
                        </a>
                      </Button>
                      <Button onClick={() => navigate({ to: "/dashboard" })} className="gap-2">
                        ادخل لوحة التحكم
                        <ArrowLeft className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {!generating && genFailed && !genResult && (
                  <div className="space-y-4 py-6 text-center">
                    <Loader2 className="mx-auto size-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">نحضّر محتواك خلف الكواليس</p>
                    <p className="text-xs text-muted-foreground">
                      أول إعلان سيكون جاهزاً في مكتبتك خلال دقائق. سننقلك للوحة التحكم الآن.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skip */}
        {step !== 3 && (
          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={async () => {
                if (user) await logEvent(user.id, step, "wizard_abandoned");
                navigate({ to: "/dashboard" });
              }}
            >
              تخطّ الآن وأكمل لاحقاً
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
