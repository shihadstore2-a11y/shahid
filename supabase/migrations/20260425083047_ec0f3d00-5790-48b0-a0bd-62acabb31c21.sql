DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;
DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_update_topup_packages_updated_at ON public.topup_packages;
DROP TRIGGER IF EXISTS trg_update_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS trg_update_contact_submissions_updated_at ON public.contact_submissions;
DROP TRIGGER IF EXISTS trg_update_user_credits_updated_at ON public.user_credits;

CREATE TRIGGER trg_enforce_generation_integrity
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

CREATE TRIGGER trg_enforce_generation_quota
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_quota();

CREATE TRIGGER trg_sync_profile_plan_on_activation
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

CREATE TRIGGER trg_reset_credits_on_plan_change
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

CREATE TRIGGER trg_notify_admin_on_subscription_request
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();

CREATE TRIGGER trg_lock_topup_from_package
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

CREATE TRIGGER trg_update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_topup_purchases_updated_at
BEFORE UPDATE ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_topup_packages_updated_at
BEFORE UPDATE ON public.topup_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_contact_submissions_updated_at
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();