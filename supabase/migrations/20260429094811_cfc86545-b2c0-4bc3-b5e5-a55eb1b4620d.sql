INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-product-images', 'campaign-product-images', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can view own campaign product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own campaign product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own campaign product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own campaign product images" ON storage.objects;

CREATE POLICY "Users can view own campaign product images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'campaign-product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload own campaign product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'campaign-product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own campaign product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'campaign-product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'campaign-product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own campaign product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'campaign-product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);