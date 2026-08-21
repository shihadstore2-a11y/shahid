DROP TRIGGER IF EXISTS trg_update_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS trg_update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_subscription_requests_sync_plan ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_update_topup_purchases_updated_at ON public.topup_purchases;