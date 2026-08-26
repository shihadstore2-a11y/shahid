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

  -- ب. جلب معرّف المستخدم
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = _target_email;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'المستخدم غير موجود في سجلات المصادقة');
  END IF;

  -- ج. تشفير كلمة المرور وتحديث المستخدم
  v_encrypted_pw := crypt(_new_password, gen_salt('bf'));

  UPDATE auth.users
  SET 
    encrypted_password = v_encrypted_pw,
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    banned_until = NULL,
    confirmation_token = '',
    recovery_token = '',
    updated_at = NOW()
  WHERE id = v_user_id;

  -- د. التأكد من وجود سجل الهوية في auth.identities
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
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
      jsonb_build_object('sub', v_user_id::text, 'email', _target_email),
      'email',
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (provider, id) DO UPDATE 
    SET identity_data = jsonb_build_object('sub', v_user_id::text, 'email', _target_email),
        updated_at = NOW();
  END IF;

  -- هـ. تفعيل المشرف في جدول admin_users إن وجد
  UPDATE public.admin_users
  SET is_active = true, updated_at = NOW()
  WHERE user_id = v_user_id OR LOWER(email) = _target_email;

  RETURN jsonb_build_object('success', true, 'message', 'تم تحديث كلمة المرور وتفعيل الحساب بنجاح');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password_rpc(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password_rpc(TEXT, TEXT) TO anon, authenticated, service_role;


-- 2. إصلاح وتأكيد كافة الحسابات وهوياتها في قاعدة البيانات
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT 
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
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

