-- ============================================================
-- Wave 2A — Free Monthly Trial + Video Cap
-- ============================================================

-- (1) نسخ احتياطية
CREATE TABLE IF NOT EXISTS public.backup_plan_entitlements_20260502 AS
  SELECT * FROM public.plan_entitlements;
ALTER TABLE public.backup_plan_entitlements_20260502 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only - backup_plan_entitlements"
  ON public.backup_plan_entitlements_20260502 FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.backup_user_credits_20260502 AS
  SELECT * FROM public.user_credits;
ALTER TABLE public.backup_user_credits_20260502 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only - backup_user_credits"
  ON public.backup_user_credits_20260502 FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- (2) أعمدة جديدة في plan_entitlements (للـ Free فقط — NULL للمدفوعة)
ALTER TABLE public.plan_entitlements
  ADD COLUMN IF NOT EXISTS monthly_text_cap INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_image_cap INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_video_count_cap INTEGER;

-- تعيين القيم الشهرية للـ Free فقط
UPDATE public.plan_entitlements
  SET monthly_text_cap = 5,
      monthly_image_cap = 3,
      monthly_video_count_cap = 1
  WHERE plan = 'free';

-- (3) جدول monthly_usage للاستهلاك الشهري
CREATE TABLE IF NOT EXISTS public.monthly_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  cycle_end TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  text_used INTEGER NOT NULL DEFAULT 0,
  image_used INTEGER NOT NULL DEFAULT 0,
  video_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cycle_start)
);

CREATE INDEX IF NOT EXISTS idx_monthly_usage_cycle_end ON public.monthly_usage (cycle_end);

ALTER TABLE public.monthly_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own monthly usage"
  ON public.monthly_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all monthly usage"
  ON public.monthly_usage FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- (4) دالة مساعدة: جلب أو إنشاء دورة الاستهلاك الشهرية الحالية
CREATE OR REPLACE FUNCTION public.get_or_create_current_monthly_cycle(_user_id UUID)
RETURNS public.monthly_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.monthly_usage;
BEGIN
  -- ابحث عن دورة فعّالة (now بين cycle_start و cycle_end)
  SELECT * INTO _row FROM public.monthly_usage
    WHERE user_id = _user_id AND now() >= cycle_start AND now() < cycle_end
    ORDER BY cycle_start DESC LIMIT 1;
  
  IF FOUND THEN
    RETURN _row;
  END IF;
  
  -- لا توجد دورة فعّالة → ابدأ دورة جديدة 30 يوم
  INSERT INTO public.monthly_usage (user_id, cycle_start, cycle_end)
    VALUES (_user_id, now(), now() + INTERVAL '30 days')
    ON CONFLICT (user_id, cycle_start) DO NOTHING
    RETURNING * INTO _row;
  
  IF _row IS NULL THEN
    SELECT * INTO _row FROM public.monthly_usage
      WHERE user_id = _user_id AND now() >= cycle_start AND now() < cycle_end
      ORDER BY cycle_start DESC LIMIT 1;
  END IF;
  
  RETURN _row;
END;
$$;

-- (5) تحديث consume_text_quota: Free → شهري، المدفوع → يومي كما هو
CREATE OR REPLACE FUNCTION public.consume_text_quota()
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
  _cycle public.monthly_usage;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);

  -- Free: استخدم الحصة الشهرية
  IF _ent.plan = 'free' AND _ent.monthly_text_cap IS NOT NULL THEN
    _cap := _ent.monthly_text_cap;
    _cycle := public.get_or_create_current_monthly_cycle(_uid);
    
    UPDATE public.monthly_usage
      SET text_used = text_used + 1, updated_at = now()
      WHERE user_id = _uid AND cycle_start = _cycle.cycle_start
      RETURNING text_used INTO _new_count;
    
    IF _new_count > _cap THEN
      UPDATE public.monthly_usage
        SET text_used = GREATEST(text_used - 1, 0), updated_at = now()
        WHERE user_id = _uid AND cycle_start = _cycle.cycle_start;
      RETURN QUERY SELECT false, _new_count - 1, _cap;
    ELSE
      RETURN QUERY SELECT true, _new_count, _cap;
    END IF;
    RETURN;
  END IF;

  -- المدفوعة: نفس المنطق اليومي السابق
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

