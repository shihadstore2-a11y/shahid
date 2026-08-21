/**
 * A/B Testing — مكتبة خفيفة لتقسيم الزوار وتسجيل الأحداث.
 * 
 * - Variant ثابت لكل زائر (localStorage) → نفس النسخة طوال جلساته.
 * - Session ID مجهول (بدون بيانات شخصية).
 * - Rate-limit بسيط: كل (experiment, event_type) يُسجَّل مرة واحدة لكل جلسة.
 */
import { supabase } from "@/integrations/supabase/client";

const STORAGE_PREFIX = "rifd_ab_";
const SESSION_KEY = "rifd_ab_session";
const SENT_EVENTS_KEY = "rifd_ab_sent";
const ATTRIBUTION_PREFIX = "rifd_ab_attr_";

export type Variant = "A" | "B";
export type EventType = "view" | "cta_click" | "demo_try" | "submit";

/** يحصل على variant ثابت للزائر — يحفظه أول مرة بنسبة 50/50. */
export function getVariant(experiment: string): Variant {
  if (typeof window === "undefined") return "A";
  const key = `${STORAGE_PREFIX}${experiment}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing === "A" || existing === "B") return existing;
    const v: Variant = Math.random() < 0.5 ? "A" : "B";
    localStorage.setItem(key, v);
    return v;
  } catch {
    return Math.random() < 0.5 ? "A" : "B";
  }
}

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

function alreadySent(experiment: string, variant: Variant, eventType: EventType): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = sessionStorage.getItem(SENT_EVENTS_KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    const key = `${experiment}:${variant}:${eventType}`;
    if (set.has(key)) return true;
    set.add(key);
    sessionStorage.setItem(SENT_EVENTS_KEY, JSON.stringify(Array.from(set)));
    return false;
  } catch {
    return false;
  }
}

/** يسجّل حدث A/B (مع rate-limit per-session لتجنب الإغراق). */
export async function trackEvent(
  experiment: string,
  variant: Variant,
  eventType: EventType
): Promise<void> {
  if (typeof window === "undefined") return;
  if (alreadySent(experiment, variant, eventType)) return;
  try {
    await supabase.from("ab_test_events").insert({
      experiment,
      variant,
      event_type: eventType,
      session_id: getSessionId(),
      user_agent: navigator.userAgent.slice(0, 200),
    });
  } catch {
    // فشل صامت — لا نعطل تجربة المستخدم
  }
}

export function rememberAttribution(experiment: string, variant: Variant): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${ATTRIBUTION_PREFIX}${experiment}`, variant);
  } catch {
    // تجاهل
  }
}

export function getRememberedAttribution(experiment: string): Variant | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(`${ATTRIBUTION_PREFIX}${experiment}`);
    return value === "A" || value === "B" ? value : null;
  } catch {
    return null;
  }
}
