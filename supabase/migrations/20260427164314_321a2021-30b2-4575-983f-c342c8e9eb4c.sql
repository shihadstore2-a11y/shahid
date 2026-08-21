REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_founding_status() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_app_settings() TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_credits_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_entitlement_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.operational_switch_enabled(text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.consume_text_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_image_quota(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_image_daily_quota(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(integer, public.credit_txn_type, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_generation(public.generation_type, text, text, text, text, integer, integer, integer, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_usage(text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.activate_topup_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_usage_logs(text) TO authenticated;

GRANT EXECUTE ON FUNCTION public._ensure_user_credits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_demo_token(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_email_dlq_health() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_stale_subscription_requests() TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_monthly_credits(uuid, public.user_plan) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.operational_switch_enabled(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.plan_entitlement_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_plan_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_credits_on_plan_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_profile_plan_on_activation() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_admin_on_subscription_request() TO service_role;
GRANT EXECUTE ON FUNCTION public.lock_topup_from_package() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_video_processing_limit() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_generation_integrity() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_generation_quota() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_initial_credits() TO service_role;