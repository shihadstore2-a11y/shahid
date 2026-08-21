-- ============================================================
-- WAVE 1: Pre-migration backups
-- ============================================================
CREATE TABLE IF NOT EXISTS public.backup_video_provider_configs_20260502 AS
  SELECT * FROM public.video_provider_configs;

CREATE TABLE IF NOT EXISTS public.backup_video_jobs_20260502 AS
  SELECT * FROM public.video_jobs;

-- ============================================================
-- 1) Update video_provider_configs: Replicate primary, fal_ai fallback
-- ============================================================
UPDATE public.video_provider_configs
SET enabled = true,
    public_enabled = true,
    priority = 100,
    health_status = 'testing',
    last_error_message = NULL,
    updated_at = now()
WHERE provider_key = 'replicate';

UPDATE public.video_provider_configs
SET enabled = true,
    public_enabled = true,
    priority = 50,
    health_status = 'active',
    updated_at = now()
WHERE provider_key = 'fal_ai';

-- ============================================================
-- 2) error_category enum + column on video_jobs
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.video_error_category AS ENUM (
    'provider_error',
    'user_error',
    'content_error',
    'timeout',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.video_jobs
  ADD COLUMN IF NOT EXISTS error_category public.video_error_category;

CREATE INDEX IF NOT EXISTS idx_video_jobs_error_category
  ON public.video_jobs (error_category)
  WHERE error_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_video_jobs_provider_status_completed
  ON public.video_jobs (provider, status, completed_at DESC);

-- ============================================================
-- 3) provider_health_window — rolling 24h success/fail counts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.provider_health_window (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  success_count integer NOT NULL DEFAULT 0,
  fail_count integer NOT NULL DEFAULT 0,
  total_count integer GENERATED ALWAYS AS (success_count + fail_count) STORED,
  fail_rate numeric(5,4) GENERATED ALWAYS AS (
    CASE WHEN (success_count + fail_count) = 0 THEN 0
         ELSE fail_count::numeric / (success_count + fail_count) END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_provider_health_window_provider_recent
  ON public.provider_health_window (provider_key, window_start DESC);

ALTER TABLE public.provider_health_window ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view provider_health_window" ON public.provider_health_window;
CREATE POLICY "Admins can view provider_health_window"
  ON public.provider_health_window FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- 4) provider_kill_switch_events — audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.provider_kill_switch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  fail_rate numeric(5,4) NOT NULL,
  fail_count integer NOT NULL,
  success_count integer NOT NULL,
  window_minutes integer NOT NULL DEFAULT 1440,
  restored_at timestamptz,
  restored_by uuid,
  restore_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kill_switch_events_provider_recent
  ON public.provider_kill_switch_events (provider_key, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_kill_switch_events_active
  ON public.provider_kill_switch_events (provider_key)
  WHERE restored_at IS NULL;

ALTER TABLE public.provider_kill_switch_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view kill_switch_events" ON public.provider_kill_switch_events;
CREATE POLICY "Admins can view kill_switch_events"
  ON public.provider_kill_switch_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- 5) Trigger: update health window after video_jobs status change
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_provider_health_after_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bucket timestamptz := date_trunc('hour', now());
  _is_success boolean;
  _is_failure boolean;
  _window_success integer;
  _window_fail integer;
  _window_total integer;
  _window_fail_rate numeric;
  _kill_switch_threshold numeric := 0.20;
  _min_attempts integer := 10;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.provider IS NULL OR NEW.provider = '' THEN RETURN NEW; END IF;

  _is_success := (NEW.status::text = 'succeeded');
  _is_failure := (NEW.status::text = 'failed' AND COALESCE(NEW.error_category, 'unknown')::text IN ('provider_error','timeout','unknown'));

  IF NOT _is_success AND NOT _is_failure THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.provider_health_window (provider_key, window_start, success_count, fail_count)
  VALUES (
    NEW.provider, _bucket,
    CASE WHEN _is_success THEN 1 ELSE 0 END,
    CASE WHEN _is_failure THEN 1 ELSE 0 END
  )
  ON CONFLICT (provider_key, window_start) DO UPDATE
    SET success_count = public.provider_health_window.success_count + EXCLUDED.success_count,
        fail_count    = public.provider_health_window.fail_count    + EXCLUDED.fail_count,
        updated_at    = now();

  SELECT COALESCE(SUM(success_count), 0), COALESCE(SUM(fail_count), 0)
    INTO _window_success, _window_fail
  FROM public.provider_health_window
  WHERE provider_key = NEW.provider
    AND window_start >= now() - interval '24 hours';

  _window_total := _window_success + _window_fail;
  _window_fail_rate := CASE WHEN _window_total = 0 THEN 0
                            ELSE _window_fail::numeric / _window_total END;

  IF _window_fail_rate >= _kill_switch_threshold AND _window_total >= _min_attempts THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.provider_kill_switch_events
      WHERE provider_key = NEW.provider AND restored_at IS NULL
    ) THEN
      UPDATE public.video_provider_configs
      SET enabled = false,
          health_status = 'unhealthy',
          last_error_at = now(),
          last_error_message = format('Auto-disabled by kill-switch: fail_rate=%.2f%% over %s attempts in 24h',
                                       _window_fail_rate * 100, _window_total),
          updated_at = now()
      WHERE provider_key = NEW.provider;

      INSERT INTO public.provider_kill_switch_events (
        provider_key, fail_rate, fail_count, success_count, window_minutes, metadata
      ) VALUES (
        NEW.provider, _window_fail_rate, _window_fail, _window_success, 1440,
        jsonb_build_object('triggered_by_job_id', NEW.id, 'threshold', _kill_switch_threshold)
      );

      BEGIN
        PERFORM net.http_post(
          url := (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_url'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
          ),
          body := jsonb_build_object(
            'event', 'provider_kill_switch',
            'provider_key', NEW.provider,
            'fail_rate', _window_fail_rate,
            'fail_count', _window_fail,
            'success_count', _window_success,
            'admin_chat_id', (SELECT value FROM public.internal_config WHERE key = 'telegram_admin_chat_id')
          ),
          timeout_milliseconds := 5000
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'kill-switch notify failed: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_provider_health_after_job ON public.video_jobs;
CREATE TRIGGER trg_update_provider_health_after_job
AFTER UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_provider_health_after_job();

-- ============================================================
-- 6) Admin RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.restore_provider(_provider_key text, _reason text DEFAULT 'manual_admin_restore')
RETURNS public.video_provider_configs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.video_provider_configs;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  UPDATE public.video_provider_configs
  SET enabled = true,
      health_status = 'testing',
      last_error_message = NULL,
      updated_at = now()
  WHERE provider_key = _provider_key
  RETURNING * INTO _row;

  IF NOT FOUND THEN RAISE EXCEPTION 'provider_not_found: %', _provider_key; END IF;

  UPDATE public.provider_kill_switch_events
  SET restored_at = now(),
      restored_by = auth.uid(),
      restore_reason = _reason
  WHERE provider_key = _provider_key AND restored_at IS NULL;

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_provider_health_summary()
RETURNS TABLE(
  provider_key text,
  enabled boolean,
  priority integer,
  health_status text,
  success_24h integer,
  fail_24h integer,
  total_24h integer,
  fail_rate_24h numeric,
  active_kill_switch boolean,
  last_kill_switch_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  RETURN QUERY
  SELECT
    vpc.provider_key,
    vpc.enabled,
    vpc.priority,
    vpc.health_status,
    COALESCE(h.s, 0)::int AS success_24h,
    COALESCE(h.f, 0)::int AS fail_24h,
    COALESCE(h.s + h.f, 0)::int AS total_24h,
    CASE WHEN COALESCE(h.s + h.f, 0) = 0 THEN 0::numeric
         ELSE (h.f::numeric / (h.s + h.f)) END AS fail_rate_24h,
    EXISTS (
      SELECT 1 FROM public.provider_kill_switch_events ev
      WHERE ev.provider_key = vpc.provider_key AND ev.restored_at IS NULL
    ) AS active_kill_switch,
    (SELECT MAX(triggered_at) FROM public.provider_kill_switch_events
     WHERE provider_key = vpc.provider_key) AS last_kill_switch_at
  FROM public.video_provider_configs vpc
  LEFT JOIN LATERAL (
    SELECT SUM(success_count) AS s, SUM(fail_count) AS f
    FROM public.provider_health_window
    WHERE provider_key = vpc.provider_key
      AND window_start >= now() - interval '24 hours'
  ) h ON true
  ORDER BY vpc.priority DESC NULLS LAST;
END;
$$;