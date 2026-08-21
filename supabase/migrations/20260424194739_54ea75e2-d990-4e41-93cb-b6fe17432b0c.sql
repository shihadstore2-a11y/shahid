-- ============================================================
-- Phase 1: Credits System Migration
-- ============================================================

-- 1) جدول رصيد النقاط لكل مستخدم
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_credits integer NOT NULL DEFAULT 0 CHECK (plan_credits >= 0),
  topup_credits integer NOT NULL DEFAULT 0 CHECK (topup_credits >= 0),
  cycle_started_at timestamptz NOT NULL DEFAULT now(),
  cycle_ends_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credits" ON public.user_credits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all credits" ON public.user_credits
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- لا UPDATE/INSERT/DELETE مباشر — كله عبر RPCs

-- 2) سجل المحاسبة الكامل (audit trail)
CREATE TYPE public.credit_txn_type AS ENUM (
  'plan_grant',      -- منح أولي/شهري للباقة
  'topup_purchase',  -- شراء حزمة إضافية
  'consume_image',   -- استهلاك لتوليد صورة
  'consume_video',   -- استهلاك لتوليد فيديو
  'refund',          -- استرداد لعملية فاشلة
  'admin_adjust',    -- تعديل يدوي من الأدمن
  'expire'           -- انتهاء صلاحية نقاط الباقة عند التجديد
);

