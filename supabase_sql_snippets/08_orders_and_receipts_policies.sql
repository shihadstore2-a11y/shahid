-- ===================================================================
-- 📄 08: صلاحيات إدارة الطلبات والمدفوعات (Orders & Payment Proofs RLS)
-- الوصف: 
-- 1. يتيح لمدير المتجر رؤية كافة الطلبات وتحديث حالاتها (قيد الانتظار / مكتمل / ملغي).
-- 2. يتيح للعملاء تتبع طلباتهم برقم الجوال أو البريد.
-- ===================================================================

-- 1. صلاحية المشرفين لقراءة وتحديث الطلبات
DROP POLICY IF EXISTS "admin_can_read_orders" ON public.orders;
CREATE POLICY "admin_can_read_orders" ON public.orders
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_can_update_orders" ON public.orders;
CREATE POLICY "admin_can_update_orders" ON public.orders
FOR UPDATE TO authenticated 
USING (public.is_admin(auth.uid())) 
WITH CHECK (public.is_admin(auth.uid()));

-- 2. صلاحية إنشاء الطلب للزبائن (عند إتمام الشراء)
DROP POLICY IF EXISTS "public_can_create_orders" ON public.orders;
CREATE POLICY "public_can_create_orders" ON public.orders
FOR INSERT WITH CHECK (true);

-- 3. صلاحيات عناصر الطلب (order_items)
DROP POLICY IF EXISTS "admin_can_read_order_items" ON public.order_items;
CREATE POLICY "admin_can_read_order_items" ON public.order_items
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "public_can_create_order_items" ON public.order_items;
CREATE POLICY "public_can_create_order_items" ON public.order_items
FOR INSERT WITH CHECK (true);
