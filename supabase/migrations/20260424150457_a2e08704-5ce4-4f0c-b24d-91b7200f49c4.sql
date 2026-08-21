-- إضافة سياسة عرض للأدمن على جدول البريد المحجوب (suppressed_emails)
-- هذا يسمح للأدمن بمراجعة وإدارة قائمة الحجب من لوحة التحكم
CREATE POLICY "Admins can view suppressed emails"
ON public.suppressed_emails
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));