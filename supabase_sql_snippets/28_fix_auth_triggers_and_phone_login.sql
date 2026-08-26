-- ===================================================================
-- 28: Fix Auth Schema Error & Robust Phone Login for Admins/Customers
-- ===================================================================
-- الهدف:
-- 1. إزالة التريجرات التلقائية المسببة لخطأ (Database error querying schema) في auth.users
-- 2. ترقية دالة تسجيل الدخول بالهاتف get_email_by_phone لتشمل المدراء والعملاء وكافة الدول
-- 3. ضمان وصول وتحديث جدول profiles لجميع المشرفين والعملاء بدون أخطاء RLS
-- ===================================================================

-- 1. إزالة التريجر المسبب لخطأ GoTrue Database error
DROP TRIGGER IF EXISTS tr_sync_auth_user_phone ON auth.users;
DROP FUNCTION IF EXISTS public.sync_auth_user_phone();

-- 2. ترقية دالة البحث عن البريد برقم الجوال لتشمل المدراء والعملاء والأرقام الدولية
CREATE OR REPLACE FUNCTION public.get_email_by_phone(_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email TEXT;
  v_clean_phone TEXT;
  v_digits TEXT;
BEGIN
  IF _phone IS NULL OR TRIM(_phone) = '' THEN
    RETURN NULL;
  END IF;

  v_clean_phone := TRIM(_phone);
  v_digits := regexp_replace(v_clean_phone, '[^0-9]', '', 'g');

  -- أ. البحث في جدول المشرفين admin_users أولاً
  SELECT email INTO v_email
  FROM public.admin_users
  WHERE phone = v_clean_phone
     OR (phone IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') = v_digits)
     OR (LENGTH(v_digits) >= 9 AND phone IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%' || RIGHT(v_digits, 9))
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_email IS NOT NULL AND v_email <> '' THEN
    RETURN LOWER(TRIM(v_email));
  END IF;

  -- ب. البحث في جدول profiles
  SELECT email INTO v_email
  FROM public.profiles
  WHERE phone = v_clean_phone 
     OR (phone IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') = v_digits)
     OR (LENGTH(v_digits) >= 9 AND phone IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%' || RIGHT(v_digits, 9))
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_email IS NOT NULL AND v_email <> '' THEN
    RETURN LOWER(TRIM(v_email));
  END IF;

  -- ج. البحث في metadata للمستخدمين في auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE (raw_user_meta_data->>'phone') = v_clean_phone
     OR (phone = v_clean_phone)
     OR ((raw_user_meta_data->>'phone') IS NOT NULL AND regexp_replace(raw_user_meta_data->>'phone', '[^0-9]', '', 'g') = v_digits)
     OR (LENGTH(v_digits) >= 9 AND (raw_user_meta_data->>'phone') IS NOT NULL AND regexp_replace(raw_user_meta_data->>'phone', '[^0-9]', '', 'g') LIKE '%' || RIGHT(v_digits, 9))
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_email IS NOT NULL AND v_email <> '' THEN
    RETURN LOWER(TRIM(v_email));
  END IF;

  -- د. البحث في جدول الطلبات orders كإجراء أخير
  SELECT customer_email INTO v_email
  FROM public.orders
  WHERE (customer_phone = v_clean_phone OR regexp_replace(COALESCE(customer_phone, ''), '[^0-9]', '', 'g') = v_digits)
    AND customer_email IS NOT NULL AND customer_email <> ''
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_email IS NOT NULL AND v_email <> '' THEN
    RETURN LOWER(TRIM(v_email));
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_by_phone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(TEXT) TO anon, authenticated, service_role;

-- 3. ضمان سياسات RLS لجدول profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_own" ON public.profiles;
CREATE POLICY "profiles_read_own" ON public.profiles
FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role')
WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');
