-- تحديث pg_cron ليستدعي المسار الصحيح في تطبيق رِفد
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rifd-activation-emails-daily') THEN
    PERFORM cron.unschedule('rifd-activation-emails-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'rifd-activation-emails-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--694f48b8-26d0-46e8-9443-b81b61c8f1f6.lovable.app/api/public/hooks/activation-sequence',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('triggered_by','pg_cron')
  );
  $$
);