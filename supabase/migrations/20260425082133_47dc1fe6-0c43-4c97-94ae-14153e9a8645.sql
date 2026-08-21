DROP TRIGGER IF EXISTS enforce_generation_integrity_before_insert ON public.generations;
DROP TRIGGER IF EXISTS enforce_generation_quota_before_insert ON public.generations;
DROP TRIGGER IF EXISTS sync_profile_plan_on_subscription_activation ON public.subscription_requests;
DROP TRIGGER IF EXISTS reset_credits_on_subscription_activation ON public.subscription_requests;
DROP TRIGGER IF EXISTS notify_admin_on_subscription_request_insert ON public.subscription_requests;
DROP TRIGGER IF EXISTS lock_topup_from_package_before_insert ON public.topup_purchases;
DROP TRIGGER IF EXISTS update_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS update_contact_submissions_updated_at ON public.contact_submissions;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS update_topup_packages_updated_at ON public.topup_packages;
DROP TRIGGER IF EXISTS update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;
DROP TRIGGER IF EXISTS update_plan_credits_updated_at ON public.plan_credits;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_action
ON public.admin_audit_log (created_at DESC, action, target_table);