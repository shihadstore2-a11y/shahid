-- Reconnect operational triggers that already have vetted functions.
-- Scope: public schema only. No reserved auth/storage/realtime schema changes.

-- Timestamp triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_subscription_requests_updated_at ON public.subscription_requests;
CREATE TRIGGER trg_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_topup_purchases_updated_at ON public.topup_purchases;
CREATE TRIGGER trg_topup_purchases_updated_at
BEFORE UPDATE ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_campaign_packs_updated_at ON public.campaign_packs;
CREATE TRIGGER trg_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payment_settings_updated_at ON public.payment_settings;
CREATE TRIGGER trg_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_plan_credits_updated_at ON public.plan_credits;
CREATE TRIGGER trg_plan_credits_updated_at
BEFORE UPDATE ON public.plan_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_plan_entitlements_updated_at ON public.plan_entitlements;
CREATE TRIGGER trg_plan_entitlements_updated_at
BEFORE UPDATE ON public.plan_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_plan_limits_updated_at ON public.plan_limits;
CREATE TRIGGER trg_plan_limits_updated_at
BEFORE UPDATE ON public.plan_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_email_send_state_updated_at ON public.email_send_state;
CREATE TRIGGER trg_email_send_state_updated_at
BEFORE UPDATE ON public.email_send_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_dlq_alert_state_updated_at ON public.dlq_alert_state;
CREATE TRIGGER trg_dlq_alert_state_updated_at
BEFORE UPDATE ON public.dlq_alert_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_stale_subs_alert_state_updated_at ON public.stale_subs_alert_state;
CREATE TRIGGER trg_stale_subs_alert_state_updated_at
BEFORE UPDATE ON public.stale_subs_alert_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Security and business invariants
DROP TRIGGER IF EXISTS trg_protect_profile_plan_change ON public.profiles;
CREATE TRIGGER trg_protect_profile_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;
CREATE TRIGGER trg_lock_topup_from_package
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
CREATE TRIGGER trg_enforce_generation_integrity
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

-- Keep legacy monthly generation quota disconnected from direct inserts.
-- Modern quotas are consumed explicitly by server functions before record_generation.
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;

DROP TRIGGER IF EXISTS trg_enforce_video_processing_limit ON public.video_jobs;
CREATE TRIGGER trg_enforce_video_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

-- Subscription activation automation
DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
CREATE TRIGGER trg_sync_profile_plan_on_activation
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
WHEN (NEW.status = 'activated'::public.subscription_request_status AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
CREATE TRIGGER trg_reset_credits_on_plan_change
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
WHEN (NEW.status = 'activated'::public.subscription_request_status AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.reset_credits_on_plan_change();

DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;
CREATE TRIGGER trg_notify_admin_on_subscription_request
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();