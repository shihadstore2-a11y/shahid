CREATE TABLE IF NOT EXISTS public.daily_video_usage (
  user_id uuid NOT NULL,
  day date NOT NULL,
  video_count integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.daily_video_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own daily video usage" ON public.daily_video_usage;
CREATE POLICY "Users view own daily video usage"
ON public.daily_video_usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all daily video usage" ON public.daily_video_usage;
CREATE POLICY "Admins view all daily video usage"
ON public.daily_video_usage
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_daily_video_usage_updated_at ON public.daily_video_usage;
CREATE TRIGGER update_daily_video_usage_updated_at
BEFORE UPDATE ON public.daily_video_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.video_daily_cap_for_plan(_plan public.user_plan)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'business'::public.user_plan THEN 20
    WHEN 'pro'::public.user_plan THEN 12
    WHEN 'growth'::public.user_plan THEN 6
    WHEN 'starter'::public.user_plan THEN 3
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.consume_video_daily_quota()
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _plan public.user_plan;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT plan INTO _plan FROM public.profiles WHERE id = _uid;
  IF _plan IS NULL THEN _plan := 'free'::public.user_plan; END IF;

  SELECT public.video_daily_cap_for_plan(_plan) INTO _cap;
  IF _cap IS NULL THEN _cap := 1; END IF;

  INSERT INTO public.daily_video_usage (user_id, day, video_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET video_count = public.daily_video_usage.video_count + 1,
        updated_at = now()
  RETURNING video_count INTO _new_count;

  IF _new_count > _cap THEN
    UPDATE public.daily_video_usage
    SET video_count = GREATEST(video_count - 1, 0), updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_video_daily_quota(_user_id uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := COALESCE(_user_id, auth.uid());
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  UPDATE public.daily_video_usage
  SET video_count = GREATEST(video_count - 1, 0), updated_at = now()
  WHERE user_id = _uid AND day = _today AND video_count > 0;
END;
$$;