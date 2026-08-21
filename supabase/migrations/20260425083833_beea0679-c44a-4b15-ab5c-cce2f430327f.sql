-- Remove legacy or duplicate public triggers before creating the canonical set
DROP TRIGGER IF EXISTS enforce_generation_integrity_before_insert ON public.generations;
DROP TRIGGER IF EXISTS enforce_generation_quota_before_insert ON public.generations;
DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;

DROP TRIGGER IF EXISTS sync_profile_plan_on_subscription_activation ON public.subscription_requests;
DROP TRIGGER IF EXISTS reset_credits_on_subscription_activation ON public.subscription_requests;
DROP TRIGGER IF EXISTS notify_admin_on_subscription_request_insert ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;

DROP TRIGGER IF EXISTS lock_topup_from_package_before_insert ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;

DROP TRIGGER IF EXISTS update_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS update_contact_submissions_updated_at ON public.contact_submissions;
DROP TRIGGER IF EXISTS update_daily_video_usage_updated_at ON public.daily_video_usage;
DROP TRIGGER IF EXISTS update_payment_settings_updated_at ON public.payment_settings;
DROP TRIGGER IF EXISTS update_plan_credits_updated_at ON public.plan_credits;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS update_topup_packages_updated_at ON public.topup_packages;
DROP TRIGGER IF EXISTS update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;
DROP TRIGGER IF EXISTS trg_update_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS trg_update_contact_submissions_updated_at ON public.contact_submissions;
DROP TRIGGER IF EXISTS trg_update_daily_video_usage_updated_at ON public.daily_video_usage;
DROP TRIGGER IF EXISTS trg_update_payment_settings_updated_at ON public.payment_settings;
DROP TRIGGER IF EXISTS trg_update_plan_credits_updated_at ON public.plan_credits;
DROP TRIGGER IF EXISTS trg_update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_update_topup_packages_updated_at ON public.topup_packages;
DROP TRIGGER IF EXISTS trg_update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_update_user_credits_updated_at ON public.user_credits;

-- Generation protection and quota enforcement
CREATE TRIGGER trg_enforce_generation_integrity
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

CREATE TRIGGER trg_enforce_generation_quota
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_quota();

-- Subscription activation automation
CREATE TRIGGER trg_sync_profile_plan_on_activation
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

CREATE TRIGGER trg_reset_credits_on_plan_change
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

CREATE TRIGGER trg_notify_admin_on_subscription_request
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();

-- Top-up package locking before user purchase is stored
CREATE TRIGGER trg_lock_topup_from_package
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

-- Canonical updated_at triggers on public operational tables
CREATE TRIGGER trg_update_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_contact_submissions_updated_at
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_daily_video_usage_updated_at
BEFORE UPDATE ON public.daily_video_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_plan_credits_updated_at
BEFORE UPDATE ON public.plan_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_topup_packages_updated_at
BEFORE UPDATE ON public.topup_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_topup_purchases_updated_at
BEFORE UPDATE ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();