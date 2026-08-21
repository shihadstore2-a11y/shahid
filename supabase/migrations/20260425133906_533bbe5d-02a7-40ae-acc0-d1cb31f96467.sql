-- Phase 1 hardening: plans, profile plan safety, video constraints, quotas/refunds

-- 1) Keep plan catalog aligned with current public pricing while reducing Free image risk.
INSERT INTO public.plan_credits (plan, monthly_credits, daily_text_cap, daily_image_cap)
VALUES
  ('free'::public.user_plan, 150, 200, 5),
  ('starter'::public.user_plan, 3000, 200, 25),
  ('growth'::public.user_plan, 6000, 300, 50),
  ('pro'::public.user_plan, 11000, 600, 100),
  ('business'::public.user_plan, 30000, 1000, 150)
ON CONFLICT (plan) DO UPDATE
SET monthly_credits = EXCLUDED.monthly_credits,
    daily_text_cap = EXCLUDED.daily_text_cap,
    daily_image_cap = EXCLUDED.daily_image_cap,
    updated_at = now();

-- 2) Retire the old monthly generation trigger; daily quota functions are now authoritative.
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;
DROP TRIGGER IF EXISTS enforce_generation_quota_before_insert ON public.generations;

-- 3) Prevent users from self-upgrading profiles.plan while preserving normal profile edits.
CREATE OR REPLACE FUNCTION public.protect_profile_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'plan_change_not_allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_plan_change ON public.profiles;
CREATE TRIGGER trg_protect_profile_plan_change
BEFORE UPDATE OF plan ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

-- 4) Make video duration database rules match the app UI/server: 5 or 8 seconds.
ALTER TABLE public.video_jobs
DROP CONSTRAINT IF EXISTS video_jobs_duration_seconds_check;

ALTER TABLE public.video_jobs
ADD CONSTRAINT video_jobs_duration_seconds_check
CHECK (duration_seconds IN (5, 8));

-- 5) Database-level guard against concurrent processing video jobs per user.
CREATE OR REPLACE FUNCTION public.enforce_video_processing_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _processing_count integer;
BEGIN
  IF NEW.status = 'processing'::public.video_job_status THEN
    PERFORM pg_advisory_xact_lock(hashtext('video_processing_' || NEW.user_id::text));

    SELECT count(*) INTO _processing_count
    FROM public.video_jobs
    WHERE user_id = NEW.user_id
      AND status = 'processing'::public.video_job_status
      AND id IS DISTINCT FROM NEW.id;

    IF _processing_count >= 2 THEN
      RAISE EXCEPTION 'too_many_processing_video_jobs';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_video_processing_limit ON public.video_jobs;
CREATE TRIGGER trg_enforce_video_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

-- 6) Make subscription credit reset fail loudly instead of silently activating without credits.
CREATE OR REPLACE FUNCTION public.reset_credits_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'activated'::subscription_request_status
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.plan IS NOT NULL THEN
    PERFORM public.reset_monthly_credits(NEW.user_id, NEW.plan);
  END IF;
  RETURN NEW;
END;
$$;

-- 7) Tighten video daily quota release to owner/admin/service only.
CREATE OR REPLACE FUNCTION public.release_video_daily_quota(_user_id uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _uid uuid := COALESCE(_user_id, auth.uid());
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF auth.role() <> 'service_role'
     AND _uid IS DISTINCT FROM _caller
     AND NOT public.has_role(_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden_not_owner';
  END IF;

  UPDATE public.daily_video_usage
  SET video_count = GREATEST(video_count - 1, 0), updated_at = now()
  WHERE user_id = _uid AND day = _today AND video_count > 0;
END;
$$;

-- 8) Ensure authenticated users can only execute refund/release through ownership checks in the functions.
REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.release_video_daily_quota(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_video_daily_quota(uuid) TO authenticated, service_role;
