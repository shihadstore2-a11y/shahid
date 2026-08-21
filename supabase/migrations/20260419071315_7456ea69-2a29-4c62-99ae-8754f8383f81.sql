-- جدول لتقييد طلبات /api/demo-generate حسب الـIP وكل ساعة
CREATE TABLE IF NOT EXISTS public.demo_rate_limits (
  ip text NOT NULL,
  hour_bucket timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip, hour_bucket)
);

ALTER TABLE public.demo_rate_limits ENABLE ROW LEVEL SECURITY;

-- لا أحد يقرأ/يكتب من العميل — service_role فقط
DROP POLICY IF EXISTS "Service role manages demo rate limits" ON public.demo_rate_limits;
CREATE POLICY "Service role manages demo rate limits"
  ON public.demo_rate_limits FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_demo_rate_limits_hour
  ON public.demo_rate_limits (hour_bucket);

-- دالة ذرّية لاستهلاك توكن — ترجع (allowed, remaining, reset_at)
CREATE OR REPLACE FUNCTION public.consume_demo_token(_ip text, _limit integer)
RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bucket timestamptz := date_trunc('hour', now());
  _next   timestamptz := _bucket + interval '1 hour';
  _new_count integer;
BEGIN
  INSERT INTO public.demo_rate_limits (ip, hour_bucket, count, updated_at)
  VALUES (_ip, _bucket, 1, now())
  ON CONFLICT (ip, hour_bucket) DO UPDATE
    SET count = public.demo_rate_limits.count + 1,
        updated_at = now()
  RETURNING count INTO _new_count;

  IF _new_count > _limit THEN
    -- تراجع: ما نخصم العدّاد الزائد (نتركه فوق الحد، بس نرفض)
    RETURN QUERY SELECT false, 0, _next;
  ELSE
    RETURN QUERY SELECT true, GREATEST(_limit - _new_count, 0), _next;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_demo_token(text, integer) TO service_role;