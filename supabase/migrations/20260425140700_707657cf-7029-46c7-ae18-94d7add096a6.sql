DROP TRIGGER IF EXISTS trg_profiles_protect_plan_change ON public.profiles;
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_subscription_requests_reset_credits ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_subscription_requests_sync_profile_plan ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_plan_entitlements_updated_at ON public.plan_entitlements;
DROP TRIGGER IF EXISTS trg_user_credits_updated_at ON public.user_credits;
DROP TRIGGER IF EXISTS trg_video_jobs_processing_limit ON public.video_jobs;
DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON public.video_jobs;