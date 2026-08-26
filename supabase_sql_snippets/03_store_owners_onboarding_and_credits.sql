-- ===================================================================
-- 📄 03: تفعيل الدخول المباشر وشحن النقاط لجميع أصحاب المتاجر
-- الوصف: 
-- 1. يفعّل حالة onboarding = true لجميع المستخدمين الحاليين ليدخلوا للوحة التحكم مباشرة دون تعليق.
-- 2. يجعل القيمة الافتراضية لأي متجر جديد هي onboarded = true.
-- 3. يودع 50 نقطة في محفظة أي حساب لم يستلم نقاطه بعد.
-- ===================================================================

-- 1. تفعيل الدخول المباشر لجميع المستخدمين وأصحاب المتاجر الحاليين
UPDATE public.profiles
SET onboarded = true, onboarding_completed_at = now();

-- 2. جعل أي مستخدم أو صاحب متجر جديد يُسجّل يدخل للوحة التحكم مباشرة مستقبلاً
ALTER TABLE public.profiles ALTER COLUMN onboarded SET DEFAULT true;

-- 3. التأكد من أن جميع الحسابات تمتلك رصيد النقاط الأولي (50 نقطة)
INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
SELECT id, 50, 0, now(), now() + interval '30 days'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
