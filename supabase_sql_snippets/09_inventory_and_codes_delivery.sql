-- ===================================================================
-- 📄 09: إدارة مخزون الأكواد والتسليم الفوري (Inventory & Activation Codes)
-- الوصف: 
-- 1. يمنح مدير المتجر صلاحية إضافة واستعراض أكواد الاشتراكات في المخزون.
-- 2. يضمن سرية الأكواد غير المباعة وحمايتها من أي استعلام خارجي.
-- ===================================================================

-- 1. صلاحيات المشرفين لإدارة المخزون (قراءة، إضافة، تحديث، حذف)
DROP POLICY IF EXISTS "admin_can_manage_inventory" ON public.inventory_items;
CREATE POLICY "admin_can_manage_inventory" ON public.inventory_items
FOR ALL TO authenticated 
USING (public.is_admin(auth.uid())) 
WITH CHECK (public.is_admin(auth.uid()));

-- 2. استعلام سريع لمعرفة عدد الأكواد المتبقية المتوفرة لكل منتج
-- (يمكنك تشغيله في أي وقت لمعرفة حالة مخزونك)
-- SELECT p.name_ar, count(i.id) as available_codes
-- FROM public.products p
-- LEFT JOIN public.inventory_items i ON i.product_id = p.id AND i.is_used = false
-- GROUP BY p.name_ar;
