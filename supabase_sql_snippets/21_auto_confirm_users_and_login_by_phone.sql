-- ===================================================================
-- 📄 21: التفعيل التلقائي للمستخدمين + دعم تسجيل الدخول برقم الجوال (Auto-Confirm & Phone Login)
-- ===================================================================

-- 1. دالة وتريجر لتأكيد البريد تلقائياً عند إنشاء أي حساب جديد
CREATE OR REPLACE FUNCTION public.auto_confirm_new_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_auto_confirm_new_users ON auth.users;
CREATE TRIGGER tr_auto_confirm_new_users
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_new_users();


-- 2. تفعيل وتأكيد كل المستخدمين المسجلين حالياً فوراً
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;


-- 3. دالة متقدمة لجلب البريد عبر رقم الجوال بكافة الصيغ (الدولية والمحلية)
CREATE OR REPLACE FUNCTION public.get_email_by_phone(_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_digits TEXT;
BEGIN
  v_digits := regexp_replace(_phone, '[^0-9]', '', 'g');

  -- البحث في جدول profiles
  SELECT email INTO v_email
  FROM public.profiles
  WHERE phone = _phone 
     OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_digits
     OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE '%' || RIGHT(v_digits, 9)
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- البحث في جدول auth.users (metadata)
  SELECT email INTO v_email
  FROM auth.users
  WHERE (raw_user_meta_data->>'phone') = _phone
     OR regexp_replace(COALESCE(raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g') = v_digits
     OR regexp_replace(COALESCE(raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g') LIKE '%' || RIGHT(v_digits, 9)
  LIMIT 1;

  -- البحث في جدول orders لأي عميل استخدم نفس الرقم
  IF v_email IS NULL THEN
    SELECT customer_email INTO v_email
    FROM public.orders
    WHERE (customer_phone = _phone OR regexp_replace(COALESCE(customer_phone, ''), '[^0-9]', '', 'g') = v_digits)
      AND customer_email IS NOT NULL AND customer_email <> ''
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_by_phone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(TEXT) TO anon, authenticated, service_role;
