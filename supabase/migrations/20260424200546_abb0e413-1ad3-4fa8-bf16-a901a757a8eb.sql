-- ============================================================
-- تنظيف triggers مكررة + إزالة الحجب المزدوج
-- ============================================================

-- 1) إزالة الحجب المزدوج (النقاط هي مصدر الحجب الآن)
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;

-- 2) إزالة triggers updated_at القديمة (نُبقي trg_* الجديدة)
DROP TRIGGER IF EXISTS update_daily_text_usage_updated_at ON public.daily_text_usage;
DROP TRIGGER IF EXISTS update_plan_credits_updated_at ON public.plan_credits;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS update_topup_packages_updated_at ON public.topup_packages;
DROP TRIGGER IF EXISTS update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;