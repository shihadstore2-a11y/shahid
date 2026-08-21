-- ============================================================================
-- Wave 3: Launch Bonus Program (50pt for first 100 paid subscribers)
-- ============================================================================

-- 1) Add is_founding_member flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_founding_member BOOLEAN NOT NULL DEFAULT false;

-- 2) launch_bonus_recipients table
CREATE TABLE IF NOT EXISTS public.launch_bonus_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_request_id UUID REFERENCES public.subscription_requests(id) ON DELETE SET NULL,
  ledger_id UUID REFERENCES public.credit_ledger(id) ON DELETE SET NULL,
  credits_granted INTEGER NOT NULL DEFAULT 50,
  recipient_number INTEGER NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_launch_bonus_recipients_granted
  ON public.launch_bonus_recipients (granted_at DESC);

ALTER TABLE public.launch_bonus_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_launch_bonus" ON public.launch_bonus_recipients;
CREATE POLICY "users_view_own_launch_bonus"
  ON public.launch_bonus_recipients
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 3) grant_launch_bonus_if_eligible
CREATE OR REPLACE FUNCTION public.grant_launch_bonus_if_eligible(
  _user_id UUID,
  _subscription_request_id UUID DEFAULT NULL
)
RETURNS TABLE(granted BOOLEAN, recipient_number INTEGER, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_count INTEGER;
  _already_granted BOOLEAN;
  _new_number INTEGER;
  _new_ledger_id UUID;
  _topup_balance INTEGER;
  _plan_balance INTEGER;
BEGIN
  -- already received?
  SELECT EXISTS (
    SELECT 1 FROM public.launch_bonus_recipients WHERE user_id = _user_id
  ) INTO _already_granted;

  IF _already_granted THEN
    RETURN QUERY SELECT false, NULL::INTEGER, 'already_granted'::TEXT;
    RETURN;
  END IF;

  -- lock to prevent race past 100
  PERFORM 1 FROM public.launch_bonus_recipients FOR UPDATE;
  SELECT COUNT(*) INTO _existing_count FROM public.launch_bonus_recipients;

  IF _existing_count >= 100 THEN
    RETURN QUERY SELECT false, NULL::INTEGER, 'cap_reached'::TEXT;
    RETURN;
  END IF;

  _new_number := _existing_count + 1;

  -- read current balances (user_credits row)
  SELECT COALESCE(plan_credits, 0), COALESCE(topup_credits, 0)
    INTO _plan_balance, _topup_balance
  FROM public.user_credits WHERE user_id = _user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_credits (user_id, plan_credits, topup_credits)
    VALUES (_user_id, 0, 50)
    RETURNING plan_credits, topup_credits INTO _plan_balance, _topup_balance;
  ELSE
    UPDATE public.user_credits
      SET topup_credits = topup_credits + 50,
          updated_at = now()
      WHERE user_id = _user_id
    RETURNING plan_credits, topup_credits INTO _plan_balance, _topup_balance;
  END IF;

  -- ledger row
  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _user_id, 'grant', 50, 'topup',
    _plan_balance, _topup_balance,
    _subscription_request_id, 'launch_bonus',
    jsonb_build_object('reason', 'launch_bonus', 'recipient_number', _new_number)
  )
  RETURNING id INTO _new_ledger_id;

  INSERT INTO public.launch_bonus_recipients (
    user_id, subscription_request_id, ledger_id, credits_granted, recipient_number
  ) VALUES (
    _user_id, _subscription_request_id, _new_ledger_id, 50, _new_number
  );

  UPDATE public.profiles SET is_founding_member = true, updated_at = now()
    WHERE id = _user_id;

  RETURN QUERY SELECT true, _new_number, 'granted'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_launch_bonus_if_eligible(UUID, UUID) FROM PUBLIC;

-- 4) Trigger on subscription_requests activation
CREATE OR REPLACE FUNCTION public.trg_launch_bonus_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'activated' AND (OLD.status IS DISTINCT FROM 'activated') THEN
    BEGIN
      PERFORM public.grant_launch_bonus_if_eligible(NEW.user_id, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'launch_bonus grant failed for user %: %', NEW.user_id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_requests_launch_bonus ON public.subscription_requests;
CREATE TRIGGER subscription_requests_launch_bonus
  AFTER UPDATE OF status ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_launch_bonus_on_activation();

-- 5) Read function: stats
CREATE OR REPLACE FUNCTION public.get_launch_bonus_stats()
RETURNS TABLE(total_granted INTEGER, remaining INTEGER, cap INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::INTEGER AS total_granted,
    GREATEST(0, 100 - COUNT(*)::INTEGER) AS remaining,
    100 AS cap
  FROM public.launch_bonus_recipients
$$;

GRANT EXECUTE ON FUNCTION public.get_launch_bonus_stats() TO authenticated, anon;
