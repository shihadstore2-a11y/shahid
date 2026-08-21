-- Normalize public triggers after reconnecting operational automation.
-- Keep one canonical trigger per invariant and remove old duplicate names.

-- Remove legacy monthly generation quota trigger variants.
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;
DROP TRIGGER IF EXISTS trg_generations_quota ON public.generations;

-- Remove duplicate generation integrity variant; keep trg_enforce_generation_integrity.
DROP TRIGGER IF EXISTS trg_generations_integrity ON public.generations;

-- Remove duplicate profile plan guard variant; keep trg_protect_profile_plan_change.
DROP TRIGGER IF EXISTS trg_profiles_protect_plan_change ON public.profiles;

-- Remove duplicate updated_at trigger variants where canonical trg_<table>_updated_at exists.
DROP TRIGGER IF EXISTS trg_update_app_settings_updated_at ON public.app_settings;
DROP TRIGGER IF EXISTS trg_update_payment_settings_updated_at ON public.payment_settings;
DROP TRIGGER IF EXISTS trg_update_plan_credits_updated_at ON public.plan_credits;
DROP TRIGGER IF EXISTS trg_update_plan_entitlements_updated_at ON public.plan_entitlements;
DROP TRIGGER IF EXISTS trg_update_plan_limits_updated_at ON public.plan_limits;
DROP TRIGGER IF EXISTS trg_update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON public.video_jobs;
DROP TRIGGER IF EXISTS trg_update_video_jobs_updated_at ON public.video_jobs;

-- Keep existing distinct table triggers that do not overlap with the newly canonical ones.
-- Examples: contact_submissions, daily_text_usage, daily_video_usage may already use older names and are left intact unless duplicated later.