-- ===================================================================
-- 📄 23: نسخ رقم الجوال إلى عمود Phone في لوحة مستخدمي Supabase
-- ===================================================================

-- 1. تريجر لنسخ رقم الجوال إلى حقل Phone في لوحة Supabase تلقائياً فور التسجيل
CREATE OR REPLACE FUNCTION public.sync_auth_user_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'phone' IS NOT NULL AND NEW.raw_user_meta_data->>'phone' <> '' THEN
    BEGIN
      NEW.phone := NEW.raw_user_meta_data->>'phone';
      NEW.phone_confirmed_at := COALESCE(NEW.phone_confirmed_at, NOW());
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_auth_user_phone ON auth.users;
CREATE TRIGGER tr_sync_auth_user_phone
BEFORE INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_auth_user_phone();


-- 2. تحديث عمود Phone لكل مستخدم على حدة بأمان مع تفادي التكرار
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, raw_user_meta_data->>'phone' AS u_phone 
           FROM auth.users 
           WHERE (raw_user_meta_data->>'phone') IS NOT NULL 
             AND (raw_user_meta_data->>'phone') <> '' 
  LOOP
    BEGIN
      UPDATE auth.users
      SET phone = r.u_phone,
          phone_confirmed_at = COALESCE(phone_confirmed_at, NOW())
      WHERE id = r.id;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;
