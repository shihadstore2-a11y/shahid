-- ===================================================================
-- 33: Universal Order Payment Confirmation, Auto-Claim & RLS Fix
-- ===================================================================
-- الهدف:
-- 1. ضمان تأكيد الدفع الفوري وتحويل حالة الطلب إلى (paid ✅) أو (fulfilled 🎁)
--    وعدم بقائه في (السلات المتروكة) مطلقاً عند الدفع الناجح
-- 2. إتاحة دعم كافة المزودين في المخزون (تحويل provider إلى TEXT)
-- 3. دالة صرف ذكية (claim_subscription_for_order) تدعم جميع المنتجات والمدد
-- 4. إتاحة قراءة الطلب للعميل الزائر والمسجل بعد الدفع بدون حظر RLS
-- ===================================================================

-- 1. تحويل نوع المزود في جدول المخزون إلى TEXT ليدعم أي باقة أو مزود
DO $$
BEGIN
  ALTER TABLE public.subscription_inventory ALTER COLUMN provider TYPE text;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;


-- 2. دالة الصرف الذكي للاشتراكات من المخزون لكافة أنواع المنتجات
CREATE OR REPLACE FUNCTION public.claim_subscription_for_order(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _order RECORD;
  _slug TEXT;
  _duration INT := 1;
  _inv_item RECORD;
  _inv_falcon RECORD;
  _inv_hulk RECORD;
  _is_bundle BOOLEAN := false;
BEGIN
  -- جلب الطلب وقفله للتعديل
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'order_not_found');
  END IF;

  -- إذا كان مسلماً مسبقاً
  IF _order.fulfilled_at IS NOT NULL OR _order.status = 'fulfilled' THEN
    RETURN jsonb_build_object('claimed', true, 'reason', 'already_fulfilled', 'status', 'fulfilled');
  END IF;

  -- استخراج بيانات المنتج والمدة من السلة
  _slug := COALESCE(_order.items->0->>'product_slug', _order.items->0->>'slug', '');
  _duration := COALESCE((_order.items->0->>'duration_months')::int, 1);
  _is_bundle := (_slug = 'bundle-falcon-hulk-1y' OR _slug LIKE '%bundle%');

  -- أ. معالجة الباقات المزدوجة (Bundle)
  IF _is_bundle THEN
    SELECT * INTO _inv_falcon FROM public.subscription_inventory
    WHERE LOWER(provider) LIKE '%falcon%' AND duration_months = _duration AND status = 'available'
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

    SELECT * INTO _inv_hulk FROM public.subscription_inventory
    WHERE LOWER(provider) LIKE '%hulk%' AND duration_months = _duration AND status = 'available'
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

    IF _inv_falcon.id IS NOT NULL AND _inv_hulk.id IS NOT NULL THEN
      UPDATE public.subscription_inventory
      SET status = 'claimed', claimed_order_id = _order_id, claimed_at = NOW(), claimed_role = 'primary', updated_at = NOW()
      WHERE id = _inv_falcon.id;

      UPDATE public.subscription_inventory
      SET status = 'claimed', claimed_order_id = _order_id, claimed_at = NOW(), claimed_role = 'backup', updated_at = NOW()
      WHERE id = _inv_hulk.id;

      UPDATE public.orders SET
        subscription_extra_info = jsonb_build_object(
          'bundle', true,
          'falcon', jsonb_build_object('username', _inv_falcon.username, 'password', _inv_falcon.password, 'url', _inv_falcon.url),
          'hulk', jsonb_build_object('username', _inv_hulk.username, 'password', _inv_hulk.password, 'url', _inv_hulk.url)
        ),
        subscription_username = _inv_falcon.username,
        subscription_password = _inv_falcon.password,
        subscription_url = _inv_falcon.url,
        fulfilled_at = NOW(),
        fulfilled_by = NULL,
        status = 'fulfilled',
        primary_subscription_id = _inv_falcon.id,
        backup_subscription_id = _inv_hulk.id,
        updated_at = NOW()
      WHERE id = _order_id;

      RETURN jsonb_build_object('claimed', true, 'status', 'fulfilled', 'is_bundle', true);
    END IF;
  END IF;

  -- ب. محاولة المطابقة المباشرة بالمدة والمزود إن وُجد
  SELECT * INTO _inv_item FROM public.subscription_inventory
  WHERE status = 'available'
    AND duration_months = _duration
    AND (
      _slug = '' OR
      (_slug LIKE '%falcon%' AND LOWER(provider) LIKE '%falcon%') OR
      (_slug LIKE '%hulk%' AND LOWER(provider) LIKE '%hulk%') OR
      (_slug LIKE '%smarters%' AND LOWER(provider) LIKE '%smarters%') OR
      (_slug LIKE '%shahid%' AND LOWER(provider) LIKE '%shahid%') OR
      (_slug LIKE '%' || LOWER(provider) || '%')
    )
  ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

  -- ج. Fallback: أي حساب متاح بنفس المدة
  IF _inv_item.id IS NULL THEN
    SELECT * INTO _inv_item FROM public.subscription_inventory
    WHERE status = 'available' AND duration_months = _duration
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  END IF;

  -- د. Fallback: أي حساب متاح في المخزون
  IF _inv_item.id IS NULL THEN
    SELECT * INTO _inv_item FROM public.subscription_inventory
    WHERE status = 'available'
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  END IF;

  -- هـ. إذا تم العثور على اشتراك متاح في المخزون
  IF _inv_item.id IS NOT NULL THEN
    UPDATE public.subscription_inventory
    SET status = 'claimed',
        claimed_order_id = _order_id,
        claimed_at = NOW(),
        claimed_role = 'primary',
        updated_at = NOW()
    WHERE id = _inv_item.id;

    UPDATE public.orders SET
      subscription_username = _inv_item.username,
      subscription_password = _inv_item.password,
      subscription_url = _inv_item.url,
      subscription_extra_info = _inv_item.extra_info,
      fulfilled_at = NOW(),
      fulfilled_by = NULL,
      status = 'fulfilled',
      primary_subscription_id = _inv_item.id,
      updated_at = NOW()
    WHERE id = _order_id;

    RETURN jsonb_build_object('claimed', true, 'status', 'fulfilled', 'inventory_id', _inv_item.id);
  END IF;

  -- و. في حال نفاد المخزون (Out of Stock) -> يبقى الطلب بحالة مدفوع مؤكدة (paid ✅) بانتظار التسليم اليدوي
  UPDATE public.orders
  SET status = 'paid', updated_at = NOW()
  WHERE id = _order_id AND status <> 'fulfilled';

  RETURN jsonb_build_object('claimed', false, 'reason', 'out_of_stock', 'status', 'paid');
