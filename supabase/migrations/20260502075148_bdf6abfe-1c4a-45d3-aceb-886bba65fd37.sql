CREATE OR REPLACE FUNCTION public.get_subscribers_count()
RETURNS TABLE(total INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base INTEGER;
  _taken INTEGER;
BEGIN
  SELECT COALESCE(founding_base_count, 564) INTO _base
  FROM public.app_settings WHERE id = 1;

  SELECT COUNT(*)::INTEGER INTO _taken
  FROM public.subscription_requests
  WHERE status IN ('activated', 'contacted', 'pending');

  RETURN QUERY SELECT COALESCE(_base, 564) + COALESCE(_taken, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscribers_count() TO authenticated, anon;
