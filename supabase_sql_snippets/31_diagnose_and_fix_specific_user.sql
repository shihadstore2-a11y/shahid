-- ===================================================================
-- 31: Clean Repair for meramustafa126@gmail.com
-- ===================================================================

DO $$
DECLARE
  v_target_email TEXT := 'meramustafa126@gmail.com';
  v_new_password TEXT := 'Mera@123456';
  v_user_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  -- 1. تشفير كلمة المرور الجديدة
  v_encrypted_pw := crypt(v_new_password, gen_salt('bf'));

  -- 2. البحث عن معرّف المستخدم إن كان موجوداً مسبقاً
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(v_target_email);

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      LOWER(v_target_email),
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Mera Mustafa', 'role', 'staff'),
      NOW(),
      NOW(),
      encode(gen_random_bytes(32), 'hex')
    );
  ELSE
    -- فك أي حظر أو توكنات معلقة وتأكيد البريد وتحديث كلمة المرور
    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = NOW(),
      banned_until = NULL,
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- 3. تنظيف وإعادة بناء هوية المصادقة في auth.identities
  DELETE FROM auth.identities WHERE user_id = v_user_id OR identity_data->>'email' = LOWER(v_target_email);

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', LOWER(v_target_email), 'email_verified', true),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- 4. تحديث أو إدراج الحساب في جدول المشرفين admin_users
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE LOWER(email) = LOWER(v_target_email) OR user_id = v_user_id) THEN
    UPDATE public.admin_users
    SET user_id = v_user_id,
        role = 'staff',
        is_active = true,
        updated_at = NOW()
    WHERE LOWER(email) = LOWER(v_target_email) OR user_id = v_user_id;
  ELSE
    INSERT INTO public.admin_users (id, user_id, email, full_name, role, is_active, updated_at)
    VALUES (gen_random_uuid(), v_user_id, LOWER(v_target_email), 'Mera Mustafa', 'staff', true, NOW());
  END IF;

  -- 5. مزامنة الملف الشخصي في profiles
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_user_id OR LOWER(email) = LOWER(v_target_email)) THEN
    UPDATE public.profiles
    SET email = LOWER(v_target_email),
        full_name = COALESCE(full_name, 'Mera Mustafa'),
        updated_at = NOW()
    WHERE user_id = v_user_id OR LOWER(email) = LOWER(v_target_email);
  ELSE
    INSERT INTO public.profiles (id, user_id, email, full_name, updated_at)
    VALUES (v_user_id, v_user_id, LOWER(v_target_email), 'Mera Mustafa', NOW());
  END IF;

  RAISE NOTICE '✅ تم إصلاح وتفعيل حساب % بنجاح بكلمة المرور %', v_target_email, v_new_password;
END;
$$;
