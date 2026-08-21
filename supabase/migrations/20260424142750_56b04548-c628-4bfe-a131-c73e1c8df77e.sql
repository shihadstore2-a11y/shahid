-- إصلاح cron jobs بعد تغيير النشر إلى rifd.site
-- المشكلة: الـ URLs القديمة (rifd.lovable.app + id-preview) لم تعد تعمل

-- 1. process-email-queue: نقل من preview URL إلى stable production URL
SELECT cron.unschedule('process-email-queue');

SELECT cron.schedule(
  'process-email-queue',
  '5 seconds',
  $$
  SELECT CASE
    WHEN (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now()
      THEN NULL
    WHEN EXISTS (SELECT 1 FROM pgmq.q_auth_emails LIMIT 1)
      OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails LIMIT 1)
      THEN net.http_post(
        url := 'https://project--694f48b8-26d0-46e8-9443-b81b61c8f1f6.lovable.app/lovable/email/queue/process',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'email_queue_service_role_key'
          )
        ),
        body := '{}'::jsonb
      )
    ELSE NULL
  END;
  $$
);

-- 2. check-stale-subscriptions: تحديث URL
SELECT cron.unschedule('check-stale-subscriptions');

SELECT cron.schedule(
  'check-stale-subscriptions',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifd.site/api/public/hooks/check-stale-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) AS request_id;
  $$
);

-- 3. daily-domain-scan: تحديث URL
SELECT cron.unschedule('daily-domain-scan');

SELECT cron.schedule(
  'daily-domain-scan',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifd.site/hooks/domain-scan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- 4. rifd-onboarding-emails-daily: تحديث URL
SELECT cron.unschedule('rifd-onboarding-emails-daily');

SELECT cron.schedule(
  'rifd-onboarding-emails-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifd.site/hooks/onboarding-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- 5. send-expiring-subscription-reminders: تحديث URL
SELECT cron.unschedule('send-expiring-subscription-reminders');

SELECT cron.schedule(
  'send-expiring-subscription-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifd.site/hooks/expiring-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);