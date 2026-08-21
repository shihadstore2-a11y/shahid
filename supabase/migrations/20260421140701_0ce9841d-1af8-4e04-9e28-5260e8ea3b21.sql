CREATE OR REPLACE FUNCTION public.get_founding_status()
RETURNS TABLE (
  current_subscribers integer,
  seats_total integer,
  seats_left integer,
  discount_pct integer,
  program_active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base int;
  _total int;
  _disc int;
  _active boolean;
  _taken int;
BEGIN
  SELECT founding_base_count, founding_total_seats, founding_discount_pct, founding_program_active
    INTO _base, _total, _disc, _active
  FROM public.app_settings WHERE id = 1;

  SELECT COUNT(*)::int INTO _taken
  FROM public.subscription_requests
  WHERE status IN ('activated','contacted','pending');

  RETURN QUERY SELECT
    COALESCE(_base, 0) + COALESCE(_taken, 0) AS current_subscribers,
    COALESCE(_total, 1000)                   AS seats_total,
    GREATEST(0, COALESCE(_total, 1000) - (COALESCE(_base, 0) + COALESCE(_taken, 0))) AS seats_left,
    COALESCE(_disc, 30)                      AS discount_pct,
    COALESCE(_active, true)                  AS program_active;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_founding_status() TO anon, authenticated;