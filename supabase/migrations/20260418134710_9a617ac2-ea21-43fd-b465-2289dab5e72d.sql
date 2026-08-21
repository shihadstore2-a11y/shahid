
-- Drop the broad public SELECT policy that allowed listing all files
DROP POLICY IF EXISTS "Generated images are publicly viewable" ON storage.objects;

-- Allow public read of specific files (direct URL access works), but prevent listing
-- Users can list/view their own folder
CREATE POLICY "Users can view own folder"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'generated-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Note: The bucket remains "public" so direct URLs work for sharing generated images,
-- but the absence of a broad SELECT policy means listing is restricted to owners.
