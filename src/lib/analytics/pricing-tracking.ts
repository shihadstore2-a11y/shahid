/**
 * Pricing Tracking — تسجيل أحداث قمع الأسعار في جدول pricing_experiments.
 * - يعمل للمستخدمين المسجّلين والزوار (مع session_id محلي).
 * - فشل الإدراج صامت (لا يكسر تجربة الشراء).
 */
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics/posthog";

const SESSION_KEY = "rifd_pricing_session";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      window.localStorage.setItem(SESSION_KEY, id);
    } catch {
      /* ignore */
    }
  }
  return id;
}

export type PricingEventType =
  | "page_view"
  | "annual_toggled"
  | "plan_clicked"
  | "cta_clicked"
  | "converted";

export async function trackPricingEvent(
  eventType: PricingEventType,
  payload: {
    planId?: string;
    billingCycle?: "monthly" | "yearly";
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  // PostHog (للتحليلات السريعة)
  track(`pricing_${eventType}`, {
    plan_id: payload.planId,
    billing_cycle: payload.billingCycle,
    ...payload.metadata,
  });

  // Supabase (مصدر الحقيقة للأدمن)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase as unknown as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
      };
    })
      .from("pricing_experiments")
      .insert({
        user_id: user?.id ?? null,
        session_id: getSessionId(),
        event_type: eventType,
        plan_id: payload.planId ?? null,
        billing_cycle: payload.billingCycle ?? null,
        metadata: payload.metadata ?? {},
      });
  } catch {
    /* silent — لا نكسر تجربة الشراء */
  }
}
