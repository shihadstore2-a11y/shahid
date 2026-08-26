-- ===================================================================
-- 📄 06: سياسات الأمان والحماية لجدول الكوبونات (Coupons RLS Policies)
-- الوصف: يمنح الصلاحيات لمدير المتجر لإنشاء، تعديل، قراءة، وحذف كوبونات الخصم
-- ===================================================================

-- 1. قراءة الكوبونات للمشرفين
DROP POLICY IF EXISTS "admin_can_read_coupons" ON public.coupons;
CREATE POLICY "admin_can_read_coupons" ON public.coupons 
FOR SELECT TO authenticated 
USING (public.is_admin(auth.uid()));

-- 2. إضافة كوبونات جديدة
DROP POLICY IF EXISTS "admin_can_insert_coupons" ON public.coupons;
CREATE POLICY "admin_can_insert_coupons" ON public.coupons 
FOR INSERT TO authenticated 
WITH CHECK (public.is_admin(auth.uid()));

-- 3. تعديل الكوبونات
DROP POLICY IF EXISTS "admin_can_update_coupons" ON public.coupons;
CREATE POLICY "admin_can_update_coupons" ON public.coupons 
FOR UPDATE TO authenticated 
USING (public.is_admin(auth.uid())) 
WITH CHECK (public.is_admin(auth.uid()));

-- 4. حذف الكوبونات
DROP POLICY IF EXISTS "admin_can_delete_coupons" ON public.coupons;
CREATE POLICY "admin_can_delete_coupons" ON public.coupons 
FOR DELETE TO authenticated 
USING (public.is_admin(auth.uid()));
