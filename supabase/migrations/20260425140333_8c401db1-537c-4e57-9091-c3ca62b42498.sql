CREATE TRIGGER trg_profiles_protect_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

CREATE TRIGGER trg_video_jobs_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

CREATE TRIGGER trg_subscription_requests_sync_profile_plan
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

CREATE TRIGGER trg_subscription_requests_reset_credits
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_video_jobs_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_plan_entitlements_updated_at
BEFORE UPDATE ON public.plan_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.video_jobs
ADD CONSTRAINT video_jobs_duration_seconds_valid
CHECK (duration_seconds IN (5, 8));

ALTER TABLE public.video_jobs
ADD CONSTRAINT video_jobs_aspect_ratio_valid
CHECK (aspect_ratio IN ('9:16', '1:1', '16:9'));

ALTER TABLE public.video_jobs
ADD CONSTRAINT video_jobs_credits_charged_positive
CHECK (credits_charged > 0);