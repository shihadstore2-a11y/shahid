-- Wave C2: Activation Email Sequence
-- جدول تتبع إيميلات التفعيل + RPC للأدمن + pg_cron يومي

-- 1) جدول السجل
CREATE TABLE IF NOT EXISTS public.activation_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_marker smallint NOT NULL CHECK (day_marker IN (0,1,3,7,14)),
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  skipped boolean NOT NULL DEFAULT false,
  skip_reason text,
  opened_at timestamptz,
  clicked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, day_marker)
);

CREATE INDEX IF NOT EXISTS idx_activation_email_log_user ON public.activation_email_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activation_email_log_sent ON public.activation_email_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_activation_email_log_day ON public.activation_email_log(day_marker);

ALTER TABLE public.activation_email_log ENABLE ROW LEVEL SECURITY;

-- المستخدم يرى سجلّه فقط
CREATE POLICY "users_view_own_activation_log"
  ON public.activation_email_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- الإدراج/التحديث محصور بالـ service role (cron + edge function)
CREATE POLICY "service_role_writes_activation_log"
  ON public.activation_email_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 2) RPC تحليلات قمع التفعيل
CREATE OR REPLACE FUNCTION public.get_email_activation_funnel(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  WITH per_day AS (
    SELECT
      day_marker,
      COUNT(*) FILTER (WHERE NOT skipped)                           AS sent,
      COUNT(*) FILTER (WHERE skipped)                               AS skipped,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL)                 AS opened,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)                AS clicked
    FROM public.activation_email_log
    WHERE sent_at >= now() - (_days || ' days')::interval
    GROUP BY day_marker
  )
  SELECT jsonb_build_object(
    'window_days', _days,
    'per_day', COALESCE(jsonb_agg(jsonb_build_object(
      'day', day_marker,
      'sent', sent,
      'skipped', skipped,
      'opened', opened,
      'clicked', clicked,
      'open_rate', CASE WHEN sent > 0 THEN ROUND(opened::numeric * 100 / sent, 1) ELSE 0 END,
      'click_rate', CASE WHEN sent > 0 THEN ROUND(clicked::numeric * 100 / sent, 1) ELSE 0 END
    ) ORDER BY day_marker), '[]'::jsonb),
    'totals', jsonb_build_object(
      'sent', COALESCE(SUM(sent),0),
      'opened', COALESCE(SUM(opened),0),
      'clicked', COALESCE(SUM(clicked),0)
    )
  ) INTO v_result FROM per_day;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_activation_funnel(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_activation_funnel(integer) TO authenticated;

-- 3) pg_cron — يستدعي edge function يومياً 09:00 Riyadh (06:00 UTC)
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
    url := 'https://wubcgjuodozhrrigtngs.supabase.co/functions/v1/dispatch-activation-emails',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('triggered_by','pg_cron')
  );
  $$
);