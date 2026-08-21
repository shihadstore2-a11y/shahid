/**
 * /onboarding — مسار قديم محتفَظ به للروابط الخارجية القديمة وروابط
 * تفعيل البريد. يعيد التوجيه فوراً إلى /onboarding/wizard (Wave B)
 * لتوحيد تجربة الإعداد على الـ 3 خطوات الجديدة.
 *
 * ملاحظة: المنطق التفصيلي القديم (نموذج صفحة واحدة + consent persist)
 * نُقل إلى /onboarding/wizard. تسجيل الـ consent يتم الآن داخل الـ wizard.
 */
import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "ابدأ في 60 ثانية — رِفد" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OnboardingRedirect,
});

function OnboardingRedirect() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/auth", search: { redirect: "/onboarding/wizard" } as never });
      return;
    }
    if (profile?.onboarded) {
      void navigate({ to: "/dashboard" });
      return;
    }
    void navigate({ to: "/onboarding/wizard" });
  }, [loading, user, profile, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
