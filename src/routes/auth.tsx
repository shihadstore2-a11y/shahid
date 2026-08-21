import { useEffect, useState } from "react";
import { createFileRoute, Link, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { Sparkles, Mail, Lock, User, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/posthog";
import {
  normalizeSaudiPhone,
  validateSaudiPhone,
  SAUDI_PHONE_ERROR,
  SAUDI_PHONE_PLACEHOLDER,
} from "@/lib/phone";

function sanitizeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  if (value.includes("://")) return undefined;
  return value;
}

const PENDING_SIGNUP_PHONE_KEY = "rifd_pending_signup_whatsapp";

function profilePhoneErrorMessage(message?: string) {
  if (!message) return "تعذر حفظ رقم واتساب الآن. حاول مرة أخرى.";
  if (message.includes("duplicate key") || message.includes("profiles_whatsapp_unique_idx")) {
    return "رقم واتساب مستخدم مسبقاً في حساب آخر.";
  }
  if (message.includes("INVALID_SAUDI_WHATSAPP")) return SAUDI_PHONE_ERROR;
  return "تعذر حفظ رقم واتساب الآن. حاول مرة أخرى.";
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — رِفد للتقنية" },
      { name: "description", content: "ادخل حسابك في رِفد أو سجّل جديداً لتجهيز أول حزمة محتوى سعودية لمتجرك: منشور، صورة، وفكرة فيديو." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { redirect?: string; ref?: string } => {
    const redirect = sanitizeRedirectPath(search.redirect);
    const refRaw = typeof search.ref === "string" ? search.ref.trim().toUpperCase() : undefined;
    const ref = refRaw && /^[A-Z0-9]{4,16}$/.test(refRaw) ? refRaw : undefined;
    return { ...(redirect ? { redirect } : {}), ...(ref ? { ref } : {}) };
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const search = useSearch({ from: "/auth" });
  const redirectPath = search.redirect ?? "/dashboard";
  const onboardingIntent =
    redirectPath === "/onboarding" ||
    redirectPath === "/onboarding/wizard" ||
    location.searchStr.includes("redirect=/onboarding") ||
    location.searchStr.includes("redirect=%2Fonboarding");
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(onboardingIntent ? "signup" : "login");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);
  const whatsappTouched = whatsapp.trim().length > 0;
  const whatsappValid = validateSaudiPhone(whatsapp);

  useEffect(() => {
    if (onboardingIntent) setMode("signup");
  }, [onboardingIntent]);

  useEffect(() => {
    if (mode === "login") window.localStorage.removeItem(PENDING_SIGNUP_PHONE_KEY);
  }, [mode]);

  // إذا المستخدم مسجل دخول، حوّله مباشرة
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      const pendingWhatsapp = window.localStorage.getItem(PENDING_SIGNUP_PHONE_KEY);
      const mustCompleteOnboarding = Boolean(pendingWhatsapp || onboardingIntent || mode === "signup");
      if (pendingWhatsapp && profile && !profile.whatsapp) {
        void supabase
          .from("profiles")
          .update({ whatsapp: pendingWhatsapp })
          .eq("id", user.id)
          .then(({ error }) => {
            if (error) {
              toast.error(profilePhoneErrorMessage(error.message));
              return;
            }
            window.localStorage.removeItem(PENDING_SIGNUP_PHONE_KEY);
            void refreshProfile();
          });
      } else if (!profile && mustCompleteOnboarding) {
        void supabase
          .from("profiles")
          .upsert({
            id: user.id,
            email: user.email ?? null,
            full_name: (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined) ?? null,
            ...(pendingWhatsapp ? { whatsapp: pendingWhatsapp } : {}),
          })
          .then(({ error }) => {
            if (error) {
              toast.error(profilePhoneErrorMessage(error.message));
              return;
            }
            if (pendingWhatsapp) window.localStorage.removeItem(PENDING_SIGNUP_PHONE_KEY);
            void refreshProfile();
          });
      }
      if (profile && !profile.onboarded) {
        void navigate({ to: "/onboarding/wizard" });
      } else if (!profile && mustCompleteOnboarding) {
        void navigate({ to: "/onboarding/wizard" });
      } else if (`${location.pathname}${location.searchStr}${location.hash}` !== redirectPath) {
        void navigate({ to: redirectPath as never });
      }
    }
  }, [authLoading, user, profile, refreshProfile, navigate, redirectPath, location.pathname, location.searchStr, location.hash, onboardingIntent, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const normalizedWhatsapp = normalizeSaudiPhone(whatsapp);
        if (!normalizedWhatsapp) {
          toast.error(SAUDI_PHONE_ERROR);
          setSubmitting(false);
          return;
        }
        window.localStorage.setItem(PENDING_SIGNUP_PHONE_KEY, normalizedWhatsapp);
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { full_name: name.trim() },
          },
        });
        if (error) {
          window.localStorage.removeItem(PENDING_SIGNUP_PHONE_KEY);
          throw error;
        }
        // Wave C3: مطالبة بكود الإحالة إن وُجد
        if (search.ref) {
          try {
            await supabase.rpc("claim_referral_code", { _code: search.ref });
            track("referral_claimed", { code: search.ref });
          } catch (refErr) {
            console.warn("[auth] referral claim failed", refErr);
          }
        }
        track("signup_completed", { method: "email", referred: Boolean(search.ref) });
        toast.success("تم إنشاء حسابك! جاري التحويل...");
        void navigate({ to: "/onboarding/wizard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("أهلاً بعودتك 👋");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      // ترجمات سعودية ودودة لرسائل Supabase الشائعة
      if (msg.includes("Invalid login credentials")) {
        toast.error("البريد أو كلمة السر غير صحيحة");
      } else if (msg.includes("already registered") || msg.includes("User already")) {
        toast.error("هذا البريد مسجّل مسبقاً — جرّب تسجيل الدخول");
      } else if (msg.toLowerCase().includes("password")) {
        toast.error("كلمة السر ضعيفة — استخدم 8 أحرف على الأقل");
      } else {
        console.warn("[auth] handled auth error", msg);
        toast.error("تعذر إكمال العملية الآن. حاول مرة أخرى أو تواصل مع الدعم.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocialAuth = async (provider: "google" | "apple") => {
    setSocialLoading(provider);
    try {
      if (mode === "signup") {
        const normalizedWhatsapp = normalizeSaudiPhone(whatsapp);
        if (!normalizedWhatsapp) {
          toast.error(SAUDI_PHONE_ERROR);
          setSocialLoading(null);
          return;
        }
        window.localStorage.setItem(PENDING_SIGNUP_PHONE_KEY, normalizedWhatsapp);
      }
      const finalRedirectPath = mode === "signup" ? "/onboarding/wizard" : redirectPath;
      const authReturnPath = finalRedirectPath === "/dashboard"
        ? "/auth"
        : `/auth?redirect=${encodeURIComponent(finalRedirectPath)}`;
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}${authReturnPath}`,
      });
      if (result.error) {
        window.localStorage.removeItem(PENDING_SIGNUP_PHONE_KEY);
        console.warn(`[auth] ${provider} oauth rejected`, result.error.message);
        toast.error(`فشل الاتصال بـ${provider === "apple" ? "Apple" : "Google"}. حاول مرة أخرى بعد قليل.`);
        setSocialLoading(null);
        return;
      }
      // إذا redirected = true، المتصفح بيتحول لمزوّد الدخول تلقائياً
      // إذا رجعت tokens، الجلسة بتنحفظ والـuseEffect أعلاه يحوّل للوجهة الصحيحة
    } catch (err) {
      console.warn(`[auth] ${provider} oauth error`, err);
        window.localStorage.removeItem(PENDING_SIGNUP_PHONE_KEY);
        toast.error(`فشل الاتصال بـ${provider === "apple" ? "Apple" : "Google"}. حاول مرة أخرى بعد قليل.`);
      setSocialLoading(null);
    }
  };

  const signupPhoneField = mode === "signup" ? (
    <div>
      <Label htmlFor="whatsapp">رقم الجوال للواتساب</Label>
      <div
        className={cn(
          "mt-1 flex min-h-11 items-center overflow-hidden rounded-lg border bg-background shadow-sm transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
          whatsappTouched && !whatsappValid ? "border-destructive" : "border-input",
        )}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-l border-border bg-secondary px-3 text-sm font-extrabold text-foreground">
          <MessageCircle className="h-4 w-4 text-success" />
          <span dir="ltr">+966</span>
        </div>
        <Input
          id="whatsapp"
          dir="ltr"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder={SAUDI_PHONE_PLACEHOLDER}
          maxLength={20}
          inputMode="tel"
          autoComplete="tel"
          aria-invalid={whatsappTouched && !whatsappValid}
          className="h-11 border-0 bg-transparent px-3 text-left font-bold shadow-none focus-visible:ring-0"
        />
      </div>
      {whatsappTouched && !whatsappValid && (
        <p className="mt-2 text-xs leading-5 text-destructive">{SAUDI_PHONE_ERROR}</p>
      )}
    </div>
  ) : null;

  return (
    <MarketingLayout>
      <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md items-center px-4 pb-28 pt-10 sm:py-10">
        <div className="w-full rounded-2xl border border-border bg-card p-7 shadow-elegant">
          <div className="mb-6 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-elegant">
              <Sparkles className="h-6 w-6" />
            </span>
              <h1 className="mt-4 text-2xl font-extrabold">
                {mode === "login" ? "الدخول برقم الهاتف أو البريد الإلكتروني" : "ابدأ حسابك خلال دقيقة"}
            </h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {mode === "login"
                ? "ادخل لمتابعة توليد المحتوى وإدارة ذاكرة متجرك"
                  : "سجّل بحسابك في GOOGLE أو بالبريد، ثم نبني ذاكرة متجرك ونجهّز أول حزمة محتوى سعودية."}
            </p>
          </div>

          <div className="mb-5 flex rounded-lg border border-border bg-secondary p-1">
            <button
              onClick={() => setMode("login")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium",
                mode === "login" ? "bg-background text-foreground shadow-soft" : "text-muted-foreground"
              )}
            >
              دخول
            </button>
            <button
              onClick={() => setMode("signup")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium",
                mode === "signup" ? "bg-background text-foreground shadow-soft" : "text-muted-foreground"
              )}
            >
              تسجيل جديد
            </button>
          </div>

          {signupPhoneField && <div className="mb-4">{signupPhoneField}</div>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSocialAuth("apple")}
              disabled={Boolean(socialLoading) || submitting}
              className="h-11 w-full font-extrabold"
            >
              <span className="inline-flex items-center justify-center gap-2" dir="rtl">
                <span>{mode === "signup" ? "سجّل بحساب Apple" : "متابعة بحساب Apple"}</span>
                {socialLoading === "apple" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M16.55 13.04c-.03-2.72 2.22-4.04 2.32-4.1-1.27-1.85-3.24-2.1-3.93-2.13-1.65-.17-3.25.99-4.09.99-.86 0-2.15-.97-3.55-.94-1.8.03-3.49 1.07-4.42 2.69-1.91 3.31-.49 8.18 1.35 10.86.92 1.31 1.99 2.78 3.39 2.73 1.37-.06 1.88-.88 3.53-.88 1.64 0 2.12.88 3.55.85 1.47-.03 2.4-1.32 3.28-2.64 1.06-1.5 1.48-2.99 1.5-3.06-.03-.01-2.9-1.11-2.93-4.37ZM13.86 5.06c.74-.93 1.25-2.19 1.1-3.47-1.07.05-2.4.74-3.17 1.65-.68.8-1.29 2.11-1.12 3.34 1.2.09 2.43-.61 3.19-1.52Z" />
                  </svg>
                )}
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSocialAuth("google")}
              disabled={Boolean(socialLoading) || submitting}
              className="h-11 w-full font-extrabold"
            >
              <span className="inline-flex items-center justify-center gap-2" dir="rtl">
                <span>{mode === "signup" ? "سجّل بحساب Google" : "متابعة بحساب Google"}</span>
                {socialLoading === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
              </span>
            </Button>
          </div>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            أو
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="name">الاسم الكامل</Label>
                  <div className="relative mt-1">
                    <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثلاً: أحمد العتيبي"
                      required
                      className="pr-10"
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-bold leading-5 text-muted-foreground">
                  Google هو الأسرع، والبريد متاح إذا تفضل كلمة سر خاصة.
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="relative mt-1">
                <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="pr-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password">كلمة السر</Label>
              <div className="relative mt-1">
                <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  className="pr-10"
                />
              </div>
              <div className="mt-1 flex items-center justify-between">
                {mode === "signup" ? (
                  <p className="text-xs text-muted-foreground">8 أحرف على الأقل</p>
                ) : (
                  <span />
                )}
                {mode === "login" && (
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    نسيت كلمة السر؟
                  </Link>
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting || Boolean(socialLoading) || (mode === "signup" && !whatsappValid)}
              className="w-full gradient-primary text-primary-foreground shadow-elegant"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> جاري التنفيذ...
                </>
              ) : mode === "login" ? (
                "ادخل لحسابي"
              ) : (
                "أنشئ حسابي مجاناً"
              )}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            بإنشائك للحساب توافق على{" "}
            <Link to="/legal/terms" className="text-primary hover:underline">
              الشروط
            </Link>{" "}
            و{" "}
            <Link to="/legal/privacy" className="text-primary hover:underline">
              الخصوصية
            </Link>
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}