CREATE TYPE public.credit_source AS ENUM ('plan', 'topup');

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  txn_type public.credit_txn_type NOT NULL,
  amount integer NOT NULL,                    -- موجب=إضافة، سالب=خصم
  source public.credit_source,                -- من أي رصيد (plan/topup)
  balance_after_plan integer NOT NULL,        -- snapshot
  balance_after_topup integer NOT NULL,       -- snapshot
  reference_id uuid,                          -- ربط بـ generation/video_job/topup_purchase
  reference_type text,                        -- 'generation' | 'video_job' | 'topup_purchase'
  refunded_at timestamptz,                    -- لمنع الاسترداد المزدوج
  refund_ledger_id uuid REFERENCES public.credit_ledger(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_ledger_user_created ON public.credit_ledger(user_id, created_at DESC);
CREATE INDEX idx_credit_ledger_reference ON public.credit_ledger(reference_id) WHERE reference_id IS NOT NULL;

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ledger" ON public.credit_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all ledger" ON public.credit_ledger
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) نقاط الباقات (يحل محل plan_limits للنقاط)
CREATE TABLE IF NOT EXISTS public.plan_credits (
  plan public.user_plan PRIMARY KEY,
  monthly_credits integer NOT NULL CHECK (monthly_credits >= 0),
  daily_text_cap integer NOT NULL DEFAULT 200 CHECK (daily_text_cap >= 0),
  daily_image_cap integer NOT NULL DEFAULT 50 CHECK (daily_image_cap >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan credits readable by all" ON public.plan_credits
  FOR SELECT USING (true);

CREATE POLICY "Admins manage plan credits" ON public.plan_credits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) حزم Top-up
CREATE TABLE IF NOT EXISTS public.topup_packages (
  id text PRIMARY KEY,                -- 'pkg_500', 'pkg_1500', 'pkg_5000'
  credits integer NOT NULL CHECK (credits > 0),
  price_sar numeric(10,2) NOT NULL CHECK (price_sar > 0),
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topup_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Topup packages readable by authenticated" ON public.topup_packages
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins manage topup packages" ON public.topup_packages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) طلبات شراء حزم Top-up
CREATE TYPE public.topup_status AS ENUM ('pending', 'paid', 'activated', 'rejected', 'refunded');

CREATE TABLE IF NOT EXISTS public.topup_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id text NOT NULL REFERENCES public.topup_packages(id),
  credits integer NOT NULL,
  price_sar numeric(10,2) NOT NULL,
  status public.topup_status NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL,                     -- لمنع الازدواج
  payment_method text,
  receipt_path text,
  receipt_uploaded_at timestamptz,
  activated_at timestamptz,
  activated_by uuid,                                  -- admin user_id
  ledger_id uuid REFERENCES public.credit_ledger(id), -- ربط للتتبع
  admin_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX idx_topup_purchases_user ON public.topup_purchases(user_id, created_at DESC);
CREATE INDEX idx_topup_purchases_status ON public.topup_purchases(status) WHERE status IN ('pending','paid');

ALTER TABLE public.topup_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own topups" ON public.topup_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users create own topups" ON public.topup_purchases
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins view all topups" ON public.topup_purchases
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update topups" ON public.topup_purchases
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6) جدول طلبات الفيديو
CREATE TYPE public.video_job_status AS ENUM (
  'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'
);

CREATE TYPE public.video_quality AS ENUM ('fast', 'quality');

CREATE TABLE IF NOT EXISTS public.video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  quality public.video_quality NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 5 CHECK (duration_seconds IN (5, 10)),
  aspect_ratio text NOT NULL DEFAULT '16:9',
  starting_frame_url text,
  credits_charged integer NOT NULL CHECK (credits_charged > 0),
  ledger_id uuid REFERENCES public.credit_ledger(id),    -- لربط الاسترداد
  refund_ledger_id uuid REFERENCES public.credit_ledger(id),
  status public.video_job_status NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'replicate',
  provider_job_id text,                                   -- Replicate prediction id
  result_url text,
  storage_path text,
  error_message text,
  estimated_cost_usd numeric(10,4),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_video_jobs_user ON public.video_jobs(user_id, created_at DESC);
CREATE INDEX idx_video_jobs_status ON public.video_jobs(status) WHERE status IN ('pending','processing');
CREATE INDEX idx_video_jobs_provider ON public.video_jobs(provider_job_id) WHERE provider_job_id IS NOT NULL;

ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own video jobs" ON public.video_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all video jobs" ON public.video_jobs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- لا INSERT/UPDATE/DELETE مباشر — عبر RPCs والـwebhook

-- 7) عداد يومي للنصوص (لمنع abuse)
CREATE TABLE IF NOT EXISTS public.daily_text_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  text_count integer NOT NULL DEFAULT 0 CHECK (text_count >= 0),
  image_count integer NOT NULL DEFAULT 0 CHECK (image_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

CREATE INDEX idx_daily_text_day ON public.daily_text_usage(day);

ALTER TABLE public.daily_text_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own daily usage" ON public.daily_text_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all daily usage" ON public.daily_text_usage
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- DOĞAN'S RULE: كل تعديل على الرصيد عبر RPC ذرّية فقط
-- ============================================================

-- دالة مساعدة: ضمان وجود سجل user_credits
CREATE OR REPLACE FUNCTION public._ensure_user_credits(_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits)
  VALUES (_uid, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- 8) consume_credits — خصم ذرّي مع تحقق
CREATE OR REPLACE FUNCTION public.consume_credits(
  _amount integer,
  _txn_type public.credit_txn_type,
  _reference_id uuid DEFAULT NULL,
  _reference_type text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  ledger_id uuid,
  remaining_plan integer,
  remaining_topup integer,
  remaining_total integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  IF _txn_type NOT IN ('consume_image','consume_video') THEN
    RAISE EXCEPTION 'invalid_txn_type';
  END IF;

  PERFORM public._ensure_user_credits(_uid);

  -- قفل الصف ذرّياً
  SELECT * INTO _row
  FROM public.user_credits
  WHERE user_id = _uid
  FOR UPDATE;

  IF (_row.plan_credits + _row.topup_credits) < _amount THEN
    RAISE EXCEPTION 'insufficient_credits: required=% available=%',
      _amount, (_row.plan_credits + _row.topup_credits)
      USING ERRCODE = 'check_violation';
  END IF;

  -- استهلك من plan أولاً ثم topup
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

  -- سجل في الدفتر (سجل واحد إذا من مصدر واحد، اثنين إذا مختلط)
  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _uid, _txn_type, -_amount,
    CASE WHEN _from_topup = 0 THEN 'plan'::credit_source
         WHEN _from_plan = 0 THEN 'topup'::credit_source
         ELSE 'plan'::credit_source END,  -- mixed → نسجلها plan ونضيف split في metadata
    _row.plan_credits, _row.topup_credits,
    _reference_id, _reference_type,
    _metadata || jsonb_build_object('from_plan', _from_plan, 'from_topup', _from_topup)
  ) RETURNING id INTO _new_ledger_id;

  RETURN QUERY SELECT
    _new_ledger_id,
    _row.plan_credits,
    _row.topup_credits,
    (_row.plan_credits + _row.topup_credits);
END;
$$;

-- 9) refund_credits — استرداد لعملية فاشلة (آمن من الازدواج)
CREATE OR REPLACE FUNCTION public.refund_credits(
  _ledger_id uuid,
  _reason text DEFAULT 'generation_failed'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _orig public.credit_ledger;
  _uid uuid := auth.uid();
  _from_plan integer;
  _from_topup integer;
  _refund_amount integer;
  _row public.user_credits;
  _refund_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  -- قفل سجل المعاملة الأصلية
  SELECT * INTO _orig
  FROM public.credit_ledger
  WHERE id = _ledger_id AND user_id = _uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ledger_not_found';
  END IF;
  IF _orig.refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_refunded';
  END IF;
  IF _orig.txn_type NOT IN ('consume_image','consume_video') THEN
    RAISE EXCEPTION 'not_refundable';
  END IF;

  _refund_amount := -_orig.amount;  -- amount كان سالب
  _from_plan := COALESCE((_orig.metadata->>'from_plan')::integer, _refund_amount);
  _from_topup := COALESCE((_orig.metadata->>'from_topup')::integer, 0);

  PERFORM public._ensure_user_credits(_uid);

  UPDATE public.user_credits
  SET plan_credits = plan_credits + _from_plan,
      topup_credits = topup_credits + _from_topup,
      updated_at = now()
  WHERE user_id = _uid
  RETURNING * INTO _row;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _uid, 'refund', _refund_amount, _orig.source,
    _row.plan_credits, _row.topup_credits,
    _orig.reference_id, _orig.reference_type,
    jsonb_build_object('reason', _reason, 'original_ledger_id', _ledger_id,
                       'restored_plan', _from_plan, 'restored_topup', _from_topup)
  ) RETURNING id INTO _refund_id;

  -- علامة الأصل كمسترد
  UPDATE public.credit_ledger
  SET refunded_at = now(), refund_ledger_id = _refund_id
  WHERE id = _ledger_id;

  RETURN _refund_id;
