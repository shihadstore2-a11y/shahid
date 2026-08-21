DO $$
DECLARE
  _uid uuid;
  _email text := 'claude-audit@rifd.site';
  _password text := 'Audit-Claude-2026-Full-Access-X9k';
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = _email;

  IF _uid IS NULL THEN
    _uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _uid, 'authenticated', 'authenticated', _email,
      crypt(_password, gen_salt('bf')), now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('full_name','Claude Audit Reviewer'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), _uid, _uid::text,
      jsonb_build_object('sub', _uid::text, 'email', _email, 'email_verified', true),
      'email', now(), now(), now()
    );
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt(_password, gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = _uid;
  END IF;

  -- تجاوز الـ trigger الحامي للخطة (نحن في سياق migration موثوق)
  ALTER TABLE public.profiles DISABLE TRIGGER USER;

  INSERT INTO public.profiles (
    id, email, full_name, plan, onboarded,
    store_name, audience, product_type, tone, brand_color,
    brand_personality, unique_selling_point, cta_style, whatsapp
  ) VALUES (
    _uid, _email, 'Claude Audit Reviewer', 'pro'::user_plan, true,
    'متجر المراجعة التجريبي', 'تجار سعوديون 25-45',
    'منتجات استهلاكية متنوعة', 'ودود ومحترف', '#1a5d3e',
    'موثوق وسريع', 'جودة عالية وتوصيل سريع', 'اطلب الآن',
    '966500000099'
  )
  ON CONFLICT (id) DO UPDATE SET
    plan = 'pro'::user_plan,
    onboarded = true,
    full_name = EXCLUDED.full_name,
    store_name = EXCLUDED.store_name,
    audience = EXCLUDED.audience,
    product_type = EXCLUDED.product_type,
    tone = EXCLUDED.tone,
    updated_at = now();

  ALTER TABLE public.profiles ENABLE TRIGGER USER;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'admin'::app_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (_uid, 5000, 5000, now(), now() + interval '365 days')
  ON CONFLICT (user_id) DO UPDATE SET
    plan_credits = 5000,
    topup_credits = 5000,
    cycle_ends_at = now() + interval '365 days',
    updated_at = now();

  INSERT INTO public.credit_ledger (user_id, txn_type, amount, source, balance_after_plan, balance_after_topup, metadata)
  VALUES (_uid, 'plan_grant', 10000, 'plan', 5000, 5000,
          jsonb_build_object('reason','claude_audit_account','grant_type','full_access'));

  RAISE NOTICE 'Claude audit account ready: %', _uid;
END $$;