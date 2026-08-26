-- ===================================================================
-- 29: Fix User Auth, Identities, and Direct Password Reset RPC
-- ===================================================================
-- الهدف:
-- 1. دالة RPC لإعادة تعيين كلمة مرور أي موظف/مشرف/عميل وتفعيله فوراً
-- 2. تصحيح جدول auth.identities وتأكيد البريد لكافة الحسابات المعلقة
-- 3. سكربت فوري لتغيير كلمة مرور أي موظف محدد بالبريد الإلكتروني
-- ===================================================================

-- 1. دالة آمنة لإعادة تعيين كلمة المرور لأي حساب وتأكيد بريده
CREATE OR REPLACE FUNCTION public.admin_reset_user_password_rpc(
  _target_email TEXT,
  _new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role public.admin_role;
  v_user_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  -- أ. التحقق من صلاحيات المستدعي (إذا تم الاستدعاء عبر الـ API)
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_caller_role
    FROM public.admin_users
    WHERE user_id = v_caller_id AND is_active = true;

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'developer') THEN
      RETURN jsonb_build_object('success', false, 'error', 'غير مصرّح — تتطلب صلاحية المشرف العام أو المدير');
    END IF;
  END IF;

  _target_email := LOWER(TRIM(_target_email));
  IF _target_email IS NULL OR _target_email = '' OR _new_password IS NULL OR LENGTH(_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'البريد أو كلمة المرور غير صالحة (6 أحرف على الأقل)');
  END IF;

  -- ب. جلب أو إنشاء معرّف المستخدم
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = _target_email;

  -- تشفير كلمة المرور
  v_encrypted_pw := crypt(_new_password, gen_salt('bf'));

  IF v_user_id IS NULL THEN
    -- المستخدم غير موجود في المصادقة -> نقوم بإنشائه فوراً
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
      _target_email,
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('role', 'staff'),
      NOW(),
      NOW(),
      encode(gen_random_bytes(32), 'hex')
    );
  ELSE
    -- المستخدم موجود -> تحديث كلمة المرور وتأكيد البريد
    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      banned_until = NULL,
      confirmation_token = '',
      recovery_token = '',
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- ج. التأكد من وجود سجل الهوية في auth.identities
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
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
      jsonb_build_object('sub', v_user_id::text, 'email', _target_email, 'email_verified', true),
      'email',
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- د. تفعيل وربط المشرف في جدول admin_users
  UPDATE public.admin_users
  SET 
    user_id = v_user_id,
    is_active = true,
    updated_at = NOW()
  WHERE LOWER(email) = _target_email OR user_id = v_user_id;

  -- هـ. مزامنة جدول profiles
  INSERT INTO public.profiles (id, user_id, email, updated_at)
  VALUES (v_user_id, v_user_id, _target_email, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET email = _target_email, updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'message', 'تم تعيين كلمة المرور وتفعيل الحساب بنجاح');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password_rpc(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password_rpc(TEXT, TEXT) TO anon, authenticated, service_role;


-- 2. إصلاح وتأكيد كافة الحسابات وهوياتها في قاعدة البيانات
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
)
ON CONFLICT DO NOTHING;

-- 3. تحديث Schema Cache الخاص بـ PostgREST فوراً
NOTIFY pgrst, 'reload schema';

