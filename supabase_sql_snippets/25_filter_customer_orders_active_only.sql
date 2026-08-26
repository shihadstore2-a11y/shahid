-- ===================================================================
-- 25: Filter customer profile orders (Exclude pending/initiated checkouts)
-- ===================================================================
-- الهدف:
-- لا تُعرض للعميل في حسابه الطلبات التي بدأها ولم يكمل دفعها (pending / initiated)
-- تُعرض فقط الطلبات الحقيقية المكتملة أو الملغاة: paid, fulfilled, refunded, cancelled
-- ===================================================================

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

  -- إرجاع الطلبات الحقيقية فقط (استبعاد pending و initiated)
  RETURN QUERY
  SELECT * FROM public.orders
  WHERE (
    (user_id IS NOT NULL AND user_id = _user_id)
    OR (_email IS NOT NULL AND _email <> '' AND LOWER(customer_email) = LOWER(_email))
    OR (_phone IS NOT NULL AND _phone <> '' AND customer_phone = _phone)
  )
  AND status IN ('paid', 'fulfilled', 'refunded', 'cancelled')
  ORDER BY created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_customer_orders(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_customer_orders(UUID, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_my_customer_orders(UUID, TEXT, TEXT) IS
  '25 (26 Aug 2026): Returns customer orders excluding unpaid checkouts (pending/initiated).';
