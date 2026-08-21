DROP FUNCTION IF EXISTS public.get_user_credits_summary();
DROP FUNCTION IF EXISTS public.consume_image_quota();
DROP FUNCTION IF EXISTS public.consume_video_daily_quota();

CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  plan public.user_plan PRIMARY KEY,
  monthly_price_sar integer NOT NULL DEFAULT 0,
  yearly_price_sar integer NOT NULL DEFAULT 0,
  monthly_credits integer NOT NULL DEFAULT 0,
  daily_text_cap integer NOT NULL DEFAULT 20,
  daily_image_cap integer NOT NULL DEFAULT 2,
  daily_video_cap integer NOT NULL DEFAULT 0,
  image_pro_allowed boolean NOT NULL DEFAULT false,
  video_fast_allowed boolean NOT NULL DEFAULT true,
  video_quality_allowed boolean NOT NULL DEFAULT false,
  max_video_duration_seconds integer NOT NULL DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plan entitlements readable by everyone" ON public.plan_entitlements;
CREATE POLICY "Plan entitlements readable by everyone"
ON public.plan_entitlements
FOR SELECT
USING (active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage plan entitlements" ON public.plan_entitlements;
CREATE POLICY "Admins manage plan entitlements"
ON public.plan_entitlements
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_update_plan_entitlements_updated_at ON public.plan_entitlements;
CREATE TRIGGER trg_update_plan_entitlements_updated_at
BEFORE UPDATE ON public.plan_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plan_entitlements (
  plan, monthly_price_sar, yearly_price_sar, monthly_credits,
  daily_text_cap, daily_image_cap, daily_video_cap,
  image_pro_allowed, video_fast_allowed, video_quality_allowed,
  max_video_duration_seconds, active
)
VALUES
  ('free'::public.user_plan, 0, 0, 0, 10, 2, 0, false, false, false, 5, true),
  ('starter'::public.user_plan, 149, 1490, 1500, 100, 20, 3, false, true, false, 5, true),
  ('growth'::public.user_plan, 249, 2490, 5000, 250, 50, 6, true, true, true, 8, true),
  ('pro'::public.user_plan, 399, 3990, 11000, 600, 100, 12, true, true, true, 8, true),
  ('business'::public.user_plan, 999, 9990, 30000, 1000, 150, 20, true, true, true, 8, true)
ON CONFLICT (plan) DO UPDATE
SET monthly_price_sar = EXCLUDED.monthly_price_sar,
    yearly_price_sar = EXCLUDED.yearly_price_sar,
    monthly_credits = EXCLUDED.monthly_credits,
    daily_text_cap = EXCLUDED.daily_text_cap,
    daily_image_cap = EXCLUDED.daily_image_cap,
    daily_video_cap = EXCLUDED.daily_video_cap,
    image_pro_allowed = EXCLUDED.image_pro_allowed,
    video_fast_allowed = EXCLUDED.video_fast_allowed,
    video_quality_allowed = EXCLUDED.video_quality_allowed,
    max_video_duration_seconds = EXCLUDED.max_video_duration_seconds,
    active = EXCLUDED.active,
    updated_at = now();

INSERT INTO public.plan_credits (plan, monthly_credits, daily_text_cap, daily_image_cap)
SELECT plan, monthly_credits, daily_text_cap, daily_image_cap
FROM public.plan_entitlements
ON CONFLICT (plan) DO UPDATE
SET monthly_credits = EXCLUDED.monthly_credits,
    daily_text_cap = EXCLUDED.daily_text_cap,
    daily_image_cap = EXCLUDED.daily_image_cap,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.plan_entitlement_for_user(_user_id uuid DEFAULT auth.uid())
RETURNS public.plan_entitlements
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _uid uuid := COALESCE(_user_id, auth.uid());
  _plan public.user_plan;
  _ent public.plan_entitlements;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  IF auth.role() <> 'service_role'
     AND _uid IS DISTINCT FROM _caller
     AND NOT public.has_role(_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden_not_owner';
  END IF;

  SELECT plan INTO _plan FROM public.profiles WHERE id = _uid;
  IF _plan IS NULL THEN _plan := 'free'::public.user_plan; END IF;

  SELECT * INTO _ent FROM public.plan_entitlements WHERE plan = _plan AND active = true;
  IF NOT FOUND THEN SELECT * INTO _ent FROM public.plan_entitlements WHERE plan = 'free'::public.user_plan; END IF;
  RETURN _ent;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_text_quota()
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);
  _cap := COALESCE(_ent.daily_text_cap, 10);

  INSERT INTO public.daily_text_usage (user_id, day, text_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET text_count = public.daily_text_usage.text_count + 1,
        updated_at = now()
  RETURNING text_count INTO _new_count;

  IF _new_count > _cap THEN
    UPDATE public.daily_text_usage SET text_count = GREATEST(text_count - 1, 0), updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_image_quota(_quality text DEFAULT 'flash')
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _quality NOT IN ('flash', 'pro') THEN RAISE EXCEPTION 'invalid_image_quality'; END IF;

  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);
  IF _quality = 'pro' AND COALESCE(_ent.image_pro_allowed, false) = false THEN
    RAISE EXCEPTION 'image_pro_not_allowed';
  END IF;

  _cap := COALESCE(_ent.daily_image_cap, 2);

  INSERT INTO public.daily_text_usage (user_id, day, image_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET image_count = public.daily_text_usage.image_count + 1,
        updated_at = now()
  RETURNING image_count INTO _new_count;

  IF _new_count > _cap THEN
    UPDATE public.daily_text_usage SET image_count = GREATEST(image_count - 1, 0), updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.video_daily_cap_for_plan(_plan public.user_plan)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT daily_video_cap FROM public.plan_entitlements WHERE plan = _plan AND active = true), 0)
