DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_profiles_protect_plan_change ON public.profiles;
DROP TRIGGER IF EXISTS trg_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_subscription_requests_sync_profile_plan ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_subscription_requests_reset_credits ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON public.video_jobs;
DROP TRIGGER IF EXISTS trg_video_jobs_processing_limit ON public.video_jobs;
DROP TRIGGER IF EXISTS trg_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS trg_generations_integrity ON public.generations;
DROP TRIGGER IF EXISTS trg_generations_quota ON public.generations;
DROP TRIGGER IF EXISTS trg_topup_purchases_lock_package ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_topup_purchases_updated_at ON public.topup_purchases;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_profiles_protect_plan_change
BEFORE UPDATE OF plan ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

CREATE TRIGGER trg_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_subscription_requests_sync_profile_plan
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

CREATE TRIGGER trg_subscription_requests_reset_credits
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

CREATE TRIGGER trg_video_jobs_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_video_jobs_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

CREATE TRIGGER trg_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_generations_integrity
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

CREATE TRIGGER trg_generations_quota
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_quota();

CREATE TRIGGER trg_topup_purchases_lock_package
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

CREATE TRIGGER trg_topup_purchases_updated_at
BEFORE UPDATE ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();