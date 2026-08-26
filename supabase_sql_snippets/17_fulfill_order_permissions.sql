-- ===================================================================
-- 📄 17: دالة وصلاحيات تسليم الاشتراكات وتغيير حالة الطلب (Fulfill Order RPC)
-- ===================================================================
-- الهدف: السماح لمدير المتجر بحفظ بيانات الاشتراك (اسم المستخدم، كلمة السر،
-- رابط التفعيل) وتحديث حالة الطلب إلى 'fulfilled' بسلاسة وأمان بدون عوائق RLS.
-- ===================================================================

-- 1. إسقاط النسخ القديمة لتفادي تعارض أنواع المعاملات
DROP FUNCTION IF EXISTS public.fulfill_order_admin(UUID, TEXT, TEXT, TEXT, JSONB, UUID);
DROP FUNCTION IF EXISTS public.fulfill_order_admin(TEXT, TEXT, TEXT, TEXT, JSONB, UUID);
DROP FUNCTION IF EXISTS public.fulfill_order_admin(TEXT, TEXT, TEXT, TEXT, JSONB);

-- 2. إنشاء الدالة الشاملة (تقبل UUID أو نص رقم الطلب)
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
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود في قاعدة البيانات');
  END IF;
END;
$$;

-- 3. منح الصلاحية لتنفيذ الدالة
REVOKE ALL ON FUNCTION public.fulfill_order_admin(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_order_admin(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO anon, authenticated;
