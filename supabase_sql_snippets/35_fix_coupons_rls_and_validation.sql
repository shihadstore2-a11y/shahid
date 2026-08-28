-- ===================================================================
-- 35: Fix Coupons Permissions, RLS & Secure Validation Function
-- ===================================================================

-- 1. التأكد من وجود جدول الكوبونات وإضافة كافة الأعمدة المطلوبة
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_percent INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS discount_percent INT NOT NULL DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS applies_to_duration_min INT NOT NULL DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. منح الصلاحيات الأساسية على الجدول للجميع (حاسم لمنع خطأ permission denied)
GRANT SELECT ON public.coupons TO anon, authenticated, service_role;
GRANT ALL ON public.coupons TO service_role;

-- 3. تفعيل RLS وسياسة القراءة العامة للكوبونات المفعلة
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupons_public_read_active" ON public.coupons;
DROP POLICY IF EXISTS "allow_all_read_active_coupons" ON public.coupons;

CREATE POLICY "coupons_public_read_active" ON public.coupons
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- 4. سياسات إدارة الكوبونات للمشرفين
DROP POLICY IF EXISTS "admin_can_read_coupons" ON public.coupons;
CREATE POLICY "admin_can_read_coupons" ON public.coupons
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_can_insert_coupons" ON public.coupons;
CREATE POLICY "admin_can_insert_coupons" ON public.coupons
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_can_update_coupons" ON public.coupons;
CREATE POLICY "admin_can_update_coupons" ON public.coupons
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_can_delete_coupons" ON public.coupons;
CREATE POLICY "admin_can_delete_coupons" ON public.coupons
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 5. دالة فحص الكوبونات الآمنة والفورية (تتجاوز أي قيود RLS عبر SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.validate_coupon_code(_code TEXT, _duration_months INT DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_raw_min INT;
  v_min_months INT;
BEGIN
  -- البحث عن الكوبون بدون حساسية لحالة الأحرف
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE LOWER(TRIM(code)) = LOWER(TRIM(_code))
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'كود الخصم غير صحيح أو غير مفعّل');
  END IF;

  -- فحص الصلاحية الزمنية
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'عذراً، انتهت صلاحية هذا الكوبون');
  END IF;

  -- فحص الحد الأدنى للمدة (سواء تم إدخاله بالأشهر أو بالأيام)
  v_raw_min := COALESCE(v_coupon.applies_to_duration_min, 0);
  IF v_raw_min > 12 THEN
    v_min_months := ROUND(v_raw_min / 30.0);
  ELSE
    v_min_months := v_raw_min;
  END IF;

  IF v_min_months > 0 AND _duration_months < v_min_months THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'هذا الكود مخصص للباقات مدة ' || v_min_months || ' أشهر فأكثر (مدة الباقة الحالية: ' || _duration_months || ' شهر)'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_coupon.code,
    'discount_percent', v_coupon.discount_percent
  );
END;
$$;

-- 6. منح صلاحية تنفيذ الدالة للجميع
REVOKE ALL ON FUNCTION public.validate_coupon_code(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon_code(TEXT, INT) TO anon, authenticated, service_role;

-- 7. فهرس سريع
CREATE INDEX IF NOT EXISTS idx_coupons_code_lower ON public.coupons(LOWER(TRIM(code)));

-- 8. تحديث كاش PostgREST
NOTIFY pgrst, 'reload schema';
