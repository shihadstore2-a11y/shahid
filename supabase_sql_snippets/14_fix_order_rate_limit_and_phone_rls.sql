-- ===================================================================
-- 📄 14: إصلاح قيود الطلبات ورقم الجوال والحد الزمني (Order Rate Limit & Phone Fix)
-- ===================================================================
-- المشكلة:
-- 1. جدول order_rate_limits وتريجر check_order_rate_limit_trigger كان يحظر 
--    أي محاولة طلب جديدة من نفس الرقم لمدة 5 دقائق كاملة، مما يمنع الزبون 
--    أو صاحب المتجر من إعادة المحاولة عند حدوث أي خطأ في الدفع.
-- 2. سياسة RLS القديمة كانت تشترط فقط الأرقام السعودية بصيغة 05xxxxxxxx
--    بينما المتجر يدعم البطاقات والأرقام الدولية (+966...).
-- ===================================================================

-- 1. تفريغ جدول الحد الزمني لفك الحظر فوراً عن الأرقام المحظورة حالياً
TRUNCATE TABLE public.order_rate_limits;

-- 2. تحديث دالة فحص الحد الزمني لتكون 10 ثوانٍ فقط (لمنع النقر المزدوج السريع) بدل 5 دقائق
CREATE OR REPLACE FUNCTION public.check_order_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- حماية خفيفة فقط ضد النقر المزدوج المتكرر (10 ثوانٍ بدلاً من 5 دقائق)
  IF EXISTS (
    SELECT 1 FROM public.order_rate_limits
    WHERE phone = NEW.customer_phone
      AND last_order_at > NOW() - INTERVAL '10 seconds'
  ) THEN
    RAISE EXCEPTION 'يرجى الانتظار بضع ثوانٍ قبل إعادة إرسال الطلب'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.order_rate_limits (phone, last_order_at, count_24h)
  VALUES (NEW.customer_phone, NOW(), 1)
  ON CONFLICT (phone) DO UPDATE
    SET last_order_at = NOW(),
        count_24h = public.order_rate_limits.count_24h + 1;

  RETURN NEW;
END;
$$;

-- 3. تحديث سياسة إدخال الطلبات (RLS) لتقبل جميع صيغ أرقام الهواتف (سعودية ودولية)
DROP POLICY IF EXISTS orders_anon_insert ON public.orders;
DROP POLICY IF EXISTS orders_public_insert ON public.orders;
DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "public_can_create_orders" ON public.orders;

CREATE POLICY "public_can_create_orders" ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    customer_name IS NOT NULL
    AND length(btrim(customer_name)) >= 2
    AND customer_phone IS NOT NULL
    AND length(btrim(customer_phone)) >= 8
    AND total > 0
    AND jsonb_typeof(items) = 'array'
    AND status = 'pending'
  );
