-- Ensure required operational triggers exist and stale duplicates are removed
DROP TRIGGER IF EXISTS trg_profiles_protect_plan_change ON public.profiles;
DROP TRIGGER IF EXISTS protect_profile_plan_change_trigger ON public.profiles;
CREATE TRIGGER trg_profiles_protect_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

DROP TRIGGER IF EXISTS trg_subscription_requests_sync_plan ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
CREATE TRIGGER trg_subscription_requests_sync_plan
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

DROP TRIGGER IF EXISTS trg_subscription_requests_reset_credits ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
CREATE TRIGGER trg_subscription_requests_reset_credits
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

DROP TRIGGER IF EXISTS trg_video_jobs_processing_limit ON public.video_jobs;
CREATE TRIGGER trg_video_jobs_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON public.video_jobs;
CREATE TRIGGER trg_video_jobs_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_subscription_requests_updated_at ON public.subscription_requests;
CREATE TRIGGER trg_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_daily_text_usage_updated_at ON public.daily_text_usage;
CREATE TRIGGER trg_daily_text_usage_updated_at
BEFORE UPDATE ON public.daily_text_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_daily_video_usage_updated_at ON public.daily_video_usage;
CREATE TRIGGER trg_daily_video_usage_updated_at
BEFORE UPDATE ON public.daily_video_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.video_jobs
  DROP CONSTRAINT IF EXISTS video_jobs_duration_seconds_allowed,
  ADD CONSTRAINT video_jobs_duration_seconds_allowed CHECK (duration_seconds IN (5, 8));

ALTER TABLE public.video_jobs
  DROP CONSTRAINT IF EXISTS video_jobs_aspect_ratio_allowed,
  ADD CONSTRAINT video_jobs_aspect_ratio_allowed CHECK (aspect_ratio IN ('16:9', '9:16', '1:1'));

-- Align initial signup grants with the free plan in plan_entitlements (free = 0 video credits)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _credits integer;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  IF LOWER(NEW.email) = 'saalla012@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  SELECT monthly_credits INTO _credits
  FROM public.plan_entitlements
  WHERE plan = 'free'::public.user_plan AND active = true;

  IF _credits IS NULL THEN _credits := 0; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  IF _credits > 0 THEN
    INSERT INTO public.credit_ledger (
      user_id, txn_type, amount, source,
      balance_after_plan, balance_after_topup, metadata
    ) VALUES (
      NEW.id, 'plan_grant', _credits, 'plan',
      _credits, 0,
      jsonb_build_object('reason','initial_signup','plan','free','credit_scope','video','source','plan_entitlements')
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_initial_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _credits integer;
BEGIN
  SELECT monthly_credits INTO _credits
  FROM public.plan_entitlements
  WHERE plan = COALESCE(NEW.plan, 'free'::public.user_plan) AND active = true;

  IF _credits IS NULL THEN _credits := 0; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  IF _credits > 0 THEN
    INSERT INTO public.credit_ledger (
      user_id, txn_type, amount, source,
      balance_after_plan, balance_after_topup, metadata
    ) VALUES (
      NEW.id, 'plan_grant', _credits, 'plan',
      _credits, 0,
      jsonb_build_object('reason', 'initial_signup', 'plan', NEW.plan, 'credit_scope', 'video', 'source', 'plan_entitlements')
    );
  END IF;

  RETURN NEW;
END;
$function$;