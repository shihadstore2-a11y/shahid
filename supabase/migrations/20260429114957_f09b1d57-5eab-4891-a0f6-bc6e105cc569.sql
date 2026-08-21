ALTER TABLE public.campaign_packs
ADD COLUMN IF NOT EXISTS ab_variants jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS publishing_calendar jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP POLICY IF EXISTS "Users can create own campaign packs" ON public.campaign_packs;
DROP POLICY IF EXISTS "Users can update own campaign packs" ON public.campaign_packs;

CREATE POLICY "Users can create own campaign packs"
ON public.campaign_packs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = ANY (ARRAY['draft'::text, 'generated'::text, 'archived'::text])
  AND goal = ANY (ARRAY['launch'::text, 'clearance'::text, 'upsell'::text, 'leads'::text, 'competitive'::text, 'winback'::text])
  AND channel = ANY (ARRAY['instagram'::text, 'snapchat'::text, 'tiktok'::text, 'whatsapp'::text])
  AND char_length(product) <= 500
  AND char_length(audience) <= 500
  AND char_length(offer) <= 500
  AND char_length(brief) <= 5000
  AND char_length(text_prompt) <= 5000
  AND char_length(image_prompt) <= 3000
  AND char_length(video_prompt) <= 3000
  AND (product_image_path IS NULL OR char_length(product_image_path) <= 1000)
  AND jsonb_typeof(ab_variants) = 'array'
  AND jsonb_array_length(ab_variants) <= 3
  AND jsonb_typeof(publishing_calendar) = 'array'
  AND jsonb_array_length(publishing_calendar) <= 7
  AND pg_column_size(ab_variants) <= 12000
  AND pg_column_size(publishing_calendar) <= 24000
);

CREATE POLICY "Users can update own campaign packs"
ON public.campaign_packs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status = ANY (ARRAY['draft'::text, 'generated'::text, 'archived'::text])
  AND goal = ANY (ARRAY['launch'::text, 'clearance'::text, 'upsell'::text, 'leads'::text, 'competitive'::text, 'winback'::text])
  AND channel = ANY (ARRAY['instagram'::text, 'snapchat'::text, 'tiktok'::text, 'whatsapp'::text])
  AND char_length(product) <= 500
  AND char_length(audience) <= 500
  AND char_length(offer) <= 500
  AND char_length(brief) <= 5000
  AND char_length(text_prompt) <= 5000
  AND char_length(image_prompt) <= 3000
  AND char_length(video_prompt) <= 3000
  AND (product_image_path IS NULL OR char_length(product_image_path) <= 1000)
  AND jsonb_typeof(ab_variants) = 'array'
  AND jsonb_array_length(ab_variants) <= 3
  AND jsonb_typeof(publishing_calendar) = 'array'
  AND jsonb_array_length(publishing_calendar) <= 7
  AND pg_column_size(ab_variants) <= 12000
  AND pg_column_size(publishing_calendar) <= 24000
);