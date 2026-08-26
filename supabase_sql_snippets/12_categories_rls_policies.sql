-- ===================================================================
-- 📄 12: سياسات الأمان والحماية لجدول التصنيفات (Categories RLS Policies)
-- الوصف: 
-- 1. يتيح لمدير المتجر إنشاء، تعديل، وحذف التصنيفات والفئات (INSERT, UPDATE, DELETE).
-- 2. يتيح للزبائن والزوار تصفح التصنيفات في المتجر (SELECT).
-- ===================================================================

-- 1. تصفح وقراءة التصنيفات للعامة والزوار
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read" ON public.categories
FOR SELECT USING (true);

-- 2. صلاحية إضافة تصنيف جديد لمدير المتجر
DROP POLICY IF EXISTS "admin_can_insert_categories" ON public.categories;
CREATE POLICY "admin_can_insert_categories" ON public.categories
FOR INSERT TO authenticated 
WITH CHECK (public.is_admin(auth.uid()));

-- 3. صلاحية تعديل التصنيفات لمدير المتجر
DROP POLICY IF EXISTS "admin_can_update_categories" ON public.categories;
CREATE POLICY "admin_can_update_categories" ON public.categories
FOR UPDATE TO authenticated 
USING (public.is_admin(auth.uid())) 
WITH CHECK (public.is_admin(auth.uid()));

-- 4. صلاحية حذف التصنيفات لمدير المتجر
DROP POLICY IF EXISTS "admin_can_delete_categories" ON public.categories;
CREATE POLICY "admin_can_delete_categories" ON public.categories
FOR DELETE TO authenticated 
USING (public.is_admin(auth.uid()));
