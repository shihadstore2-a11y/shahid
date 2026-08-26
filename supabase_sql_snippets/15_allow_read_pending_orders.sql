-- ===================================================================
-- 📄 15: السماح بالتحقق وقراءة الطلبات المعلقة (Allow Select Pending Orders RLS)
-- ===================================================================
-- الهدف: السماح بالتحقق من الطلب المعلق أثناء إتمام عملية الدفع في بوابة الدفع
-- دون حظر استعلامات الطلبات المعلقة بواسطة سياسات الأمان RLS.
-- ===================================================================

DROP POLICY IF EXISTS "public_can_read_pending_orders" ON public.orders;
CREATE POLICY "public_can_read_pending_orders" ON public.orders
  FOR SELECT
  TO anon, authenticated
  USING (status = 'pending');
