-- ============================================================
-- P1 Security Hardening Migration
-- ============================================================

-- (1) PRIVILEGE_ESCALATION: منع المستخدم من إدخال/تعديل/حذف أدواره
-- السياسات الحالية تسمح لـ "authenticated" + has_role(admin) — لكن has_role
-- نفسها معتمدة على user_roles. الحل: سياسة RESTRICTIVE تمنع كل شيء إلا
-- service_role أو وجود admin سابق فعلي (من خلال has_role) — مع الاعتماد
-- على trigger للتعيين الأولي بـ SECURITY DEFINER (handle_new_user موجودة).

-- نحذف السياسات الحالية ونعيد بناءها بشكل أكثر صرامة:
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- سياسة restrictive: يمنع أي شيء إلا (service_role) أو (admin حقيقي)
CREATE POLICY "Block non-admin role mutations"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- وسياسات permissive عادية للأدمن (تعمل فقط بعد المرور من restrictive):
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- (2) MISSING_RLS_PROTECTION: usage_logs — المستخدم يستطيع تصفير عداداته
-- نحذف INSERT/UPDATE من المستخدم، ويبقى SELECT فقط. الزيادة تحدث عبر
-- bump_usage (SECURITY DEFINER) و enforce_generation_quota (trigger).
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_logs;
DROP POLICY IF EXISTS "Users can update own usage" ON public.usage_logs;

-- نضيف سياسات service_role للوضوح
CREATE POLICY "Service role manages usage_logs"
ON public.usage_logs
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- (3) جدول contact_submissions (P2.1) — نُحضّره مع P1 في نفس المايجريشن
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  user_agent text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- validation داخل الـ DB كطبقة دفاع ثانية
  CONSTRAINT contact_name_len CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  CONSTRAINT contact_email_len CHECK (char_length(trim(email)) BETWEEN 3 AND 255),
  CONSTRAINT contact_email_fmt CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT contact_phone_len CHECK (phone IS NULL OR char_length(phone) <= 20),
  CONSTRAINT contact_subject_len CHECK (char_length(trim(subject)) BETWEEN 1 AND 150),
  CONSTRAINT contact_message_len CHECK (char_length(trim(message)) BETWEEN 5 AND 2000),
  CONSTRAINT contact_status_valid CHECK (status IN ('new','read','replied','archived','spam'))
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- INSERT مغلق من الـ client. الإدراج يتم فقط من server route عبر service_role.
-- لا نضع سياسة INSERT للأنون/المستخدم — هذا يمنع الـ spam من المتصفح.

CREATE POLICY "Admins can view contact submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update contact submissions"
ON public.contact_submissions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete contact submissions"
ON public.contact_submissions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert contact submissions"
ON public.contact_submissions
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

-- index للأدمن لعرض الأحدث
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status_created
ON public.contact_submissions (status, created_at DESC);

-- trigger لتحديث updated_at
CREATE TRIGGER update_contact_submissions_updated_at
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
