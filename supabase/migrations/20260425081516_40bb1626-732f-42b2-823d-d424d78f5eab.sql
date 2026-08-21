DROP FUNCTION IF EXISTS public.get_user_credits_summary();

CREATE FUNCTION public.get_user_credits_summary()
RETURNS TABLE(
  plan_credits integer,
  topup_credits integer,
  total_credits integer,
  cycle_ends_at timestamp with time zone,
  daily_text_used integer,
  daily_text_cap integer,
  daily_image_used integer,
  daily_image_cap integer,
  daily_video_used integer,
  daily_video_cap integer,
  plan public.user_plan
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(uc.plan_credits, 0),
    COALESCE(uc.topup_credits, 0),
    COALESCE(uc.plan_credits, 0) + COALESCE(uc.topup_credits, 0),
    uc.cycle_ends_at,
    COALESCE(dtu.text_count, 0),
    COALESCE(pc.daily_text_cap, 200),
    COALESCE(dtu.image_count, 0),
    COALESCE(pc.daily_image_cap, 50),
    COALESCE(dvu.video_count, 0),
    public.video_daily_cap_for_plan(COALESCE(p.plan, 'free'::public.user_plan)),
    COALESCE(p.plan, 'free'::public.user_plan)
  FROM (SELECT _uid AS uid) base
  LEFT JOIN public.user_credits uc ON uc.user_id = base.uid
  LEFT JOIN public.profiles p ON p.id = base.uid
  LEFT JOIN public.plan_credits pc ON pc.plan = COALESCE(p.plan, 'free'::public.user_plan)
  LEFT JOIN public.daily_text_usage dtu
    ON dtu.user_id = base.uid
    AND dtu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date
  LEFT JOIN public.daily_video_usage dvu
    ON dvu.user_id = base.uid
    AND dvu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date;
END;
$$;