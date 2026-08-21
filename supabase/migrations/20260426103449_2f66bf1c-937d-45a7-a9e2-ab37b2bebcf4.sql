DROP FUNCTION IF EXISTS public.consume_video_daily_quota(text, integer);
DROP FUNCTION IF EXISTS public.release_video_daily_quota(uuid);
DROP FUNCTION IF EXISTS public.video_daily_cap_for_plan(public.user_plan);

UPDATE public.plan_entitlements
SET daily_video_cap = 0,
    updated_at = now()
WHERE daily_video_cap IS DISTINCT FROM 0;

CREATE OR REPLACE FUNCTION public.get_user_credits_summary()
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
  plan public.user_plan,
  image_pro_allowed boolean,
  video_fast_allowed boolean,
  video_quality_allowed boolean,
  max_video_duration_seconds integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
    COALESCE(pe.daily_text_cap, 10),
    COALESCE(dtu.image_count, 0),
    COALESCE(pe.daily_image_cap, 2),
    0::integer,
    0::integer,
    COALESCE(p.plan, 'free'::public.user_plan),
    COALESCE(pe.image_pro_allowed, false),
    COALESCE(pe.video_fast_allowed, false),
    COALESCE(pe.video_quality_allowed, false),
    COALESCE(pe.max_video_duration_seconds, 5)
  FROM (SELECT _uid AS uid) base
  LEFT JOIN public.user_credits uc ON uc.user_id = base.uid
  LEFT JOIN public.profiles p ON p.id = base.uid
  LEFT JOIN public.plan_entitlements pe ON pe.plan = COALESCE(p.plan, 'free'::public.user_plan) AND pe.active = true
  LEFT JOIN public.daily_text_usage dtu ON dtu.user_id = base.uid AND dtu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date;
END;
$$;