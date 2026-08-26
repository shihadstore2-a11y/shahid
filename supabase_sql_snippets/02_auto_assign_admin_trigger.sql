-- ===================================================================
-- 📄 02: تريجر ودالة التسجيل التلقائي (Auto Assign Admin & Free Plan Trigger)
-- الوصف: دالة وتريجر handle_new_user الذي ينفذ تلقائياً عند تسجيل أي مستخدم:
--       - يمنح دور "admin" إذا كان البريد هو digitaneo@gmail.com
--       - يمنح دور "user" لبقية أصحاب المتاجر والعملاء
--       - ينشئ ملف profile ويفعله تلقائياً (onboarded = true)
--       - يشحن رصيد النقاط المجاني الأولي (50 نقطة)
-- ===================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credits integer;
BEGIN
  -- 1. إنشاء ملف المستخدم وتخطي صفحة الـ Onboarding فوراً
  INSERT INTO public.profiles (id, email, full_name, onboarded, onboarding_completed_at)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    true, now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. تعيين الصلاحية: أدمن للمؤسس، ومستخدم عادي لبقية التجار
  IF LOWER(NEW.email) = 'digitaneo@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  -- 3. تحديد رصيد الخطة المجانية الأولية
  SELECT monthly_credits INTO _credits FROM public.plan_credits WHERE plan = 'free'::user_plan;
  IF _credits IS NULL THEN _credits := 50; END IF;

  -- 4. إيداع رصيد النقاط في محفظة المستخدم
  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
