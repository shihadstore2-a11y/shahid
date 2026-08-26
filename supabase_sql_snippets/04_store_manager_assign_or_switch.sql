-- ===================================================================
-- 📄 04: إدارة وترقية مديري المتجر الإلكتروني (Store Managers)
-- الوصف: 
-- 1. ترقية أي حساب (بعد إضافته من Add User في Supabase Auth) ليصبح مديراً عاماً لمتجره في admin_users.
-- 2. إزالة صلاحية إدارة المتجر عن أي بريد قديم أو مستبدل.
-- ===================================================================

-- 1. ترقية الحساب الجديد ليصبح مديراً عاماً (Super Admin) للمتجر
-- (غيّر الإيميل والاسم إلى بيانات المدير الجديد)
INSERT INTO public.admin_users (user_id, role, full_name, email, is_active)
SELECT id, 'super_admin'::public.admin_role, 'ثامر', email, true
FROM auth.users
WHERE LOWER(email) = 'iiithamer17@gmail.com'
ON CONFLICT (user_id) DO UPDATE 
SET role = 'super_admin'::public.admin_role, 
    email = EXCLUDED.email, 
    full_name = EXCLUDED.full_name, 
    is_active = true;

-- 2. إزالة صلاحية إدارة المتجر عن البريد القديم (عند الاستبدال)
-- DELETE FROM public.admin_users WHERE LOWER(email) = 'البريد_القديم_هنا';
