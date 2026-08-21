
CREATE OR REPLACE FUNCTION public.fn_video_jobs_after_update_health()
RETURNS TRIGGER
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

  _is_success := (NEW.status::text = 'completed');
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
          )
        );
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- BACKFILL آخر 24 ساعة
DELETE FROM public.provider_health_window
WHERE window_start >= date_trunc('hour', now() - interval '24 hours');

INSERT INTO public.provider_health_window (provider_key, window_start, success_count, fail_count)
SELECT
  provider AS provider_key,
  date_trunc('hour', COALESCE(completed_at, updated_at)) AS window_start,
  COUNT(*) FILTER (WHERE status::text = 'completed') AS success_count,
  COUNT(*) FILTER (WHERE status::text = 'failed' AND COALESCE(error_category, 'unknown')::text IN ('provider_error','timeout','unknown')) AS fail_count
FROM public.video_jobs
WHERE provider IS NOT NULL AND provider <> ''
  AND COALESCE(completed_at, updated_at) >= now() - interval '24 hours'
  AND status::text IN ('completed','failed')
GROUP BY provider, date_trunc('hour', COALESCE(completed_at, updated_at))
ON CONFLICT (provider_key, window_start) DO UPDATE
  SET success_count = EXCLUDED.success_count,
      fail_count    = EXCLUDED.fail_count,
      updated_at    = now();

-- RESTORE: إغلاق kill-switch events المفتوحة وإعادة تفعيل المزودين الناشطين فقط
UPDATE public.provider_kill_switch_events
SET restored_at = now(),
    restore_reason = 'hotfix_succeeded_to_completed_v6'
WHERE restored_at IS NULL;

-- نُعيد تفعيل فقط المزودين الذين أُوقفوا بسبب kill-switch (last_error_message يحوي 'kill-switch')
-- ونتجنب المزودين المتقاعدين أو المعطّلين يدوياً (metadata.role='retired_legacy_provider')
UPDATE public.video_provider_configs
SET enabled = true,
    health_status = 'active',
    last_error_message = NULL,
    updated_at = now()
WHERE health_status = 'unhealthy'
  AND COALESCE(last_error_message, '') ILIKE '%kill-switch%'
  AND COALESCE((metadata ->> 'role'), '') <> 'retired_legacy_provider';
