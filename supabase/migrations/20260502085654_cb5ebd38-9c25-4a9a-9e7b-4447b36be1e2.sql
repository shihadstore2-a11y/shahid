-- Wave C3: Referrals + Annual Upgrade Loop

-- 1) جدول أكواد الإحالة (واحد لكل مستخدم)
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  uses_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_referral_code"
  ON public.referral_codes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "service_role_writes_referral_codes"
  ON public.referral_codes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2) جدول الإحالات
CREATE TYPE public.referral_status AS ENUM ('pending', 'qualified', 'rewarded');

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code_used text NOT NULL,
  status public.referral_status NOT NULL DEFAULT 'pending',
  reward_points integer NOT NULL DEFAULT 0,
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_user_id <> referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (
    auth.uid() = referrer_user_id
    OR auth.uid() = referred_user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "service_role_writes_referrals"
  ON public.referrals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3) جدول عروض الترقية السنوية
CREATE TABLE IF NOT EXISTS public.annual_upgrade_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shown_at timestamptz NOT NULL DEFAULT now(),
  clicked_at timestamptz,
  upgraded_at timestamptz,
  discount_pct integer NOT NULL DEFAULT 20,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id)
);
ALTER TABLE public.annual_upgrade_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_upgrade_offer"
  ON public.annual_upgrade_offers FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "users_insert_own_upgrade_offer"
  ON public.annual_upgrade_offers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_upgrade_offer"
  ON public.annual_upgrade_offers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) دالة توليد كود إحالة (8 أحرف، فريد، حسّاس بحالة الأحرف)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing text;
  v_code text;
  v_attempts integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT code INTO v_existing FROM public.referral_codes WHERE user_id = v_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    -- 8 chars: A-Z + 0-9 (بدون أحرف ملتبسة O/0/I/1)
    v_code := upper(translate(
      substring(encode(gen_random_bytes(8), 'base64') FROM 1 FOR 8),
      '0OIl1+/=', 'XYZAB'
    ));
    BEGIN
      INSERT INTO public.referral_codes (user_id, code) VALUES (v_user_id, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts > 5 THEN
        RAISE EXCEPTION 'failed to generate unique code';
      END IF;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO authenticated;

-- 5) دالة تسجيل إحالة (يستدعيها المُحال بعد التسجيل)
CREATE OR REPLACE FUNCTION public.claim_referral_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_referrer_id uuid;
  v_existing uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- المستخدم لم يُحَل من قبل
  SELECT id INTO v_existing FROM public.referrals WHERE referred_user_id = v_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  SELECT user_id INTO v_referrer_id FROM public.referral_codes
    WHERE code = upper(_code);
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  INSERT INTO public.referrals (referrer_user_id, referred_user_id, code_used)
  VALUES (v_referrer_id, v_user_id, upper(_code));

  UPDATE public.referral_codes SET uses_count = uses_count + 1
    WHERE user_id = v_referrer_id;

  RETURN jsonb_build_object('ok', true, 'referrer_id', v_referrer_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral_code(text) TO authenticated;

-- 6) Trigger: عند ترقية المُحال لباقة مدفوعة → تأهّل + مكافأة 50pt للمُحيل
CREATE OR REPLACE FUNCTION public.qualify_referral_on_paid_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
BEGIN
  -- فقط عند تغيّر الخطة من free إلى مدفوعة
  IF NEW.plan = 'free' OR (OLD.plan IS NOT NULL AND OLD.plan = NEW.plan) THEN
    RETURN NEW;
  END IF;
  IF OLD.plan IS NOT NULL AND OLD.plan <> 'free' THEN
    RETURN NEW; -- ترقية بين باقات مدفوعة، ليست تأهّل أول
  END IF;

  SELECT referrer_user_id INTO v_referrer_id
    FROM public.referrals
    WHERE referred_user_id = NEW.id AND status = 'pending';
  IF v_referrer_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.referrals
    SET status = 'qualified',
        qualified_at = now(),
        reward_points = 50
    WHERE referred_user_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qualify_referral_on_paid_plan ON public.profiles;
CREATE TRIGGER trg_qualify_referral_on_paid_plan
  AFTER UPDATE OF plan ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.qualify_referral_on_paid_plan();

-- 7) RPC إحصائيات للأدمن
CREATE OR REPLACE FUNCTION public.get_referral_stats(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  WITH r AS (
    SELECT * FROM public.referrals
    WHERE created_at >= now() - (_days || ' days')::interval
  ),
  codes AS (
    SELECT COUNT(*) AS active_codes,
           COALESCE(SUM(uses_count), 0) AS total_uses
    FROM public.referral_codes
  ),
  upgrades AS (
    SELECT
      COUNT(*) AS shown,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
      COUNT(*) FILTER (WHERE upgraded_at IS NOT NULL) AS upgraded
    FROM public.annual_upgrade_offers
    WHERE shown_at >= now() - (_days || ' days')::interval
  ),
  active_referrers AS (
    SELECT COUNT(DISTINCT referrer_user_id) AS n FROM r
  ),
  total_users AS (
    SELECT COUNT(*) AS n FROM auth.users WHERE created_at >= now() - (_days || ' days')::interval
  )
  SELECT jsonb_build_object(
    'window_days', _days,
    'referrals_total', (SELECT COUNT(*) FROM r),
    'referrals_pending', (SELECT COUNT(*) FROM r WHERE status = 'pending'),
    'referrals_qualified', (SELECT COUNT(*) FROM r WHERE status = 'qualified'),
    'referrals_rewarded', (SELECT COUNT(*) FROM r WHERE status = 'rewarded'),
    'active_codes', (SELECT active_codes FROM codes),
    'total_uses', (SELECT total_uses FROM codes),
    'k_factor',
      CASE WHEN (SELECT n FROM total_users) > 0
        THEN ROUND((SELECT COUNT(*) FROM r)::numeric / (SELECT n FROM total_users), 2)
        ELSE 0 END,
    'annual_upgrade', jsonb_build_object(
      'shown', (SELECT shown FROM upgrades),
      'clicked', (SELECT clicked FROM upgrades),
      'upgraded', (SELECT upgraded FROM upgrades),
      'click_rate_pct',
        CASE WHEN (SELECT shown FROM upgrades) > 0
          THEN ROUND((SELECT clicked FROM upgrades)::numeric * 100 / (SELECT shown FROM upgrades), 1)
          ELSE 0 END,
      'upgrade_rate_pct',
        CASE WHEN (SELECT shown FROM upgrades) > 0
          THEN ROUND((SELECT upgraded FROM upgrades)::numeric * 100 / (SELECT shown FROM upgrades), 1)
          ELSE 0 END
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_referral_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(integer) TO authenticated;