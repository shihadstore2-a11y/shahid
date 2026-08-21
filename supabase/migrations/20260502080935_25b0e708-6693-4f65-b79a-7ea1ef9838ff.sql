
-- ============================================================
-- profiles: onboarding tracking
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- ============================================================
-- onboarding_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  step integer NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('started','step_completed','wizard_completed','wizard_abandoned','autogen_started','autogen_succeeded','autogen_failed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_user ON public.onboarding_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_type ON public.onboarding_events(event_type, created_at DESC);

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_onboarding_events"
  ON public.onboarding_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "users_insert_own_onboarding_events"
  ON public.onboarding_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND step BETWEEN 0 AND 3 AND char_length(event_type) <= 32 AND pg_column_size(metadata) <= 4000);

-- ============================================================
-- badge_type enum + user_badges
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.badge_type AS ENUM ('first_text','first_image','first_video','active_store');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_type public.badge_type NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(user_id, badge_type)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id, awarded_at DESC);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_badges"
  ON public.user_badges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- لا insert/update/delete من المستخدم — فقط من triggers (SECURITY DEFINER)

-- ============================================================
-- Award helper + trigger logic
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_award_badge_if_new(
  _user_id uuid,
  _badge public.badge_type,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted boolean := false;
  _all_three integer;
BEGIN
  INSERT INTO public.user_badges (user_id, badge_type, metadata)
  VALUES (_user_id, _badge, COALESCE(_metadata, '{}'::jsonb))
  ON CONFLICT (user_id, badge_type) DO NOTHING
  RETURNING true INTO _inserted;

  -- بعد منح أي شارة من الثلاث الأساسية، نتحقق من active_store (الثلاث خلال 24 ساعة)
  IF _inserted AND _badge IN ('first_text','first_image','first_video') THEN
    SELECT COUNT(*) INTO _all_three
    FROM public.user_badges
    WHERE user_id = _user_id
      AND badge_type IN ('first_text','first_image','first_video')
      AND awarded_at >= now() - interval '24 hours';

    IF _all_three >= 3 THEN
      INSERT INTO public.user_badges (user_id, badge_type, metadata)
      VALUES (_user_id, 'active_store', jsonb_build_object('triggered_by', _badge))
      ON CONFLICT (user_id, badge_type) DO NOTHING;
    END IF;
  END IF;

  RETURN _inserted;
END;
$$;

-- Trigger على generations (نص/صورة)
CREATE OR REPLACE FUNCTION public.fn_generations_award_first_win()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL OR NEW.result IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.type::text = 'text' THEN
    PERFORM public.fn_award_badge_if_new(NEW.user_id, 'first_text', jsonb_build_object('generation_id', NEW.id));
  ELSIF NEW.type::text = 'image' THEN
    PERFORM public.fn_award_badge_if_new(NEW.user_id, 'first_image', jsonb_build_object('generation_id', NEW.id));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generations_award_first_win ON public.generations;
CREATE TRIGGER generations_award_first_win
  AFTER INSERT ON public.generations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_generations_award_first_win();

-- Trigger على video_jobs (status='completed')
CREATE OR REPLACE FUNCTION public.fn_video_jobs_award_first_video()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status::text = 'completed' THEN
    PERFORM public.fn_award_badge_if_new(NEW.user_id, 'first_video', jsonb_build_object('video_job_id', NEW.id));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS video_jobs_award_first_video ON public.video_jobs;
CREATE TRIGGER video_jobs_award_first_video
  AFTER INSERT OR UPDATE OF status ON public.video_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_video_jobs_award_first_video();

-- ============================================================
-- RPC: get_user_badges
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_badges(_user_id uuid DEFAULT NULL)
RETURNS TABLE (badge_type public.badge_type, awarded_at timestamptz, metadata jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.badge_type, b.awarded_at, b.metadata
  FROM public.user_badges b
  WHERE b.user_id = COALESCE(_user_id, auth.uid())
    AND (b.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ORDER BY b.awarded_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_user_badges(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_badges(uuid) TO authenticated;

-- ============================================================
-- Realtime publication for user_badges (لـ toast realtime)
-- ============================================================
ALTER TABLE public.user_badges REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_badges;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- RPC: get_onboarding_funnel (للأدمن فقط)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_onboarding_funnel(_days integer DEFAULT 7)
RETURNS TABLE (
  total_started bigint,
  step1_completed bigint,
  step2_completed bigint,
  step3_completed bigint,
  wizard_completed bigint,
  autogen_succeeded bigint,
  autogen_failed bigint,
  active_store_badges bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='started' AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='step_completed' AND step=1 AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='step_completed' AND step=2 AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='step_completed' AND step=3 AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='wizard_completed' AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='autogen_succeeded' AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='autogen_failed' AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(*) FROM public.user_badges WHERE badge_type='active_store' AND awarded_at >= now() - (_days || ' days')::interval);
$$;

REVOKE ALL ON FUNCTION public.get_onboarding_funnel(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_onboarding_funnel(integer) TO authenticated;