-- (6) تحديث consume_image_quota: Free → شهري، المدفوع → يومي
CREATE OR REPLACE FUNCTION public.consume_image_quota(_quality text DEFAULT 'flash'::text)
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
  _cycle public.monthly_usage;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _quality NOT IN ('flash', 'pro') THEN RAISE EXCEPTION 'invalid_image_quality'; END IF;

  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);
  IF _quality = 'pro' AND COALESCE(_ent.image_pro_allowed, false) = false THEN
    RAISE EXCEPTION 'image_pro_not_allowed';
  END IF;

  -- Free: شهري
  IF _ent.plan = 'free' AND _ent.monthly_image_cap IS NOT NULL THEN
    _cap := _ent.monthly_image_cap;
    _cycle := public.get_or_create_current_monthly_cycle(_uid);
    
    UPDATE public.monthly_usage
      SET image_used = image_used + 1, updated_at = now()
      WHERE user_id = _uid AND cycle_start = _cycle.cycle_start
      RETURNING image_used INTO _new_count;
    
    IF _new_count > _cap THEN
      UPDATE public.monthly_usage
        SET image_used = GREATEST(image_used - 1, 0), updated_at = now()
        WHERE user_id = _uid AND cycle_start = _cycle.cycle_start;
      RETURN QUERY SELECT false, _new_count - 1, _cap;
    ELSE
      RETURN QUERY SELECT true, _new_count, _cap;
    END IF;
    RETURN;
  END IF;

  -- المدفوعة: يومي كما هو
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

-- (7) دالة جديدة: التحقق من سقف الفيديو الشهري للـ Free فقط (تستدعى قبل خصم النقاط)
CREATE OR REPLACE FUNCTION public.check_free_monthly_video_quota()
RETURNS TABLE(allowed boolean, used integer, monthly_cap integer, next_reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cycle public.monthly_usage;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);

  -- المدفوعة: لا يوجد سقف عددي للفيديو (يخضع للنقاط فقط)
  IF _ent.plan <> 'free' OR _ent.monthly_video_count_cap IS NULL THEN
    RETURN QUERY SELECT true, 0, 999999, (now() + INTERVAL '30 days');
    RETURN;
  END IF;

  _cycle := public.get_or_create_current_monthly_cycle(_uid);
  
  IF _cycle.video_used >= _ent.monthly_video_count_cap THEN
    RETURN QUERY SELECT false, _cycle.video_used, _ent.monthly_video_count_cap, _cycle.cycle_end;
  ELSE
    RETURN QUERY SELECT true, _cycle.video_used, _ent.monthly_video_count_cap, _cycle.cycle_end;
  END IF;
END;
$$;

-- (8) دالة لتسجيل استهلاك فيديو في الدورة الشهرية (تستدعى عند نجاح الإنشاء)
CREATE OR REPLACE FUNCTION public.record_free_monthly_video_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cycle public.monthly_usage;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);
  
  -- فقط للـ free
  IF _ent.plan <> 'free' OR _ent.monthly_video_count_cap IS NULL THEN
    RETURN;
  END IF;
  
  _cycle := public.get_or_create_current_monthly_cycle(_uid);
  
  UPDATE public.monthly_usage
    SET video_used = video_used + 1, updated_at = now()
    WHERE user_id = _uid AND cycle_start = _cycle.cycle_start;
END;
$$;

-- (9) GRANT execute للأدوار المناسبة
GRANT EXECUTE ON FUNCTION public.get_or_create_current_monthly_cycle(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_free_monthly_video_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_free_monthly_video_usage() TO authenticated, service_role;