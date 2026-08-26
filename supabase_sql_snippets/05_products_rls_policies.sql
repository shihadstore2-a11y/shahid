-- ===================================================================
-- 📄 05: سياسات الأمان والحماية لجدول المنتجات (Products RLS Policies)
-- الوصف: يمنح الصلاحيات الكاملة لمدير المتجر للتحكم في المنتجات:
--       - إضافة منتجات جديدة (INSERT)
--       - تعديل أسعار وحالات المنتجات (UPDATE)
--       - حذف المنتجات (DELETE)
--       - السماح للزوار بتصفح المنتجات في واجهة المتجر (SELECT)
-- ===================================================================

-- 1. السماح لمدير المتجر بإضافة منتجات جديدة
DROP POLICY IF EXISTS "admin_can_insert_products" ON public.products;
CREATE POLICY "admin_can_insert_products" ON public.products
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- 2. السماح لمدير المتجر بتعديل المنتجات
DROP POLICY IF EXISTS "admin_can_update_products" ON public.products;
CREATE POLICY "admin_can_update_products" ON public.products
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 3. السماح لمدير المتجر بحذف المنتجات
DROP POLICY IF EXISTS "admin_can_delete_products" ON public.products;
CREATE POLICY "admin_can_delete_products" ON public.products
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 4. السماح للعامة والزوار بقراءة وتصفح المنتجات في المتجر
DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products
FOR SELECT
USING (true);
