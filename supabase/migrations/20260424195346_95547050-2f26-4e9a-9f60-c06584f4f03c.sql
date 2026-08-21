-- (1) handle_new_user — منح النقاط الأولية atomically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  IF _credits IS NULL THEN _credits := 50; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup, metadata
  ) VALUES (
    NEW.id, 'plan_grant', _credits, 'plan',
    _credits, 0,
    jsonb_build_object('reason','initial_signup','plan','free')
  );

  RETURN NEW;
END;
$$;

-- (2) Triggers على subscription_requests
DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
CREATE TRIGGER trg_sync_profile_plan_on_activation
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
CREATE TRIGGER trg_reset_credits_on_plan_change
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

-- (3) إغلاق الدوال الإدارية
REVOKE EXECUTE ON FUNCTION public.activate_topup_purchase(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_monthly_credits(uuid, public.user_plan) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, text) FROM PUBLIC, anon, authenticated;

-- (4) Trigger يقفل credits/price من topup_packages
CREATE OR REPLACE FUNCTION public.lock_topup_from_package()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pkg public.topup_packages;
BEGIN
  SELECT * INTO _pkg FROM public.topup_packages
  WHERE id = NEW.package_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'package_not_found_or_inactive: %', NEW.package_id;
  END IF;

  NEW.credits   := _pkg.credits;
  NEW.price_sar := _pkg.price_sar;

  IF auth.uid() IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    NEW.user_id := auth.uid();
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending'::topup_status THEN
    NEW.status := 'pending'::topup_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;
CREATE TRIGGER trg_lock_topup_from_package
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

-- (5) Index على refund_ledger_id
CREATE INDEX IF NOT EXISTS idx_credit_ledger_refund
ON public.credit_ledger (refund_ledger_id)
WHERE refund_ledger_id IS NOT NULL;

-- (6) get_user_credits_summary مع daily_image_used (DROP أولاً لتغيير return type)
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
  plan public.user_plan
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

-- (7) refund_credits — تأكيد ownership صريح + دعم service_role
CREATE OR REPLACE FUNCTION public.refund_credits(_ledger_id uuid, _reason text DEFAULT 'generation_failed')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _orig public.credit_ledger;
  _uid uuid := auth.uid();
  _is_service boolean := (auth.role() = 'service_role');
  _from_plan integer;
  _from_topup integer;
  _refund_amount integer;
  _row public.user_credits;
  _refund_id uuid;
BEGIN
  IF _uid IS NULL AND NOT _is_service THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT * INTO _orig FROM public.credit_ledger WHERE id = _ledger_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ledger_not_found'; END IF;

  IF NOT _is_service AND _orig.user_id IS DISTINCT FROM _uid THEN
    RAISE EXCEPTION 'forbidden_not_owner';
  END IF;

  IF _orig.refunded_at IS NOT NULL THEN RAISE EXCEPTION 'already_refunded'; END IF;
  IF _orig.txn_type NOT IN ('consume_image','consume_video') THEN
    RAISE EXCEPTION 'not_refundable';
  END IF;

  _refund_amount := -_orig.amount;
  _from_plan := COALESCE((_orig.metadata->>'from_plan')::integer, _refund_amount);
  _from_topup := COALESCE((_orig.metadata->>'from_topup')::integer, 0);

  PERFORM public._ensure_user_credits(_orig.user_id);

  UPDATE public.user_credits
  SET plan_credits = plan_credits + _from_plan,
      topup_credits = topup_credits + _from_topup,
      updated_at = now()
  WHERE user_id = _orig.user_id
  RETURNING * INTO _row;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _orig.user_id, 'refund', _refund_amount, _orig.source,
    _row.plan_credits, _row.topup_credits,
    _orig.reference_id, _orig.reference_type,
    jsonb_build_object('reason', _reason, 'original_ledger_id', _ledger_id,
                       'restored_plan', _from_plan, 'restored_topup', _from_topup,
                       'refunded_by', COALESCE(_uid::text, 'service_role'))
  ) RETURNING id INTO _refund_id;

  UPDATE public.credit_ledger
  SET refunded_at = now(), refund_ledger_id = _refund_id
  WHERE id = _ledger_id;

  RETURN _refund_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, text) FROM PUBLIC, anon, authenticated;