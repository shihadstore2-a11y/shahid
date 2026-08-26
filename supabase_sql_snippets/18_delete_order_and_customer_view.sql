-- ===================================================================
-- 📄 18: دالة حذف الطلب للإدارة + ربط وعرض طلبات العملاء (Delete Order & Customer Orders)
-- ===================================================================
-- 1. دالة حذف الطلب نهائياً لمدير المتجر.
-- 2. دالة جلب وربط طلبات العميل بحسابه تلقائياً.
-- ===================================================================

-- 1. دالة حذف الطلب نهائياً من قاعدة البيانات
CREATE OR REPLACE FUNCTION public.delete_order_admin(_order_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- حذف سجلات المعاملات المرتبطة
  DELETE FROM public.payment_transactions WHERE order_id::text = _order_id;
  
  -- حذف سجلات تدقيق الإدارة المرتبطة إن وجدت
  DELETE FROM public.admin_audit_logs WHERE entity_id = _order_id;

  -- حذف الطلب نفسه
  DELETE FROM public.orders WHERE id::text = _order_id OR order_number = _order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_order_admin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_order_admin(TEXT) TO anon, authenticated;

-- 2. دالة جلب وربط طلبات العميل بحسابه تلقائياً عبر الإيميل أو الجوال
CREATE OR REPLACE FUNCTION public.get_my_customer_orders(
  _user_id UUID DEFAULT NULL,
  _email TEXT DEFAULT NULL,
  _phone TEXT DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ربط الطلبات غير المربوطة تلقائياً بحساب العميل
  IF _user_id IS NOT NULL THEN
    IF _email IS NOT NULL AND _email <> '' THEN
      UPDATE public.orders
      SET user_id = _user_id
      WHERE user_id IS NULL AND LOWER(customer_email) = LOWER(_email);
    END IF;
    IF _phone IS NOT NULL AND _phone <> '' THEN
      UPDATE public.orders
      SET user_id = _user_id
      WHERE user_id IS NULL AND customer_phone = _phone;
    END IF;
  END IF;

  RETURN QUERY
  SELECT * FROM public.orders
  WHERE (user_id IS NOT NULL AND user_id = _user_id)
     OR (_email IS NOT NULL AND _email <> '' AND LOWER(customer_email) = LOWER(_email))
     OR (_phone IS NOT NULL AND _phone <> '' AND customer_phone = _phone)
  ORDER BY created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_customer_orders(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_customer_orders(UUID, TEXT, TEXT) TO anon, authenticated;
