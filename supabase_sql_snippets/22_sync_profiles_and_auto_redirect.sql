-- ===================================================================
-- 📄 22: المزامنة التلقائية لملفات المستخدمين (Sync User Profiles & Metadata)
-- ===================================================================

-- 1. دالة وتريجر لنسخ الاسم ورقم الجوال إلى جدول profiles فور التسجيل
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_phone TEXT;
  v_name TEXT;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, '');

  BEGIN
    INSERT INTO public.profiles (id, user_id, full_name, phone, email, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.id,
      v_name,
      v_phone,
      NEW.email,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
        phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE public.profiles.phone END,
        email = EXCLUDED.email,
        updated_at = NOW();
  EXCEPTION
    -- في حال كان رقم الجوال مكرراً لحساب آخر
    WHEN unique_violation THEN
      INSERT INTO public.profiles (id, user_id, full_name, phone, email, created_at, updated_at)
      VALUES (
        NEW.id,
        NEW.id,
        v_name,
        '',
        NEW.email,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
          email = EXCLUDED.email,
          updated_at = NOW();
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_on_auth_user_created ON auth.users;
CREATE TRIGGER tr_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();


-- 2. مزامنة بيانات المستخدمين الحالية بأمان لكل مستخدم على حدة
DO $$
DECLARE
  u RECORD;
  v_name TEXT;
  v_phone TEXT;
BEGIN
  FOR u IN SELECT id, email, raw_user_meta_data, phone FROM auth.users LOOP
    v_name := COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '');
    v_phone := COALESCE(u.raw_user_meta_data->>'phone', u.phone, '');

    BEGIN
      INSERT INTO public.profiles (id, user_id, full_name, phone, email, created_at, updated_at)
      VALUES (u.id, u.id, v_name, v_phone, u.email, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET full_name = CASE WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
          phone = CASE WHEN public.profiles.phone IS NULL OR public.profiles.phone = '' THEN EXCLUDED.phone ELSE public.profiles.phone END,
          email = EXCLUDED.email,
          updated_at = NOW();
    EXCEPTION
      WHEN unique_violation THEN
        UPDATE public.profiles
        SET full_name = CASE WHEN full_name IS NULL OR full_name = '' THEN v_name ELSE full_name END,
            email = u.email,
            updated_at = NOW()
        WHERE id = u.id OR user_id = u.id;
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;


-- 3. فتح صلاحية القراءة والتعديل على جدول profiles
DROP POLICY IF EXISTS "profiles_self_access" ON public.profiles;
CREATE POLICY "profiles_self_access" ON public.profiles
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
