DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_protect_profile_plan_change ON public.profiles;
CREATE TRIGGER trg_protect_profile_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
CREATE TRIGGER update_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
CREATE TRIGGER trg_reset_credits_on_plan_change
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
CREATE TRIGGER trg_sync_profile_plan_on_activation
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;
CREATE TRIGGER trg_notify_admin_on_subscription_request
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();

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

DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;
CREATE TRIGGER trg_lock_topup_from_package
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

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

DROP TRIGGER IF EXISTS trg_enforce_video_processing_limit ON public.video_jobs;
CREATE TRIGGER trg_enforce_video_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
CREATE TRIGGER trg_enforce_generation_integrity
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

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

DROP TRIGGER IF EXISTS update_video_provider_configs_updated_at ON public.video_provider_configs;
CREATE TRIGGER update_video_provider_configs_updated_at
BEFORE UPDATE ON public.video_provider_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();