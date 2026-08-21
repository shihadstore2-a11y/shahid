REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION public.get_founding_status() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_app_settings() TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_topup_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_usage(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(integer, public.credit_txn_type, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_image_quota(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_text_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_credits_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.operational_switch_enabled(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_entitlement_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_usage_logs(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_generation(public.generation_type, text, text, text, text, integer, integer, integer, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_image_daily_quota(uuid) TO authenticated;