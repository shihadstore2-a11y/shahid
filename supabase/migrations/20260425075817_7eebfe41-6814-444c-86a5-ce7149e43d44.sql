-- Enable required triggers for existing production functions.
-- Idempotent: safe to run even if some triggers already exist.

-- New user bootstrap: profile, role, and initial credits.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Automatic updated_at maintenance for mutable public tables.
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
CREATE TRIGGER update_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_contact_submissions_updated_at ON public.contact_submissions;
CREATE TRIGGER update_contact_submissions_updated_at
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;
CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_plan_credits_updated_at ON public.plan_credits;
CREATE TRIGGER update_plan_credits_updated_at
BEFORE UPDATE ON public.plan_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_settings_updated_at ON public.payment_settings;
CREATE TRIGGER update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_topup_packages_updated_at ON public.topup_packages;
CREATE TRIGGER update_topup_packages_updated_at
BEFORE UPDATE ON public.topup_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_topup_purchases_updated_at ON public.topup_purchases;
CREATE TRIGGER update_topup_purchases_updated_at
BEFORE UPDATE ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_packs_updated_at ON public.campaign_packs;
CREATE TRIGGER update_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_video_jobs_updated_at ON public.video_jobs;
CREATE TRIGGER update_video_jobs_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_send_state_updated_at ON public.email_send_state;
CREATE TRIGGER update_email_send_state_updated_at
BEFORE UPDATE ON public.email_send_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_dlq_alert_state_updated_at ON public.dlq_alert_state;
CREATE TRIGGER update_dlq_alert_state_updated_at
BEFORE UPDATE ON public.dlq_alert_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_stale_subs_alert_state_updated_at ON public.stale_subs_alert_state;
CREATE TRIGGER update_stale_subs_alert_state_updated_at
BEFORE UPDATE ON public.stale_subs_alert_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Top-up integrity: lock credits and price from package, force pending ownership.
DROP TRIGGER IF EXISTS lock_topup_from_package_before_insert ON public.topup_purchases;
CREATE TRIGGER lock_topup_from_package_before_insert
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

-- Generation protection and quota enforcement.
DROP TRIGGER IF EXISTS enforce_generation_integrity_before_insert ON public.generations;
CREATE TRIGGER enforce_generation_integrity_before_insert
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

DROP TRIGGER IF EXISTS enforce_generation_quota_before_insert ON public.generations;
CREATE TRIGGER enforce_generation_quota_before_insert
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_quota();

-- Subscription activation side effects.
DROP TRIGGER IF EXISTS sync_profile_plan_on_subscription_activation ON public.subscription_requests;
CREATE TRIGGER sync_profile_plan_on_subscription_activation
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

DROP TRIGGER IF EXISTS reset_credits_on_subscription_activation ON public.subscription_requests;
CREATE TRIGGER reset_credits_on_subscription_activation
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

-- Operational notification for new subscription requests.
DROP TRIGGER IF EXISTS notify_admin_on_subscription_request_insert ON public.subscription_requests;
CREATE TRIGGER notify_admin_on_subscription_request_insert
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();