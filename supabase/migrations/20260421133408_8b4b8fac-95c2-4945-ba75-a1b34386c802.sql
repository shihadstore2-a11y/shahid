-- ============================================
-- C1: Tighten payment_settings RLS (admin-only read)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view payment settings" ON public.payment_settings;

CREATE POLICY "Admins can view payment settings"
ON public.payment_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- C2: Remove subscription_requests from realtime publication
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'subscription_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.subscription_requests';
  END IF;
END $$;

-- ============================================
-- C3: Make generated-images bucket private + owner-scoped policies
-- ============================================
UPDATE storage.buckets SET public = false WHERE id = 'generated-images';

DROP POLICY IF EXISTS "Users can read own generated images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own generated images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own generated images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own generated images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all generated images" ON storage.objects;

CREATE POLICY "Users can read own generated images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload own generated images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own generated images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own generated images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can read all generated images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- ============================================
-- HIGH: Allow admins to read all profiles
-- ============================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- HIGH: Purge stale DLQ messages from old Resend era
-- ============================================
SELECT pgmq.purge_queue('transactional_emails_dlq');
SELECT pgmq.purge_queue('auth_emails_dlq');