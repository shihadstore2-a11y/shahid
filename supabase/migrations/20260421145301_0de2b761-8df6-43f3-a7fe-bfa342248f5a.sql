
-- دالة لجلب الطلبات المعلّقة منذ أكثر من 24 ساعة
CREATE OR REPLACE FUNCTION public.get_stale_subscription_requests()
RETURNS TABLE(
  id uuid,
  plan public.user_plan,
  billing_cycle text,
  status public.subscription_request_status,
  email text,
  whatsapp text,
  store_name text,
  hours_old numeric,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, plan, billing_cycle, status, email, whatsapp, store_name,
    ROUND(EXTRACT(EPOCH FROM (now() - created_at))/3600, 1) AS hours_old,
    created_at
  FROM public.subscription_requests
  WHERE status IN ('pending', 'contacted')
    AND created_at < now() - interval '24 hours'
  ORDER BY created_at ASC
  LIMIT 50;
$$;

-- جدول state لمنع تكرار التنبيه (تنبيه واحد كل 24 ساعة كحدّ أقصى)
CREATE TABLE IF NOT EXISTS public.stale_subs_alert_state (
  id integer PRIMARY KEY DEFAULT 1,
  last_alert_at timestamptz,
  last_alert_count integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stale_subs_alert_state_singleton CHECK (id = 1)
);

INSERT INTO public.stale_subs_alert_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.stale_subs_alert_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read stale subs alert state"
ON public.stale_subs_alert_state FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages stale subs alert state"
ON public.stale_subs_alert_state FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Cron job يومي 09:00 UTC (12:00 الرياض)
SELECT cron.schedule(
  'check-stale-subscriptions',
  '0 9 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rifd.lovable.app/api/public/hooks/check-stale-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) AS request_id;
  $cron$
);
