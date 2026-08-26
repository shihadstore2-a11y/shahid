-- ===================================================================
-- 32: Deep Clean & Standard GoTrue Registration for meramustafa126@gmail.com
-- ===================================================================

DO $$
DECLARE
  v_target_email TEXT := 'meramustafa126@gmail.com';
  v_new_password TEXT := 'Mera@123456';
  v_user_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  -- 1. توليد تشفير Bcrypt قياسي (10 جولات متوافق تماماً مع GoTrue)
  v_encrypted_pw := crypt(v_new_password, gen_salt('bf', 10));

  -- 2. جلب أو توليد معرّف المستخدم
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(v_target_email);
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
  END IF;

  -- 3. تنظيف أي جلسات أو هويات أو توكنات تالفة مسبقة مرتبطة بهذا الحساب
  DELETE FROM auth.sessions WHERE user_id = v_user_id;
  DELETE FROM auth.refresh_tokens WHERE session_id NOT IN (SELECT id FROM auth.sessions);
  DELETE FROM auth.mfa_factors WHERE user_id = v_user_id;
  DELETE FROM auth.identities WHERE user_id = v_user_id OR identity_data->>'email' = LOWER(v_target_email);

  -- 4. إدراج أو تحديث المستخدم في auth.users بكافة الحقول القياسية المطلوبة لـ Supabase GoTrue
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = NOW(),
      banned_until = NULL,
      reauthentication_token = '',
      confirmation_token = '',
      recovery_token = '',
      email_change = '',
      email_change_token_new = '',
      email_change_token_current = '',
      phone = NULL,
      phone_confirmed_at = NULL,
      phone_change = '',
      phone_change_token = '',
      is_super_admin = false,
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = '{"full_name":"Mera Mustafa","name":"Mera Mustafa"}'::jsonb,
      updated_at = NOW()
    WHERE id = v_user_id;
  ELSE
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      invited_at,
      confirmation_token,
      confirmation_sent_at,
      recovery_token,
      recovery_sent_at,
      email_change_token_new,
      email_change,
      email_change_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at,
      phone_change,
      phone_change_token,
      phone_change_sent_at,
      email_change_token_current,
      email_change_confirm_status,
      banned_until,
      reauthentication_token,
      reauthentication_sent_at,
      is_sso_user,
      deleted_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      LOWER(v_target_email),
      v_encrypted_pw,
      NOW(),
      NULL,
      '',
      NULL,
      '',
      NULL,
      '',
      '',
      NULL,
      NULL,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Mera Mustafa","name":"Mera Mustafa"}'::jsonb,
      false,
      NOW(),
      NOW(),
      NULL,
      NULL,
      '',
      '',
      NULL,
      '',
      0,
      NULL,
      '',
      NULL,
      false,
      NULL
    );
  END IF;

  -- 5. إنشاء هوية الدخول في auth.identities بالصيغة المتوافقة بدقة
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
    jsonb_build_object('sub', v_user_id::text, 'email', LOWER(v_target_email), 'email_verified', true, 'phone_verified', false),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- 6. تحديث جدول المشرفين admin_users وتفعيله
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE LOWER(email) = LOWER(v_target_email) OR user_id = v_user_id) THEN
    UPDATE public.admin_users
    SET user_id = v_user_id,
        full_name = 'Mera Mustafa',
        role = 'staff',
        is_active = true,
        updated_at = NOW()
    WHERE LOWER(email) = LOWER(v_target_email) OR user_id = v_user_id;
  ELSE
    INSERT INTO public.admin_users (id, user_id, email, full_name, role, is_active, updated_at)
    VALUES (gen_random_uuid(), v_user_id, LOWER(v_target_email), 'Mera Mustafa', 'staff', true, NOW());
  END IF;

  -- 7. تحديث جدول profiles
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_user_id OR LOWER(email) = LOWER(v_target_email)) THEN
    UPDATE public.profiles
    SET email = LOWER(v_target_email),
        full_name = 'Mera Mustafa',
        updated_at = NOW()
    WHERE user_id = v_user_id OR LOWER(email) = LOWER(v_target_email);
  ELSE
    INSERT INTO public.profiles (id, user_id, email, full_name, updated_at)
    VALUES (v_user_id, v_user_id, LOWER(v_target_email), 'Mera Mustafa', NOW());
  END IF;

  RAISE NOTICE '✅ تم إصلاح وتهيئة حساب % بنجاح تام!', v_target_email;
END;
$$;
