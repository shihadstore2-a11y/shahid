-- 1) Plan limits table — instead of hardcoding limits in app code
CREATE TABLE public.plan_limits (
  plan public.user_plan NOT NULL,
  kind text NOT NULL CHECK (kind IN ('text','image')),
  monthly_limit integer NOT NULL CHECK (monthly_limit >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan, kind)
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read limits (needed by client + server)
CREATE POLICY "Plan limits readable by everyone"
  ON public.plan_limits FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage plan limits"
  ON public.plan_limits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed current limits (matches PLAN_LIMITS in src/server/ai-functions.ts)
INSERT INTO public.plan_limits (plan, kind, monthly_limit) VALUES
  ('free',     'text',  5),
  ('free',     'image', 2),
  ('pro',      'text',  1000),
  ('pro',      'image', 60),
  ('business', 'text',  5000),
  ('business', 'image', 300);

-- 2) DB-level quota enforcement trigger on generations
-- Defense in depth: even if app code is bypassed, DB rejects over-quota inserts.
CREATE OR REPLACE FUNCTION public.enforce_generation_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.user_plan;
  _kind text;
  _limit integer;
  _used integer;
  _month text;
BEGIN
  -- Map generation type -> usage kind
  _kind := CASE WHEN NEW.type = 'text' THEN 'text' ELSE 'image' END;

  -- Current month in Riyadh tz (matches usage-month.ts)
  _month := to_char((now() AT TIME ZONE 'Asia/Riyadh')::date, 'YYYY-MM');

  -- Resolve user's plan
  SELECT plan INTO _plan FROM public.profiles WHERE id = NEW.user_id;
  IF _plan IS NULL THEN _plan := 'free'; END IF;

  -- Resolve limit
  SELECT monthly_limit INTO _limit
    FROM public.plan_limits
   WHERE plan = _plan AND kind = _kind;
  IF _limit IS NULL THEN _limit := 0; END IF;

  -- Resolve current usage (may be null if no row yet)
  IF _kind = 'text' THEN
    SELECT text_count INTO _used FROM public.usage_logs
     WHERE user_id = NEW.user_id AND month = _month;
  ELSE
    SELECT image_count INTO _used FROM public.usage_logs
     WHERE user_id = NEW.user_id AND month = _month;
  END IF;
  IF _used IS NULL THEN _used := 0; END IF;

  IF _used >= _limit THEN
    RAISE EXCEPTION 'quota_exceeded: plan=% kind=% used=% limit=%',
      _plan, _kind, _used, _limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_generation_quota
  BEFORE INSERT ON public.generations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_generation_quota();

-- 3) Helpful index for analytics queries (cost reports + top users)
CREATE INDEX IF NOT EXISTS idx_generations_user_created_cost
  ON public.generations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_created_at
  ON public.generations (created_at DESC);