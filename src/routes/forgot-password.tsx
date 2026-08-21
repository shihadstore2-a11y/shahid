import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Mail, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "نسيت كلمة السر — رِفد" },
      { name: "description", content: "استعد الوصول لحسابك في رِفد عبر رابط آمن لإعادة تعيين كلمة السر." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("أرسلنا الرابط لبريدك");
    } catch (err) {
      // لأسباب أمنية، لا نكشف ما إذا كان البريد موجوداً
      setSent(true);
      toast.success("إذا كان البريد مسجّلاً، ستجد الرابط في صندوق الوارد");
      console.warn("[forgot-password]", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingLayout>
      <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-border bg-card p-7 shadow-elegant">
          <div className="mb-6 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-elegant">
              {sent ? <CheckCircle2 className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
            </span>
            <h1 className="mt-4 text-2xl font-extrabold">
              {sent ? "تحقق من بريدك" : "نسيت كلمة السر؟"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {sent
                ? `أرسلنا رابط إعادة التعيين إلى ${email}. الرابط صالح لمدة ساعة واحدة.`
                : "اكتب بريدك ونرسل لك رابطاً آمناً لإعادة تعيين كلمة السر"}
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button
                type="submit"
                disabled={submitting}
                className="w-full gradient-primary text-primary-foreground shadow-elegant"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> جاري الإرسال...
                  </>
                ) : (
                  "أرسل رابط إعادة التعيين"
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-3 text-center text-sm text-muted-foreground">
              <p>لم يصلك البريد؟ تحقق من مجلد <strong>الرسائل غير المرغوبة (Spam)</strong>.</p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-primary hover:underline"
              >
                جرّب بريداً آخر
              </button>
            </div>
          )}

          <div className="mt-6 border-t border-border pt-4 text-center">
            <Link
              to="/auth"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="h-3 w-3" />
              العودة لتسجيل الدخول
            </Link>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
