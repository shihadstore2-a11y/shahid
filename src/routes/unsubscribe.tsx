import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({ meta: [{ title: "إلغاء الاشتراك من الإشعارات — رِفد" }] }),
  component: UnsubscribePage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
});

type State =
  | { status: "loading" }
  | { status: "valid" }
  | { status: "already" }
  | { status: "invalid" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "invalid" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/email/unsubscribe?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "invalid" });
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState({ status: "already" });
        } else if (data.valid === true) {
          setState({ status: "valid" });
        } else {
          setState({ status: "invalid" });
        }
      } catch {
        if (!cancelled) setState({ status: "invalid" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleConfirm() {
    setState({ status: "submitting" });
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({
          status: "error",
          message: data.error ?? "تعذّر إلغاء الاشتراك",
        });
        return;
      }
      if (data.success === false && data.reason === "already_unsubscribed") {
        setState({ status: "already" });
      } else {
        setState({ status: "success" });
      }
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "خطأ غير متوقع",
      });
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center bg-muted/30 px-4"
    >
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <MailX className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold mb-2">إلغاء الاشتراك من الإشعارات</h1>

        {state.status === "loading" && (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">جارٍ التحقق من الرابط...</span>
          </div>
        )}

        {state.status === "valid" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              هل ترغب فعلاً بإيقاف استلام رسائل البريد الإلكتروني من رِفد؟
              <br />
              ستظل قادراً على استخدام حسابك بشكل طبيعي.
            </p>
            <Button onClick={handleConfirm} className="w-full" size="lg">
              نعم، ألغِ اشتراكي
            </Button>
          </>
        )}

        {state.status === "submitting" && (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">جارٍ المعالجة...</span>
          </div>
        )}

        {state.status === "success" && (
          <div className="py-4">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-600" />
            <p className="font-semibold">تم إلغاء اشتراكك بنجاح</p>
            <p className="mt-1 text-sm text-muted-foreground">
              لن تستلم أي رسائل بريد إلكتروني منّا بعد الآن.
            </p>
          </div>
        )}

        {state.status === "already" && (
          <div className="py-4">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-600" />
            <p className="font-semibold">أنت ملغى الاشتراك مسبقاً</p>
            <p className="mt-1 text-sm text-muted-foreground">
              لن تستلم أي رسائل منّا.
            </p>
          </div>
        )}

        {state.status === "invalid" && (
          <div className="py-4">
            <XCircle className="mx-auto mb-2 h-10 w-10 text-destructive" />
            <p className="font-semibold">رابط غير صالح أو منتهٍ</p>
            <p className="mt-1 text-sm text-muted-foreground">
              تحقّق من أنك استخدمت أحدث رابط من بريدك.
            </p>
          </div>
        )}

        {state.status === "error" && (
          <div className="py-4">
            <XCircle className="mx-auto mb-2 h-10 w-10 text-destructive" />
            <p className="font-semibold">تعذّر إلغاء الاشتراك</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {state.message}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={handleConfirm}
            >
              حاول مرة أخرى
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
