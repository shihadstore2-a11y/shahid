/**
 * Global TanStack Start configuration.
 *
 * - يضيف Security Headers middleware لكل الاستجابات (SSR + server routes + server functions)
 * - يطبّق CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy,
 *   Permissions-Policy لتقوية المتصفح ضد XSS/clickjacking/MIME-sniffing
 *
 * المرجع:
 * - OWASP Secure Headers Project
 * - https://docs.lovable.dev/features/security
 */
import { createMiddleware, createStart } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

/**
 * Content Security Policy منضبطة للتطبيق:
 * - script-src 'self' + 'unsafe-inline' (لـSSR hydration scripts) + Google OAuth
 * - style-src 'unsafe-inline' (Tailwind + shadcn CSS-in-JS variables)
 * - img-src يسمح بـSupabase Storage + data URIs (الصور المُولّدة)
 * - connect-src يسمح بـSupabase API + WebSocket realtime
 * - frame-ancestors 'none' = منع تضمين الموقع في iframe (clickjacking)
 *
 * NOTE: نتجنّب CSP "Strict" مع nonce حتى لا نكسر Vite hydration. الإعداد الحالي
 * متوازن بين الأمان والاستقرار، ومع ذلك يحمي من معظم نواقل XSS الكلاسيكية.
 */
const buildCsp = (allowLovablePreviewFrame: boolean) => [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://*.gstatic.com https://*.googleapis.com https://*.posthog.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co https://wubcgjuodozhrrigtngs.supabase.co https://*.gstatic.com https://*.googleusercontent.com https://*.posthog.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://wubcgjuodozhrrigtngs.supabase.co https://accounts.google.com https://*.googleapis.com https://*.posthog.com https://*.i.posthog.com",
  "frame-src 'self' https://accounts.google.com",
  allowLovablePreviewFrame ? "frame-ancestors 'self' https://*.lovable.dev https://*.lovable.app https://*.lovableproject.com" : "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/lovable/")) {
    return next();
  }

  const allowLovablePreviewFrame = url.searchParams.has("__lovable_token") || url.hostname.endsWith(".lovableproject.com");

  const result = await next();

  const headers: Record<string, string> = {
    // منع MIME-sniffing
    "X-Content-Type-Options": "nosniff",
    // إجبار HTTPS لمدة سنة + كل الـsubdomains
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    // تقليل تسريب الـreferrer للمواقع الأخرى
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // قفل الواجهات البرمجية الحساسة في المتصفح
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    // CSP — حماية شاملة ضد XSS مع استثناء مشروط لمعاينة Lovable فقط
    "Content-Security-Policy": buildCsp(allowLovablePreviewFrame),
  };

  if (!allowLovablePreviewFrame) {
    // منع clickjacking في الإنتاج؛ لا يُرسل في معاينة Lovable حتى لا يحجب iframe المعاينة.
    headers["X-Frame-Options"] = "DENY";
  }

  setResponseHeaders(headers);

  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware],
}));
