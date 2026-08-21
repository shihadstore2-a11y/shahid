-- Align video provider runtime configuration with the approved PixVerse v6 strategy.
UPDATE public.video_provider_configs
SET
  enabled = true,
  public_enabled = true,
  mode = 'api',
  health_status = CASE WHEN health_status = 'unhealthy' THEN 'testing' ELSE health_status END,
  priority = 1,
  metadata = COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'role', 'primary_video_provider',
      'model_family', 'pixverse_v6',
      'legacy_cleaned_at', now(),
      'supports_product_reference', true,
      'supports_saudi_personas', true,
      'supports_audio_prompt', true
    ),
  updated_at = now()
WHERE provider_key = 'fal_ai';

UPDATE public.video_provider_configs
SET
  enabled = false,
  public_enabled = false,
  health_status = 'inactive',
  priority = CASE provider_key
    WHEN 'replicate' THEN 90
    WHEN 'google_flow_bridge' THEN 91
    WHEN 'google_veo_api' THEN 92
    ELSE priority
  END,
  metadata = COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'role', 'retired_legacy_provider',
      'retired_at', now(),
      'retired_reason', 'V2.1 standardizes production video generation on PixVerse v6 via fal.ai'
    ),
  updated_at = now()
WHERE provider_key IN ('replicate', 'google_flow_bridge', 'google_veo_api');

ALTER TABLE public.video_jobs
ALTER COLUMN provider SET DEFAULT 'router';