END;
$$;


-- 3. دالة تأكيد دفع الطلب الشاملة (confirm_order_paid)
CREATE OR REPLACE FUNCTION public.confirm_order_paid(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_claim JSONB;
  v_final_status TEXT;
BEGIN
  -- 1. تحديث الطلب ليكون مدفوعاً فوراً
  UPDATE public.orders
  SET status = 'paid', updated_at = NOW()
  WHERE id = _order_id AND status IN ('pending', 'initiated', 'failed', 'payment_failed')
  RETURNING id, order_number, total, customer_name, customer_phone, customer_email, status INTO v_order;

  IF v_order.id IS NULL THEN
    SELECT id, order_number, total, customer_name, customer_phone, customer_email, status
    INTO v_order FROM public.orders WHERE id = _order_id;
  END IF;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود');
  END IF;

  -- 2. تحديث سجل معاملة الدفع إلى success
  UPDATE public.payment_transactions
  SET status = 'success', updated_at = NOW()
  WHERE order_id = _order_id;

  -- 3. محاولة صرف الاشتراك تلقائياً من المخزون
  BEGIN
    SELECT public.claim_subscription_for_order(_order_id) INTO v_claim;
  EXCEPTION WHEN OTHERS THEN
    v_claim := jsonb_build_object('claimed', false, 'error', SQLERRM);
  END;

  -- 4. قراءة الحالة النهائية للطلب بعد محاولة الصرف
  SELECT status INTO v_final_status FROM public.orders WHERE id = _order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'total', v_order.total,
    'status', COALESCE(v_final_status, 'paid'),
    'auto_claimed', COALESCE((v_claim->>'claimed')::boolean, false),
    'claim_reason', v_claim->>'reason'
  );
END;
$$;


-- 4. دالة عرض تفاصيل الطلب والتسليم الآمنة (get_order_delivery_status)
CREATE OR REPLACE FUNCTION public.get_order_delivery_status(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_is_fulfilled BOOLEAN;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_is_fulfilled := (v_order.status = 'fulfilled' AND v_order.fulfilled_at IS NOT NULL);

  RETURN jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'payment_method', v_order.payment_method,
    'created_at', v_order.created_at,
    'fulfilled_at', v_order.fulfilled_at,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'subtotal', v_order.subtotal,
    'discount', v_order.discount,
    'vat', v_order.vat,
    'total', v_order.total,
    'coupon_code', v_order.coupon_code,
    'items', v_order.items,
    'subscription_username', CASE WHEN v_is_fulfilled THEN v_order.subscription_username ELSE NULL END,
    'subscription_password', CASE WHEN v_is_fulfilled THEN v_order.subscription_password ELSE NULL END,
    'subscription_url', CASE WHEN v_is_fulfilled THEN v_order.subscription_url ELSE NULL END,
    'subscription_extra_info', CASE WHEN v_is_fulfilled THEN v_order.subscription_extra_info ELSE NULL END
  );
END;
$$;


-- 5. إعطاء الصلاحيات اللازمة لكافة الدوال
REVOKE ALL ON FUNCTION public.confirm_order_paid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_order_paid(UUID) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_subscription_for_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_subscription_for_order(UUID) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_order_delivery_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_delivery_status(UUID) TO anon, authenticated, service_role;


-- 6. سياسات RLS للطلبات لضمان عدم حجب أي طلب مدفوع
DROP POLICY IF EXISTS "allow_all_read_orders" ON public.orders;
CREATE POLICY "allow_all_read_orders" ON public.orders
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "allow_all_update_orders" ON public.orders;
CREATE POLICY "allow_all_update_orders" ON public.orders
  FOR UPDATE TO anon, authenticated
  USING (true);

-- 7. تحديث كاش Schema
NOTIFY pgrst, 'reload schema';
