-- 1. إضافة أعمدة الإيصال لجدول طلبات الاشتراك
ALTER TABLE public.subscription_requests
ADD COLUMN IF NOT EXISTS receipt_path text,
ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamp with time zone;

-- 2. إنشاء bucket خاص للإيصالات
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. RLS Policies على storage.objects للـbucket payment-receipts

-- INSERT: المستخدم يرفع لـfolder الخاص به فقط (مسار = user_id/...)
CREATE POLICY "Users can upload own payment receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: المستخدم يقرأ ملفاته + الأدمن يقرأ الكل
CREATE POLICY "Users can view own payment receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- UPDATE: المستخدم يستبدل ملفاته (للسماح بإعادة الرفع)
CREATE POLICY "Users can update own payment receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: الأدمن فقط (الإيصالات سجل محاسبي)
CREATE POLICY "Admins can delete payment receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);