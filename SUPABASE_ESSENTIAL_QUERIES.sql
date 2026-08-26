-- ===================================================================
-- 📜 ملف الاستعلامات الأساسية لقواعد بيانات المنصة والمتجر (Supabase SQL)
-- مشروع: منصة شاهد (Shahid Platform) ومتجر شاهد (Shahid Store)
-- المرجع الشامل للإعدادات، الصلاحيات، الحسابات وسياسات الأمان
-- ===================================================================

-- ===================================================================
-- 1️⃣ إعدادات حساب أدمن المنصة الأم (Platform Founder Admin)
-- ===================================================================

-- 1.1 منح دور الأدمن للمنصة الأم لبريد digitaneo@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE LOWER(email) = 'digitaneo@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 1.2 تحديث التريجر التلقائي ليمنح صلاحية الأدمن لبريدك digitaneo@gmail.com تلقائياً عند أي تسجيل
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credits integer;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, onboarded, onboarding_completed_at)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    true, now()
  )
  ON CONFLICT (id) DO NOTHING;

  IF LOWER(NEW.email) = 'digitaneo@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  SELECT monthly_credits INTO _credits FROM public.plan_credits WHERE plan = 'free'::user_plan;
  IF _credits IS NULL THEN _credits := 50; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


-- ===================================================================
-- 2️⃣ إعدادات أصحاب المتاجر وتخطي Onboarding والنقاط الأولية
-- ===================================================================

-- 2.1 تفعيل الدخول المباشر لجميع المستخدمين وأصحاب المتاجر الحاليين
UPDATE public.profiles
SET onboarded = true, onboarding_completed_at = now();

-- 2.2 جعل أي مستخدم أو صاحب متجر جديد يُسجّل يدخل للوحة التحكم مباشرة مستقبلاً
ALTER TABLE public.profiles ALTER COLUMN onboarded SET DEFAULT true;

-- 2.3 التأكد من أن جميع الحسابات تمتلك رصيد النقاط الأولي (50 نقطة)
INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
SELECT id, 50, 0, now(), now() + interval '30 days'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;


-- ===================================================================
-- 3️⃣ إدارة حسابات مديري المتجر (Shahid Store Admins)
-- ===================================================================

-- 3.1 تعيين مدير جديد لمتجر (بعد إضافته من زر Add User في Supabase Auth)
-- (استبدل البريد والاسم بالبيانات المطلوبة)
INSERT INTO public.admin_users (user_id, role, full_name, email, is_active)
SELECT id, 'super_admin'::public.admin_role, 'ثامر', email, true
FROM auth.users
WHERE LOWER(email) = 'iiithamer17@gmail.com'
ON CONFLICT (user_id) DO UPDATE 
SET role = 'super_admin'::public.admin_role, 
    email = EXCLUDED.email, 
    full_name = EXCLUDED.full_name, 
    is_active = true;

-- 3.2 إزالة صلاحية إدارة المتجر عن مدير سابق (عند الاستبدال)
DELETE FROM public.admin_users
WHERE LOWER(email) = 'thamer@shahidstore.net';


-- ===================================================================
-- 4️⃣ سياسات الأمان (RLS) لجدول المنتجات (إضافة، تعديل، حذف)
-- ===================================================================

-- 4.1 السماح لمدير المتجر بإضافة منتجات جديدة
DROP POLICY IF EXISTS "admin_can_insert_products" ON public.products;
CREATE POLICY "admin_can_insert_products" ON public.products
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- 4.2 السماح لمدير المتجر بتعديل المنتجات
DROP POLICY IF EXISTS "admin_can_update_products" ON public.products;
CREATE POLICY "admin_can_update_products" ON public.products
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 4.3 السماح لمدير المتجر بحذف المنتجات
DROP POLICY IF EXISTS "admin_can_delete_products" ON public.products;
CREATE POLICY "admin_can_delete_products" ON public.products
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 4.4 السماح للعامة والزوار بقراءة وتصفح المنتجات في المتجر
DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products
FOR SELECT
USING (true);


-- ===================================================================
-- 5️⃣ سياسات الأمان (RLS) لجدول الكوبونات (Coupons)
-- ===================================================================

DROP POLICY IF EXISTS "admin_can_read_coupons" ON public.coupons;
CREATE POLICY "admin_can_read_coupons" ON public.coupons 
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_can_insert_coupons" ON public.coupons;
CREATE POLICY "admin_can_insert_coupons" ON public.coupons 
FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_can_update_coupons" ON public.coupons;
CREATE POLICY "admin_can_update_coupons" ON public.coupons 
FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_can_delete_coupons" ON public.coupons;
CREATE POLICY "admin_can_delete_coupons" ON public.coupons 
FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
