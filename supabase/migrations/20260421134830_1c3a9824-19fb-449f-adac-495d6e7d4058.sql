-- 1. Idempotency: prevent duplicate pending subscription requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_requests_unique_pending
  ON public.subscription_requests (user_id, plan)
  WHERE status = 'pending';

-- 2. DLQ Health Check Function (service-role only)
CREATE OR REPLACE FUNCTION public.check_email_dlq_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  auth_dlq_count int := 0;
  trans_dlq_count int := 0;
  auth_pending int := 0;
  trans_pending int := 0;
BEGIN
  BEGIN
    SELECT count(*) INTO auth_dlq_count FROM pgmq.q_auth_emails_dlq;
  EXCEPTION WHEN undefined_table THEN auth_dlq_count := 0;
  END;
  BEGIN
    SELECT count(*) INTO trans_dlq_count FROM pgmq.q_transactional_emails_dlq;
  EXCEPTION WHEN undefined_table THEN trans_dlq_count := 0;
  END;
  BEGIN
    SELECT count(*) INTO auth_pending FROM pgmq.q_auth_emails;
  EXCEPTION WHEN undefined_table THEN auth_pending := 0;
  END;
  BEGIN
    SELECT count(*) INTO trans_pending FROM pgmq.q_transactional_emails;
  EXCEPTION WHEN undefined_table THEN trans_pending := 0;
  END;

  RETURN jsonb_build_object(
    'auth_dlq', auth_dlq_count,
    'transactional_dlq', trans_dlq_count,
    'auth_pending', auth_pending,
    'transactional_pending', trans_pending,
    'total_dlq', auth_dlq_count + trans_dlq_count,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_email_dlq_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_dlq_health() TO service_role;

-- 3. DLQ Alert State (singleton — rate-limit Telegram alerts)
CREATE TABLE IF NOT EXISTS public.dlq_alert_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_alert_at timestamptz,
  last_alert_count int DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.dlq_alert_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.dlq_alert_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages dlq alert state" ON public.dlq_alert_state;
CREATE POLICY "Service role manages dlq alert state"
ON public.dlq_alert_state
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can read dlq alert state" ON public.dlq_alert_state;
CREATE POLICY "Admins can read dlq alert state"
ON public.dlq_alert_state
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));