$$;

CREATE OR REPLACE FUNCTION public.consume_video_daily_quota(_quality text DEFAULT 'fast', _duration_seconds integer DEFAULT 5)
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _quality NOT IN ('fast', 'quality') THEN RAISE EXCEPTION 'invalid_video_quality'; END IF;
  IF _duration_seconds NOT IN (5, 8) THEN RAISE EXCEPTION 'invalid_video_duration'; END IF;

  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);
  IF _quality = 'fast' AND COALESCE(_ent.video_fast_allowed, false) = false THEN RAISE EXCEPTION 'video_fast_not_allowed'; END IF;
  IF _quality = 'quality' AND COALESCE(_ent.video_quality_allowed, false) = false THEN RAISE EXCEPTION 'video_quality_not_allowed'; END IF;
  IF _duration_seconds > COALESCE(_ent.max_video_duration_seconds, 5) THEN RAISE EXCEPTION 'video_duration_not_allowed'; END IF;

  _cap := COALESCE(_ent.daily_video_cap, 0);

  INSERT INTO public.daily_video_usage (user_id, day, video_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET video_count = public.daily_video_usage.video_count + 1,
        updated_at = now()
  RETURNING video_count INTO _new_count;

  IF _new_count > _cap THEN
    UPDATE public.daily_video_usage SET video_count = GREATEST(video_count - 1, 0), updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

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
STABLE
SECURITY DEFINER
SET search_path = public
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
    COALESCE(dvu.video_count, 0),
    COALESCE(pe.daily_video_cap, 0),
    COALESCE(p.plan, 'free'::public.user_plan),
    COALESCE(pe.image_pro_allowed, false),
    COALESCE(pe.video_fast_allowed, false),
    COALESCE(pe.video_quality_allowed, false),
    COALESCE(pe.max_video_duration_seconds, 5)
  FROM (SELECT _uid AS uid) base
  LEFT JOIN public.user_credits uc ON uc.user_id = base.uid
  LEFT JOIN public.profiles p ON p.id = base.uid
  LEFT JOIN public.plan_entitlements pe ON pe.plan = COALESCE(p.plan, 'free'::public.user_plan) AND pe.active = true
  LEFT JOIN public.daily_text_usage dtu ON dtu.user_id = base.uid AND dtu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date
  LEFT JOIN public.daily_video_usage dvu ON dvu.user_id = base.uid AND dvu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_monthly_credits(_user_id uuid, _plan public.user_plan)
RETURNS public.user_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _new_credits integer;
  _row public.user_credits;
  _old_plan_credits integer;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role) INTO _is_admin;
  IF NOT _is_admin AND auth.role() <> 'service_role' THEN RAISE EXCEPTION 'admin_only'; END IF;

  SELECT monthly_credits INTO _new_credits FROM public.plan_entitlements WHERE plan = _plan AND active = true;
  IF _new_credits IS NULL THEN SELECT monthly_credits INTO _new_credits FROM public.plan_credits WHERE plan = _plan; END IF;
  IF _new_credits IS NULL THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  PERFORM public._ensure_user_credits(_user_id);

  SELECT plan_credits INTO _old_plan_credits FROM public.user_credits WHERE user_id = _user_id FOR UPDATE;

  IF _old_plan_credits > 0 THEN
    INSERT INTO public.credit_ledger (user_id, txn_type, amount, source, balance_after_plan, balance_after_topup, metadata)
    SELECT _user_id, 'expire', -_old_plan_credits, 'plan', 0, topup_credits, jsonb_build_object('reason', 'monthly_reset')
    FROM public.user_credits WHERE user_id = _user_id;
  END IF;

  UPDATE public.user_credits
  SET plan_credits = _new_credits,
      cycle_started_at = now(),
      cycle_ends_at = now() + interval '30 days',
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING * INTO _row;

  INSERT INTO public.credit_ledger (user_id, txn_type, amount, source, balance_after_plan, balance_after_topup, metadata)
  VALUES (_user_id, 'plan_grant', _new_credits, 'plan', _row.plan_credits, _row.topup_credits, jsonb_build_object('plan', _plan, 'source', 'plan_entitlements'));

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.plan_entitlement_for_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_image_quota(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_video_daily_quota(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_credits_summary() TO authenticated;