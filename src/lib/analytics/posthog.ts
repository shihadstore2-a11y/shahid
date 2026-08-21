/**
 * PostHog Analytics — رِفد
 *
 * فلسفة التركيب:
 * - SSR-safe: لا يُهيَّأ على السيرفر إطلاقاً (يحتاج window).
 * - Opt-in بالمفتاح: إذا غاب VITE_POSTHOG_KEY، الـtrack() يعمل بصمت بلا أخطاء.
 * - مرّة واحدة: يحمي من re-init في React StrictMode أو HMR.
 * - PII-safe: لا نمرّر إيميلات/أسماء افتراضياً، فقط user_id و plan.
 *
 * الأحداث المعتمدة (لا تغيّر الأسماء بدون تنسيق):
 *   $pageview              — تلقائي عبر autocapture
 *   signup_completed       — بعد إنشاء حساب جديد
 *   onboarding_completed   — بعد إكمال onboarding كامل
 *   subscription_requested — بعد إنشاء subscription_request
 *   generation_created     — بعد توليد نص أو صورة (props: kind, template?)
 */

import type { PostHog } from "posthog-js";

/**
 * PostHog Project API Key — مفتاح علني للمتصفح (مصمَّم للنشر في bundle).
 * الأمان يعتمد على CORS allowlist في إعدادات PostHog، لا على إخفاء المفتاح.
 * المرجع: https://posthog.com/docs/privacy/security#api-keys
 */
const KEY = "phc_s8uwSfxBzpWVdtrTjARXYfYX449CoUPPbLDsFVvskaZL";
const HOST = "https://us.i.posthog.com";

let _client: PostHog | null = null;
let _initialized = false;
let _initPromise: Promise<PostHog | null> | null = null;

/** هل المفتاح متوفّر — مفيد للـDX/الـDebug */
export function isAnalyticsEnabled(): boolean {
  return !!KEY && typeof window !== "undefined";
}

/**
 * تهيئة كسولة عند أول استخدام (يحدث داخل useEffect في __root).
 * يُرجع null بهدوء عند غياب المفتاح أو على السيرفر.
 */
export async function initAnalytics(): Promise<PostHog | null> {
  if (typeof window === "undefined") return null;
  if (!KEY) return null;
  if (_initialized) return _client;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const mod = await import("posthog-js");
      const posthog = mod.default;
      posthog.init(KEY, {
        api_host: HOST,
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: false, // نتحكّم يدوياً في الأحداث المهمّة
        disable_session_recording: false,
        loaded: (ph) => {
          if (import.meta.env.DEV) ph.debug(false);
        },
      });
      _client = posthog;
      _initialized = true;
      return posthog;
    } catch (e) {
      // فشل صامت — لا يجب أن تتوقف الواجهة لأجل التحليلات
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[analytics] init failed", e);
      }
      return null;
    }
  })();

  return _initPromise;
}

/** تتبّع حدث — صامت إن لم يكن متاحاً */
export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!_client) return;
  try {
    _client.capture(event, properties);
  } catch {
    /* ignore */
  }
}

/** ربط مستخدم مسجَّل — بدون PII حسّاسة افتراضياً */
export function identifyUser(
  userId: string,
  traits?: { plan?: string; onboarded?: boolean },
): void {
  if (!_client || !userId) return;
  try {
    _client.identify(userId, traits);
  } catch {
    /* ignore */
  }
}

/** فك الربط عند تسجيل الخروج */
export function resetAnalytics(): void {
  if (!_client) return;
  try {
    _client.reset();
  } catch {
    /* ignore */
  }
}

/** تتبّع pageview يدوياً (نستخدمه في router subscribe) */
export function trackPageview(path?: string): void {
  if (!_client) return;
  try {
    _client.capture("$pageview", path ? { $current_url: path } : undefined);
  } catch {
    /* ignore */
  }
}
