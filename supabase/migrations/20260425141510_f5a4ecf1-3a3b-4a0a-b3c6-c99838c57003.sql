DROP TRIGGER IF EXISTS trg_protect_profile_plan_change ON public.profiles;

DROP TRIGGER IF EXISTS trg_update_daily_text_usage_updated_at ON public.daily_text_usage;
DROP TRIGGER IF EXISTS trg_update_daily_video_usage_updated_at ON public.daily_video_usage;
DROP TRIGGER IF EXISTS trg_update_subscription_requests_updated_at ON public.subscription_requests;

DROP TRIGGER IF EXISTS trg_enforce_video_processing_limit ON public.video_jobs;
DROP TRIGGER IF EXISTS update_video_jobs_updated_at ON public.video_jobs;