-- Schedule daily Phase 1 report (08:00 Riyadh = 05:00 UTC)
SELECT cron.unschedule('phase1-daily-report')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'phase1-daily-report');

SELECT cron.schedule(
  'phase1-daily-report',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifd.site/api/public/hooks/phase1-daily-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  ) AS request_id;
  $$
);
