CREATE TABLE IF NOT EXISTS public.video_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  display_name_admin text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  public_enabled boolean NOT NULL DEFAULT false,
  supported_qualities text[] NOT NULL DEFAULT ARRAY[]::text[],
  priority integer NOT NULL DEFAULT 100,
  cost_5s integer NOT NULL DEFAULT 0,
  cost_8s integer NOT NULL DEFAULT 0,
  supports_9_16 boolean NOT NULL DEFAULT true,
  supports_1_1 boolean NOT NULL DEFAULT true,
  supports_16_9 boolean NOT NULL DEFAULT true,
  supports_starting_frame boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'api',
  health_status text NOT NULL DEFAULT 'inactive',
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_provider_configs_provider_key_check CHECK (provider_key ~ '^[a-z0-9_\-]+$'),
  CONSTRAINT video_provider_configs_supported_qualities_check CHECK (supported_qualities <@ ARRAY['fast','balanced','quality']::text[]),
  CONSTRAINT video_provider_configs_mode_check CHECK (mode IN ('api','bridge','manual')),
  CONSTRAINT video_provider_configs_health_status_check CHECK (health_status IN ('active','inactive','testing','manual_required','unhealthy')),
  CONSTRAINT video_provider_configs_costs_check CHECK (cost_5s >= 0 AND cost_8s >= 0),
  CONSTRAINT video_provider_configs_priority_check CHECK (priority >= 1 AND priority <= 1000)
);

ALTER TABLE public.video_provider_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view video provider configs" ON public.video_provider_configs;
CREATE POLICY "Admins can view video provider configs"
ON public.video_provider_configs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage video provider configs" ON public.video_provider_configs;
CREATE POLICY "Admins can manage video provider configs"
ON public.video_provider_configs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_video_provider_configs_updated_at ON public.video_provider_configs;
CREATE TRIGGER update_video_provider_configs_updated_at
BEFORE UPDATE ON public.video_provider_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_video_provider_configs_routing
ON public.video_provider_configs (enabled, public_enabled, priority);

INSERT INTO public.video_provider_configs (
  provider_key, display_name_admin, enabled, public_enabled, supported_qualities,
  priority, cost_5s, cost_8s, supports_9_16, supports_1_1, supports_16_9,
  supports_starting_frame, mode, health_status, metadata
) VALUES
  ('replicate', 'Replicate / Google Veo via Replicate', true, true, ARRAY['fast','quality']::text[], 10, 150, 240, true, true, true, true, 'api', 'active', '{"role":"primary_existing_provider"}'::jsonb),
  ('google_flow_bridge', 'Google Flow Bridge (Manual)', false, false, ARRAY['quality']::text[], 20, 450, 900, true, true, true, true, 'manual', 'manual_required', '{"role":"manual_bridge_placeholder"}'::jsonb),
  ('google_veo_api', 'Google Veo API Official', false, false, ARRAY['fast','quality']::text[], 30, 150, 900, true, true, true, true, 'api', 'inactive', '{"role":"future_api_provider"}'::jsonb),
  ('runway', 'Runway API', false, false, ARRAY['quality']::text[], 40, 450, 900, true, true, true, true, 'api', 'inactive', '{"role":"future_api_provider"}'::jsonb),
  ('luma', 'Luma API', false, false, ARRAY['fast','quality']::text[], 50, 240, 900, true, true, true, true, 'api', 'inactive', '{"role":"future_api_provider"}'::jsonb),
  ('kling', 'Kling API', false, false, ARRAY['quality']::text[], 60, 450, 900, true, true, true, true, 'api', 'inactive', '{"role":"future_api_provider"}'::jsonb)
ON CONFLICT (provider_key) DO UPDATE SET
  display_name_admin = EXCLUDED.display_name_admin,
  supported_qualities = EXCLUDED.supported_qualities,
  priority = EXCLUDED.priority,
  cost_5s = EXCLUDED.cost_5s,
  cost_8s = EXCLUDED.cost_8s,
  supports_9_16 = EXCLUDED.supports_9_16,
  supports_1_1 = EXCLUDED.supports_1_1,
  supports_16_9 = EXCLUDED.supports_16_9,
  supports_starting_frame = EXCLUDED.supports_starting_frame,
  mode = EXCLUDED.mode,
  metadata = public.video_provider_configs.metadata || EXCLUDED.metadata,
  updated_at = now();