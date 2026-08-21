INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-videos',
  'generated-videos',
  false,
  104857600,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime'];

CREATE POLICY "Users can read own generated videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can read generated videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-videos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Service role manages generated videos"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'generated-videos')
WITH CHECK (bucket_id = 'generated-videos');