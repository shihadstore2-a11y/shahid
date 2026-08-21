CREATE OR REPLACE FUNCTION public.consume_image_quota()
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  IF _plan IS NULL THEN _plan := 'free'; END IF;

  SELECT daily_image_cap INTO _cap FROM public.plan_credits WHERE plan = _plan;
  IF _cap IS NULL THEN _cap := 50; END IF;

  INSERT INTO public.daily_text_usage (user_id, day, image_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET image_count = public.daily_text_usage.image_count + 1,
        updated_at = now()
  RETURNING image_count INTO _new_count;

  IF _new_count > _cap THEN
    UPDATE public.daily_text_usage
    SET image_count = image_count - 1, updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_credits(_amount integer, _txn_type credit_txn_type, _reference_id uuid DEFAULT NULL::uuid, _reference_type text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(ledger_id uuid, remaining_plan integer, remaining_topup integer, remaining_total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.user_credits;
  _from_plan integer := 0;
  _from_topup integer := 0;
  _new_ledger_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF _txn_type <> 'consume_video' THEN
    RAISE EXCEPTION 'video_credits_only';
  END IF;

  PERFORM public._ensure_user_credits(_uid);

  SELECT * INTO _row
  FROM public.user_credits
  WHERE user_id = _uid
  FOR UPDATE;

  IF (_row.plan_credits + _row.topup_credits) < _amount THEN
    RAISE EXCEPTION 'insufficient_credits: required=% available=%',
      _amount, (_row.plan_credits + _row.topup_credits)
      USING ERRCODE = 'check_violation';
  END IF;

  IF _row.plan_credits >= _amount THEN
    _from_plan := _amount;
    _from_topup := 0;
  ELSE
    _from_plan := _row.plan_credits;
    _from_topup := _amount - _from_plan;
  END IF;

  UPDATE public.user_credits
  SET plan_credits = plan_credits - _from_plan,
      topup_credits = topup_credits - _from_topup,
      updated_at = now()
  WHERE user_id = _uid
  RETURNING * INTO _row;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _uid, _txn_type, -_amount,
    CASE WHEN _from_topup = 0 THEN 'plan'::credit_source
         WHEN _from_plan = 0 THEN 'topup'::credit_source
         ELSE 'plan'::credit_source END,
    _row.plan_credits, _row.topup_credits,
    _reference_id, _reference_type,
    _metadata || jsonb_build_object('from_plan', _from_plan, 'from_topup', _from_topup, 'credit_scope', 'video')
  ) RETURNING id INTO _new_ledger_id;

  RETURN QUERY SELECT
    _new_ledger_id,
    _row.plan_credits,
    _row.topup_credits,
    (_row.plan_credits + _row.topup_credits);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_credits_summary()
RETURNS TABLE(plan_credits integer, topup_credits integer, total_credits integer, cycle_ends_at timestamp with time zone, daily_text_used integer, daily_text_cap integer, daily_image_used integer, daily_image_cap integer, plan user_plan)
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
    COALESCE(pc.daily_text_cap, 200),
    COALESCE(dtu.image_count, 0),
    COALESCE(pc.daily_image_cap, 50),
    COALESCE(p.plan, 'free'::user_plan)
  FROM (SELECT _uid AS uid) base
  LEFT JOIN public.user_credits uc ON uc.user_id = base.uid
  LEFT JOIN public.profiles p ON p.id = base.uid
  LEFT JOIN public.plan_credits pc ON pc.plan = COALESCE(p.plan, 'free'::user_plan)
  LEFT JOIN public.daily_text_usage dtu
    ON dtu.user_id = base.uid
    AND dtu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_initial_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _credits integer;
BEGIN
  SELECT monthly_credits INTO _credits
  FROM public.plan_credits WHERE plan = COALESCE(NEW.plan, 'free'::user_plan);

  IF _credits IS NULL THEN _credits := 150; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup, metadata
  ) VALUES (
    NEW.id, 'plan_grant', _credits, 'plan',
    _credits, 0,
    jsonb_build_object('reason', 'initial_signup', 'plan', NEW.plan, 'credit_scope', 'video')
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _credits integer;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  IF LOWER(NEW.email) = 'saalla012@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  SELECT monthly_credits INTO _credits FROM public.plan_credits WHERE plan = 'free'::user_plan;
  IF _credits IS NULL THEN _credits := 150; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup, metadata
  ) VALUES (
    NEW.id, 'plan_grant', _credits, 'plan',
    _credits, 0,
    jsonb_build_object('reason','initial_signup','plan','free','credit_scope','video')
  );

  RETURN NEW;
END;
$$;