-- ===================================================================
-- 📄 10: إعدادات المتجر وطرق الدفع والواتساب (Store Settings RLS)
-- الوصف: 
-- 1. يتيح للمشرفين تعديل الحسابات البنكية، رقم الواتساب، وبيانات المتجر.
-- 2. يتيح للزبائن قراءة الإعدادات العامة (رقم الدعم، اسم المتجر، الحساب البنكي للدفع).
-- ===================================================================

-- 1. قراءة عامة لإعدادات المتجر للزبائن
DROP POLICY IF EXISTS "settings_public_read" ON public.store_settings;
CREATE POLICY "settings_public_read" ON public.store_settings
FOR SELECT USING (true);

-- 2. تعديل الإعدادات للمشرفين فقط
DROP POLICY IF EXISTS "admin_can_update_settings" ON public.store_settings;
CREATE POLICY "admin_can_update_settings" ON public.store_settings
FOR UPDATE TO authenticated 
USING (public.is_admin(auth.uid())) 
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_can_insert_settings" ON public.store_settings;
CREATE POLICY "admin_can_insert_settings" ON public.store_settings
FOR INSERT TO authenticated 
WITH CHECK (public.is_admin(auth.uid()));
