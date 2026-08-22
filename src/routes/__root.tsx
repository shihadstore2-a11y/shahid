import { useEffect, useState } from "react";
import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouter } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { CookieBanner } from "@/components/cookie-banner";
import { initAnalytics, identifyUser, resetAnalytics, trackPageview } from "@/lib/analytics/posthog";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">٤٠٤</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة اللي تدوّر عليها مو موجودة أو تم نقلها.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function RootErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="max-w-xl rounded-2xl border border-destructive/30 bg-destructive/5 p-8 shadow-sm">
        <h1 className="text-xl font-bold text-destructive mb-3">تفاصيل الخطأ التشخيصي</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {error?.message || "حدث خطأ غير معروف"}
        </p>
        {error?.stack && (
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/90 p-4 text-left font-mono text-xs text-red-400">
            {error.stack}
          </pre>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            إعادة المحاولة
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "author", content: "Digitaneo للتقنية" },
      { name: "theme-color", content: "#1a5d3e" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ar_SA" },
      { property: "og:site_name", content: "Digitaneo للتقنية" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  errorComponent: RootErrorComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * يهيّئ PostHog مرة واحدة، ويربط/يفك ربط المستخدم تلقائياً،
 * ويتتبّع كل تغيير route كـpageview. SSR-safe بالكامل.
 */
function AnalyticsBridge() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [analyticsReady, setAnalyticsReady] = useState(false);

  // تهيئة مؤجلة: التحليلات لا يجب أن تنافس أول رسم/LCP على صفحات التسويق.
  useEffect(() => {
    const start = () => {
      void initAnalytics().then((ph) => {
        if (!ph) return;
        trackPageview(window.location.pathname + window.location.search);
        setAnalyticsReady(true);
      });
    };

    const timeoutId = window.setTimeout(start, 3_500);

    const unsubscribe = router.subscribe("onResolved", ({ toLocation }) => {
      trackPageview(toLocation.pathname + (toLocation.searchStr || ""));
    });
    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [router]);

  // ربط/فك ربط المستخدم
  useEffect(() => {
    if (!analyticsReady) return;
    if (loading) return;
    if (user) {
      identifyUser(user.id, {
        plan: profile?.plan,
        onboarded: profile?.onboarded,
      });
    } else {
      resetAnalytics();
    }
  }, [analyticsReady, user, profile, loading]);

  return null;
}

function RootComponent() {
  return (
    <AuthProvider>
      <AnalyticsBridge />
      <Outlet />
      <Toaster richColors position="top-center" />
      <CookieBanner />
    </AuthProvider>
  );
}
