CREATE TABLE IF NOT EXISTS public.campaign_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  offer TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT 'launch',
  channel TEXT NOT NULL DEFAULT 'instagram',
  status TEXT NOT NULL DEFAULT 'draft',
  brief TEXT NOT NULL DEFAULT '',
  text_prompt TEXT NOT NULL DEFAULT '',
  image_prompt TEXT NOT NULL DEFAULT '',
  video_prompt TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_packs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_campaign_packs_user_updated ON public.campaign_packs (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_packs_status ON public.campaign_packs (status);

CREATE POLICY "Users can view own campaign packs"
ON public.campaign_packs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all campaign packs"
ON public.campaign_packs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own campaign packs"
ON public.campaign_packs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('draft', 'generated', 'archived')
  AND goal IN ('launch', 'offer', 'seasonal', 'retention')
  AND channel IN ('instagram', 'snapchat', 'tiktok', 'whatsapp')
  AND char_length(product) <= 500
  AND char_length(audience) <= 500
  AND char_length(offer) <= 500
  AND char_length(brief) <= 5000
  AND char_length(text_prompt) <= 5000
  AND char_length(image_prompt) <= 3000
  AND char_length(video_prompt) <= 3000
);

CREATE POLICY "Users can update own campaign packs"
ON public.campaign_packs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('draft', 'generated', 'archived')
  AND goal IN ('launch', 'offer', 'seasonal', 'retention')
  AND channel IN ('instagram', 'snapchat', 'tiktok', 'whatsapp')
  AND char_length(product) <= 500
  AND char_length(audience) <= 500
  AND char_length(offer) <= 500
  AND char_length(brief) <= 5000
  AND char_length(text_prompt) <= 5000
  AND char_length(image_prompt) <= 3000
  AND char_length(video_prompt) <= 3000
);

CREATE POLICY "Users can delete own campaign packs"
ON public.campaign_packs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_campaign_packs_updated_at ON public.campaign_packs;
CREATE TRIGGER update_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();