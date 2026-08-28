-- ===================================================================
-- 35: Fix Coupons RLS & Public Access for Store Checkout
-- ===================================================================
-- الهدف:
-- 1. السماح للزوار والعملاء في صفحة الدفع بفحص الكوبونات الفعالة وتطبيقها
-- 2. إتاحة قراءة الكوبونات لـ anon و authenticated دون قيود
-- 3. ضمان فحص الكوبونات بدقة وتحديث كاش الـ Schema
-- ===================================================================

-- 1. التأكد من وجود جدول الكوبونات بالأعمدة المطلوبة
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_percent INT NOT NULL DEFAULT 0,
  valid_until TIMESTAMPTZ,
  applies_to_duration_min INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. تفعيل نظام الأمان (RLS)
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- 3. سياسة قراءة الكوبونات الفعالة للجميع (زوار + مسجلين) في صفحة إتمام الطلب
DROP POLICY IF EXISTS "coupons_public_read_active" ON public.coupons;
DROP POLICY IF EXISTS "allow_all_read_active_coupons" ON public.coupons;

CREATE POLICY "coupons_public_read_active" ON public.coupons
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- 4. سياسات إدارة الكوبونات للمشرفين (إضافة، تعديل، حذف)
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

-- 5. فهرس سريع للبحث غير الحساس لحالة الأحرف
CREATE INDEX IF NOT EXISTS idx_coupons_code_lower ON public.coupons(LOWER(TRIM(code)));

-- 6. تحديث كاش Schema لـ PostgREST
NOTIFY pgrst, 'reload schema';
