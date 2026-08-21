CREATE OR REPLACE FUNCTION public.grant_compensation_credits(
  _user_id uuid,
  _amount integer,
  _reason text,
  _reference_id uuid DEFAULT NULL,
  _reference_type text DEFAULT 'video_job'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.user_credits;
  _ledger_id uuid;
BEGIN
  -- service_role only (called from server code)
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'service_role_only';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 500 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  -- Idempotency: skip if compensation already granted for this reference
  IF _reference_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.credit_ledger
      WHERE reference_id = _reference_id
        AND txn_type = 'plan_grant'
        AND metadata->>'compensation_for' IS NOT NULL
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  PERFORM public._ensure_user_credits(_user_id);

  UPDATE public.user_credits
  SET plan_credits = plan_credits + _amount,
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING * INTO _row;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _user_id, 'plan_grant', _amount, 'plan',
    _row.plan_credits, _row.topup_credits,
    _reference_id, _reference_type,
    jsonb_build_object(
      'compensation_for', _reason,
      'granted_by', 'system_auto_compensation',
      'granted_at', now()
    )
  ) RETURNING id INTO _ledger_id;

  RETURN _ledger_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_compensation_credits(uuid, integer, text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_compensation_credits(uuid, integer, text, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_compensation_credits(uuid, integer, text, uuid, text) TO service_role;