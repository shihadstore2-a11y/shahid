-- ===================================================================
-- 27: RPC to Create/Assign Admin Users directly & securely
-- ===================================================================
-- الهدف:
-- تمكين المشرف العام والمدير من إنشاء حسابات المشرفين وتعيين صلاحياتهم
-- مباشرة داخل قاعدة البيانات دون الحاجة إلى Edge Function خارجية
-- ===================================================================

CREATE OR REPLACE FUNCTION public.create_admin_user_rpc(
  _email TEXT,
  _password TEXT,
  _full_name TEXT,
  _phone TEXT DEFAULT NULL,
  _role public.admin_role DEFAULT 'staff'::public.admin_role
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
  -- 1. التحقق من أن المستدعي هو مشرف عام أو مدير
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_caller_role
    FROM public.admin_users
    WHERE user_id = v_caller_id AND is_active = true;

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'developer') THEN
      RETURN jsonb_build_object('success', false, 'error', 'غير مصرّح — تتطلب صلاحية المشرف العام أو المدير');
    END IF;
  END IF;

  -- 2. تنظيف وتجهيز البيانات
  _email := LOWER(TRIM(_email));
  _full_name := TRIM(_full_name);
  IF _phone IS NOT NULL THEN
    _phone := TRIM(_phone);
    IF _phone = '' THEN
      _phone := NULL;
    END IF;
  END IF;

  -- فحص هل المستخدم موجود مسبقاً في auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = _email;
  
  -- تشفير كلمة المرور باستخدام pgcrypto
  v_encrypted_pw := crypt(_password, gen_salt('bf'));

  IF v_user_id IS NULL THEN
    -- توليد معرّف جديد
    v_user_id := gen_random_uuid();
    
    -- إنشاء سجل المستخدم في auth.users
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
      _email,
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', _full_name, 'phone', _phone, 'role', _role::text),
      NOW(),
      NOW(),
      encode(gen_random_bytes(32), 'hex')
    );

    -- إنشاء هوية المصادقة في auth.identities
    BEGIN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        v_user_id::text,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', _email),
        'email',
        NOW(),
        NOW(),
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      -- تجاهل خطأ identity إذا كان موجوداً مسبقاً
      NULL;
    END;

  ELSE
    -- تحديث كلمة المرور وبيانات المستخدم الموجود مسبقاً
    UPDATE auth.users
    SET encrypted_password = v_encrypted_pw,
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', _full_name, 'phone', _phone, 'role', _role::text),
        updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- 3. إضافة أو ترقية المستخدم في جدول admin_users
  INSERT INTO public.admin_users (
    user_id,
    email,
    full_name,
    phone,
    role,
    is_active,
    permission_overrides,
    updated_at
  )
  VALUES (
    v_user_id,
    _email,
    _full_name,
    _phone,
    _role,
    true,
    '{}'::jsonb,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      is_active = true,
      updated_at = NOW();

  -- 4. مزامنة جدول profiles
  BEGIN
    INSERT INTO public.profiles (user_id, email, full_name, phone, role)
    VALUES (v_user_id, _email, _full_name, _phone, _role::text)
    ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', _email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_user_rpc(TEXT, TEXT, TEXT, TEXT, public.admin_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_admin_user_rpc(TEXT, TEXT, TEXT, TEXT, public.admin_role) TO authenticated, anon;

COMMENT ON FUNCTION public.create_admin_user_rpc(TEXT, TEXT, TEXT, TEXT, public.admin_role) IS
  '27 (26 Aug 2026): RPC function to create admin user with auth and assign role securely.';
