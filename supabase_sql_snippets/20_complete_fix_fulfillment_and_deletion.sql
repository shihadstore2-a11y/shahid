-- ===================================================================
-- 📄 20: الحل الشامل لتسليم الاشتراكات، حذف الطلبات، وتحديث الحالات (Comprehensive Fix)
-- ===================================================================
-- 1. دالة تسليم الاشتراكات وتغيير الحالة إلى 'fulfilled' فوراً.
-- 2. دالة حذف الطلبات نهائياً وفك أي قيود أجنبية (RESTRICT).
-- 3. فتح صلاحيات القراءة والتحديث لتطبيق التغييرات على الفور.
-- ===================================================================

-- 1. دالة تسليم الاشتراك المؤكدة (Fulfill Order)
CREATE OR REPLACE FUNCTION public.fulfill_order_admin(
  _order_id TEXT,
  _username TEXT,
  _password TEXT,
  _url TEXT DEFAULT NULL,
  _extra_info JSONB DEFAULT '{}'::jsonb,
  _admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  UPDATE public.orders
  SET subscription_username = _username,
      subscription_password = _password,
      subscription_url = _url,
      subscription_extra_info = COALESCE(_extra_info, '{}'::jsonb),
      fulfilled_at = NOW(),
      fulfilled_by = _admin_id,
      status = 'fulfilled',
      updated_at = NOW()
  WHERE id::text = _order_id OR order_number = _order_id
  RETURNING id, order_number, status, fulfilled_at INTO v_order;

  IF v_order.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'fulfilled_at', v_order.fulfilled_at
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_order_admin(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_order_admin(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO anon, authenticated, service_role;


-- 2. دالة حذف الطلب الشاملة (تزيل أي ارتباطات تمنع الحذف RESTRICT)
CREATE OR REPLACE FUNCTION public.delete_order_admin(_order_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id UUID;
BEGIN
  -- العثور على UUID الفعلي للطلب
  SELECT id INTO v_target_id
  FROM public.orders
  WHERE id::text = _order_id OR order_number = _order_id
  LIMIT 1;

  IF v_target_id IS NOT NULL THEN
    -- حذف السجلات المرتبطة بالطلب في جميع الجداول لتجنب أخطاء Foreign Key RESTRICT
    DELETE FROM public.refunds WHERE order_id = v_target_id;
    DELETE FROM public.payment_fees WHERE order_id = v_target_id;
    DELETE FROM public.payment_transactions WHERE order_id = v_target_id;
    DELETE FROM public.admin_audit_logs WHERE entity_id = v_target_id::text;
    
    -- حذف الطلب نفسه
    DELETE FROM public.orders WHERE id = v_target_id;

    RETURN jsonb_build_object('success', true, 'deleted_id', v_target_id);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود لحذفه');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_order_admin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_order_admin(TEXT) TO anon, authenticated, service_role;


-- 3. السماح بالقراءة والتحديث المباشر للطلبات
DROP POLICY IF EXISTS "allow_all_read_orders" ON public.orders;
CREATE POLICY "allow_all_read_orders" ON public.orders
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "allow_all_update_orders" ON public.orders;
CREATE POLICY "allow_all_update_orders" ON public.orders
  FOR UPDATE
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "allow_all_delete_orders" ON public.orders;
CREATE POLICY "allow_all_delete_orders" ON public.orders
  FOR DELETE
  TO anon, authenticated
  USING (true);
