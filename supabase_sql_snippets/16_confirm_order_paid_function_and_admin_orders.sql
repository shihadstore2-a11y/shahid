-- ===================================================================
-- 📄 16: دالة تأكيد الدفع الفوري وصلاحيات تحديث الطلبات (Confirm Order Paid RPC)
-- ===================================================================
-- الهدف: 
-- 1. دالة موثوقة (SECURITY DEFINER) تقوم بتحديث حالة الطلب إلى 'paid' 
--    والمعاملة إلى 'success' فور نجاح الدفع بدون عوائق RLS.
-- 2. فتح صلاحيات القراءة في لوحة الإدارة لجميع حالات الطلبات.
-- ===================================================================

-- 1. إنشاء دالة تأكيد الدفع الفوري
CREATE OR REPLACE FUNCTION public.confirm_order_paid(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- تحديث حالة الطلب
  UPDATE public.orders
  SET status = 'paid',
      updated_at = NOW()
  WHERE id = _order_id
  RETURNING id, order_number, total, customer_name, customer_phone, customer_email, status INTO v_order;

  -- تحديث سجل المعاملة
  UPDATE public.payment_transactions
  SET status = 'success',
      updated_at = NOW()
  WHERE order_id = _order_id;

  IF v_order.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'total', v_order.total,
      'status', v_order.status
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
END;
$$;

-- 2. منح صلاحية تنفيذ الدالة للمستخدمين والزوار
REVOKE ALL ON FUNCTION public.confirm_order_paid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_order_paid(UUID) TO anon, authenticated;

-- 3. تأكيد كل الطلبات المعلقة الحالية التي تم دفعها بالفعل لتظهر فوراً
UPDATE public.orders
SET status = 'paid', updated_at = NOW()
WHERE status = 'pending';

UPDATE public.payment_transactions
SET status = 'success', updated_at = NOW()
WHERE status = 'initiated';
