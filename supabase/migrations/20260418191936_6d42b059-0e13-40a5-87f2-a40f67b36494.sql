-- 1) Enable pg_net for HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Internal config table (admin-only, no public access)
CREATE TABLE IF NOT EXISTS public.internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view internal config" ON public.internal_config;
CREATE POLICY "Admins can view internal config"
  ON public.internal_config FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage internal config" ON public.internal_config;
CREATE POLICY "Admins can manage internal config"
  ON public.internal_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Trigger function — sends async HTTP POST to TanStack server route
CREATE OR REPLACE FUNCTION public.notify_admin_on_subscription_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  webhook_url text;
  webhook_secret text;
BEGIN
  BEGIN
    SELECT value INTO webhook_url FROM public.internal_config WHERE key = 'notify_webhook_url';
    SELECT value INTO webhook_secret FROM public.internal_config WHERE key = 'notify_webhook_secret';

    IF webhook_url IS NULL OR webhook_secret IS NULL THEN
      RAISE WARNING 'notify_admin: webhook config missing, skipping';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', webhook_secret
      ),
      body := jsonb_build_object('request_id', NEW.id::text),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 4) Attach trigger
DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;
CREATE TRIGGER trg_notify_admin_on_subscription_request
  AFTER INSERT ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_subscription_request();