END;
$$;

-- 10) consume_text_quota — للنصوص المجانية مع cap يومي
CREATE OR REPLACE FUNCTION public.consume_text_quota()
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
  IF _plan IS NULL THEN _plan := 'free'; END IF;

  SELECT daily_text_cap INTO _cap FROM public.plan_credits WHERE plan = _plan;
  IF _cap IS NULL THEN _cap := 200; END IF;

  INSERT INTO public.daily_text_usage (user_id, day, text_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET text_count = public.daily_text_usage.text_count + 1,
        updated_at = now()
  RETURNING text_count INTO _new_count;

  IF _new_count > _cap THEN
    -- تراجع: ارجع العداد
    UPDATE public.daily_text_usage
    SET text_count = text_count - 1, updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

-- 11) reset_monthly_credits — للتجديد الشهري (يستدعى من admin/webhook)
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
  -- فقط admin أو service_role
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO _is_admin;
  IF NOT _is_admin AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT monthly_credits INTO _new_credits FROM public.plan_credits WHERE plan = _plan;
  IF _new_credits IS NULL THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  PERFORM public._ensure_user_credits(_user_id);

  -- قفل الصف
  SELECT plan_credits INTO _old_plan_credits
  FROM public.user_credits WHERE user_id = _user_id FOR UPDATE;

  -- سجل انتهاء النقاط القديمة (إن وجدت)
  IF _old_plan_credits > 0 THEN
    INSERT INTO public.credit_ledger (
      user_id, txn_type, amount, source,
      balance_after_plan, balance_after_topup, metadata
    )
    SELECT _user_id, 'expire', -_old_plan_credits, 'plan',
           0, topup_credits, jsonb_build_object('reason', 'monthly_reset')
    FROM public.user_credits WHERE user_id = _user_id;
  END IF;

  UPDATE public.user_credits
  SET plan_credits = _new_credits,
      cycle_started_at = now(),
      cycle_ends_at = now() + interval '30 days',
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING * INTO _row;

  -- سجل المنح الجديد
  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup, metadata
  ) VALUES (
    _user_id, 'plan_grant', _new_credits, 'plan',
    _row.plan_credits, _row.topup_credits,
    jsonb_build_object('plan', _plan)
  );

  RETURN _row;
END;
$$;

-- 12) activate_topup_purchase — تفعيل حزمة بعد دفع (admin only)
CREATE OR REPLACE FUNCTION public.activate_topup_purchase(_purchase_id uuid)
RETURNS public.user_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _purchase public.topup_purchases;
  _row public.user_credits;
  _ledger_id uuid;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO _is_admin;
  IF NOT _is_admin THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  -- Advisory lock لمنع التفعيل المتزامن
  IF NOT pg_try_advisory_xact_lock(hashtext('topup_activate_' || _purchase_id::text)) THEN
    RAISE EXCEPTION 'concurrent_activation';
  END IF;

  SELECT * INTO _purchase
  FROM public.topup_purchases
  WHERE id = _purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'purchase_not_found';
  END IF;
  IF _purchase.status = 'activated' THEN
    RAISE EXCEPTION 'already_activated';
  END IF;
  IF _purchase.status NOT IN ('pending','paid') THEN
    RAISE EXCEPTION 'invalid_status: %', _purchase.status;
  END IF;

  PERFORM public._ensure_user_credits(_purchase.user_id);

  UPDATE public.user_credits
  SET topup_credits = topup_credits + _purchase.credits,
      updated_at = now()
  WHERE user_id = _purchase.user_id
  RETURNING * INTO _row;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _purchase.user_id, 'topup_purchase', _purchase.credits, 'topup',
    _row.plan_credits, _row.topup_credits,
    _purchase.id, 'topup_purchase',
    jsonb_build_object('package_id', _purchase.package_id, 'price_sar', _purchase.price_sar)
  ) RETURNING id INTO _ledger_id;

  UPDATE public.topup_purchases
  SET status = 'activated',
      activated_at = now(),
      activated_by = auth.uid(),
      ledger_id = _ledger_id,
      updated_at = now()
  WHERE id = _purchase_id;

  RETURN _row;
