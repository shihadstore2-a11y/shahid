/**
 * Wave C3 — Annual Upgrade Banner
 * يظهر في /dashboard/billing للمشتركين الشهريين بعد 30 يوم من الاشتراك،
 * يعرض خصم 20% للترقية لباقة سنوية، ويُسجَّل في annual_upgrade_offers.
 *
 * RTL · Light/Dark · Mobile/Tablet/Desktop عبر design tokens فقط.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/analytics/posthog";

const DISCOUNT_PCT = 20;
const ELIGIBILITY_DAYS = 30;

export function AnnualUpgradeBanner() {
  const { user, profile } = useAuth();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkEligibility = useCallback(async () => {
    if (!user || !profile) return;
    // فقط المشتركين الشهريين على باقة مدفوعة
    if (profile.plan === "free") return;

    const { data: lastReq } = await supabase
      .from("subscription_requests")
      .select("billing_cycle, activated_at")
      .eq("user_id", user.id)
      .eq("status", "activated")
      .order("activated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastReq || lastReq.billing_cycle !== "monthly" || !lastReq.activated_at) return;

    const ageDays = (Date.now() - new Date(lastReq.activated_at).getTime()) / 86400000;
    if (ageDays < ELIGIBILITY_DAYS) return;

    // فحص: لم يُعرض من قبل
    const { data: existing } = await supabase
      .from("annual_upgrade_offers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) return;

    // أدرج عرضاً جديداً
    await supabase.from("annual_upgrade_offers").insert({
      user_id: user.id,
      discount_pct: DISCOUNT_PCT,
    });
    track("annual_upgrade_shown", { discount_pct: DISCOUNT_PCT });
    setShow(true);
  }, [user, profile]);

  useEffect(() => {
    void checkEligibility();
  }, [checkEligibility]);

  const handleClick = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("annual_upgrade_offers")
      .update({ clicked_at: new Date().toISOString() })
      .eq("user_id", user.id);
    track("annual_upgrade_clicked", { discount_pct: DISCOUNT_PCT });
  }, [user]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    track("annual_upgrade_dismissed");
  }, []);

  if (!show || dismissed) return null;

  return (
    <section
      dir="rtl"
      className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-background p-5 shadow-elegant sm:p-6"
      aria-label={`عرض ترقية سنوية بخصم ${DISCOUNT_PCT}%`}
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute left-3 top-3 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label="إخفاء"
      >
        <X className="size-4" />
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Calendar className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-extrabold text-primary">
            <Sparkles className="size-3" />
            عرض حصري للأعضاء النشطين
          </div>
          <h3 className="mt-2 text-lg font-extrabold sm:text-xl">
            ترقية سنوية بخصم <span className="text-primary">{DISCOUNT_PCT}%</span> — وفّر شهرين كاملين
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            مرّ شهر معك في رِفد. اربط متجرك بسعر الإطلاق لسنة كاملة، واحصل على نقاط فيديو إضافية.
          </p>
        </div>
        <div className="shrink-0">
          <Button asChild size="lg" onClick={handleClick}>
            <Link to="/pricing" search={{ ref: "annual-upgrade" }}>
              فعّل خصم {DISCOUNT_PCT}%
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
