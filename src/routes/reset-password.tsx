import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "إعادة تعيين كلمة السر — رِفد" },
      { name: "description", content: "أدخل كلمة سر جديدة لحسابك في رِفد." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase recovery flow:
  // The email link sends user back with type=recovery in URL hash and
  // supabase-js auto-creates a session. We listen for PASSWORD_RECOVERY event
  // and ALSO check getSession() as a fallback.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setValidSession(true);
        setReady(true);
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const isRecovery = hash.includes("type=recovery");
      if (session && isRecovery) {
        setValidSession(true);
      } else if (session) {
        // Already logged in normally — still allow update
        setValidSession(true);
      }
      setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("كلمة السر يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      toast.error("كلمتا السر غير متطابقتين");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("تم تحديث كلمة السر بنجاح");
      setTimeout(() => {
        void navigate({ to: "/dashboard" });
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل تحديث كلمة السر";
      if (msg.toLowerCase().includes("same") || msg.includes("New password")) {
        toast.error("كلمة السر الجديدة يجب أن تكون مختلفة عن السابقة");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <MarketingLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </MarketingLayout>
    );
  }

  if (!validSession) {
    return (
      <MarketingLayout>
        <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md items-center px-4 py-10">
          <div className="w-full rounded-2xl border border-border bg-card p-7 text-center shadow-elegant">
            <h1 className="text-xl font-extrabold">رابط غير صالح أو منتهي</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              رابط إعادة تعيين كلمة السر منتهي الصلاحية أو غير صحيح. اطلب رابط جديد.
            </p>
            <Button asChild className="mt-5 w-full gradient-primary text-primary-foreground">
              <Link to="/forgot-password">اطلب رابط جديد</Link>
            </Button>
            <Link to="/auth" className="mt-3 inline-block text-xs text-muted-foreground hover:text-foreground">
              العودة لتسجيل الدخول
            </Link>
          </div>
        </div>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-border bg-card p-7 shadow-elegant">
          <div className="mb-6 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-elegant">
              {done ? <CheckCircle2 className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
            </span>
            <h1 className="mt-4 text-2xl font-extrabold">
              {done ? "تم بنجاح!" : "أنشئ كلمة سر جديدة"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {done ? "جاري تحويلك للوحة التحكم..." : "اختر كلمة سر قوية تحتفظ بها بأمان"}
            </p>
          </div>

          {!done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">كلمة السر الجديدة</Label>
                <div className="relative mt-1">
                  <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pr-10"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">8 أحرف على الأقل</p>
              </div>
              <div>
                <Label htmlFor="confirm">تأكيد كلمة السر</Label>
                <div className="relative mt-1">
                  <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pr-10"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full gradient-primary text-primary-foreground shadow-elegant"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> جاري التحديث...
                  </>
                ) : (
                  "احفظ كلمة السر الجديدة"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </MarketingLayout>
  );
}
