DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'video_quality' AND e.enumlabel = 'lite'
  ) THEN
    ALTER TYPE public.video_quality ADD VALUE 'lite';
  END IF;
END $$;

ALTER TABLE public.video_jobs
  ADD COLUMN IF NOT EXISTS speaker_image_url text,
  ADD COLUMN IF NOT EXISTS product_image_url text,
  ADD COLUMN IF NOT EXISTS selected_persona_id text;

ALTER TABLE public.video_provider_configs
  DROP CONSTRAINT IF EXISTS video_provider_configs_supported_qualities_check;

ALTER TABLE public.video_provider_configs
  ADD CONSTRAINT video_provider_configs_supported_qualities_check
  CHECK (supported_qualities <@ ARRAY['fast','lite','balanced','quality']::text[]);

UPDATE public.plan_entitlements
SET
  monthly_credits = CASE plan
    WHEN 'free' THEN 150
    WHEN 'starter' THEN 2000
    WHEN 'growth' THEN 6000
    WHEN 'pro' THEN 14000
    WHEN 'business' THEN 40000
    ELSE monthly_credits
  END,
  video_fast_allowed = true,
  video_quality_allowed = CASE WHEN plan IN ('pro','business') THEN true ELSE false END,
  max_video_duration_seconds = CASE WHEN plan = 'free' THEN 5 ELSE 8 END,
  daily_video_cap = CASE plan
    WHEN 'free' THEN 999
    WHEN 'starter' THEN 999
    WHEN 'growth' THEN 999
    WHEN 'pro' THEN 999
    WHEN 'business' THEN 999
    ELSE daily_video_cap
  END,
  updated_at = now()
WHERE plan IN ('free','starter','growth','pro','business');

UPDATE public.plan_credits
SET
  monthly_credits = CASE plan
    WHEN 'free' THEN 150
    WHEN 'starter' THEN 2000
    WHEN 'growth' THEN 6000
    WHEN 'pro' THEN 14000
    WHEN 'business' THEN 40000
    ELSE monthly_credits
  END,
  updated_at = now()
WHERE plan IN ('free','starter','growth','pro','business');

INSERT INTO public.video_provider_configs (
  provider_key, display_name_admin, enabled, public_enabled, supported_qualities,
  priority, cost_5s, cost_8s, supports_9_16, supports_1_1, supports_16_9,
  supports_starting_frame, mode, health_status, metadata
) VALUES
  ('fal_ai', 'fal.ai / Google Veo primary', true, true, ARRAY['fast','lite','quality']::text[], 1, 150, 1600, true, true, true, true, 'api', 'active', '{"role":"primary_video_provider","supports_two_images":true,"supports_saudi_personas":true,"supports_audio_prompt":true}'::jsonb)
ON CONFLICT (provider_key) DO UPDATE SET
  display_name_admin = EXCLUDED.display_name_admin,
  enabled = EXCLUDED.enabled,
  public_enabled = EXCLUDED.public_enabled,
  supported_qualities = EXCLUDED.supported_qualities,
  priority = EXCLUDED.priority,
  cost_5s = EXCLUDED.cost_5s,
  cost_8s = EXCLUDED.cost_8s,
  supports_starting_frame = EXCLUDED.supports_starting_frame,
  mode = EXCLUDED.mode,
  health_status = CASE WHEN public.video_provider_configs.health_status = 'unhealthy' THEN 'testing' ELSE EXCLUDED.health_status END,
  metadata = public.video_provider_configs.metadata || EXCLUDED.metadata,
  updated_at = now();

UPDATE public.video_provider_configs
SET
  priority = 20,
  supported_qualities = ARRAY['fast','lite','quality']::text[],
  cost_5s = 150,
  cost_8s = 1600,
  metadata = metadata || '{"role":"backup_video_provider","supports_two_images":false}'::jsonb,
  updated_at = now()
WHERE provider_key = 'replicate';