END;
$$;

-- 13) get_user_credits_summary — للـUI
CREATE OR REPLACE FUNCTION public.get_user_credits_summary()
RETURNS TABLE(
  plan_credits integer,
  topup_credits integer,
  total_credits integer,
  cycle_ends_at timestamptz,
  daily_text_used integer,
  daily_text_cap integer,
  plan public.user_plan
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(uc.plan_credits, 0),
    COALESCE(uc.topup_credits, 0),
    COALESCE(uc.plan_credits, 0) + COALESCE(uc.topup_credits, 0),
    uc.cycle_ends_at,
    COALESCE(dtu.text_count, 0),
    COALESCE(pc.daily_text_cap, 200),
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

-- 14) Trigger: عند إنشاء profile جديد، أنشئ user_credits + امنح نقاط الباقة الأولية
CREATE OR REPLACE FUNCTION public.grant_initial_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credits integer;
BEGIN
  SELECT monthly_credits INTO _credits
  FROM public.plan_credits WHERE plan = COALESCE(NEW.plan, 'free'::user_plan);

  IF _credits IS NULL THEN _credits := 50; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  -- سجل المنح الأولي
  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup, metadata
  ) VALUES (
    NEW.id, 'plan_grant', _credits, 'plan',
    _credits, 0,
    jsonb_build_object('reason', 'initial_signup', 'plan', NEW.plan)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_grant_credits ON public.profiles;
CREATE TRIGGER on_profile_created_grant_credits
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_initial_credits();

-- 15) Trigger: عند تغيير plan في subscription_requests إلى activated، جدد النقاط
CREATE OR REPLACE FUNCTION public.reset_credits_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- فقط عند تفعيل اشتراك جديد
  IF NEW.status = 'activated'::subscription_request_status
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.plan IS NOT NULL THEN
    BEGIN
      PERFORM public.reset_monthly_credits(NEW.user_id, NEW.plan);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'reset_monthly_credits failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_subscription_activated_reset_credits ON public.subscription_requests;
CREATE TRIGGER on_subscription_activated_reset_credits
  AFTER UPDATE ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_credits_on_plan_change();

-- 16) Trigger: updated_at على الجداول الجديدة
CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_topup_packages_updated_at
  BEFORE UPDATE ON public.topup_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_topup_purchases_updated_at
  BEFORE UPDATE ON public.topup_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_jobs_updated_at
  BEFORE UPDATE ON public.video_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_text_usage_updated_at
  BEFORE UPDATE ON public.daily_text_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_credits_updated_at
  BEFORE UPDATE ON public.plan_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- بيانات أولية
-- ============================================================

INSERT INTO public.plan_credits (plan, monthly_credits, daily_text_cap, daily_image_cap)
VALUES
  ('free', 50, 200, 50),
  ('pro', 7000, 200, 50),
  ('business', 20000, 500, 200)
ON CONFLICT (plan) DO UPDATE
  SET monthly_credits = EXCLUDED.monthly_credits,
      daily_text_cap = EXCLUDED.daily_text_cap,
      daily_image_cap = EXCLUDED.daily_image_cap,
      updated_at = now();

INSERT INTO public.topup_packages (id, credits, price_sar, display_name, display_order)
VALUES
  ('pkg_500', 500, 29.00, 'حزمة صغيرة — 500 نقطة', 1),
  ('pkg_1500', 1500, 79.00, 'حزمة متوسطة — 1500 نقطة', 2),
  ('pkg_5000', 5000, 249.00, 'حزمة كبيرة — 5000 نقطة', 3)
ON CONFLICT (id) DO UPDATE
  SET credits = EXCLUDED.credits,
      price_sar = EXCLUDED.price_sar,
      display_name = EXCLUDED.display_name,
      display_order = EXCLUDED.display_order,
      updated_at = now();

-- زرع رصيد أولي للمستخدمين الموجودين
INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
SELECT
  p.id,
  COALESCE(pc.monthly_credits, 50),
  0,
  now(),
  now() + interval '30 days'
FROM public.profiles p
LEFT JOIN public.plan_credits pc ON pc.plan = p.plan
ON CONFLICT (user_id) DO NOTHING;