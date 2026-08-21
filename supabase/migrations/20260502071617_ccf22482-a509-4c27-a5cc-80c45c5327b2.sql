REVOKE EXECUTE ON FUNCTION public.get_or_create_current_monthly_cycle(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_free_monthly_video_quota() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_free_monthly_video_usage() FROM anon, public;