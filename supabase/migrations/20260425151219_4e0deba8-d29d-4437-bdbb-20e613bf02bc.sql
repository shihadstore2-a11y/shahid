-- Final trigger normalization for duplicated legacy trigger names.

-- Subscription activation: keep canonical guarded triggers only.
DROP TRIGGER IF EXISTS trg_subscription_requests_reset_credits ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_subscription_requests_sync_profile_plan ON public.subscription_requests;

-- Top-up package lock: keep trg_lock_topup_from_package only.
DROP TRIGGER IF EXISTS trg_topup_purchases_lock_package ON public.topup_purchases;

-- Video processing concurrency: keep trg_enforce_video_processing_limit only.
DROP TRIGGER IF EXISTS trg_video_jobs_processing_limit ON public.video_jobs;

-- Ensure video_jobs updated_at is maintained once.
DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON public.video_jobs;
CREATE TRIGGER trg_video_jobs_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();