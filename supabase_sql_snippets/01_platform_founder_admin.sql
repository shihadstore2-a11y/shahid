-- ===================================================================
-- 📄 01: تعيين المشرف العام للمنصة الأم (Platform Founder Admin)
-- الوصف: منح صلاحية دور "admin" لحساب مؤسس المنصة في جدول public.user_roles
-- متى يُستخدم: يُشغّل في Supabase SQL Editor عند إنشاء الحساب أو تغييره
-- ===================================================================

-- 1. إضافة دور الأدمن لبريدك في المنصة الأم
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE LOWER(email) = 'digitaneo@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
