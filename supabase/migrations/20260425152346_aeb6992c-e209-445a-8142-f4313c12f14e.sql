DO $$
DECLARE
  _user uuid;
  _request uuid := gen_random_uuid();
  _test_plan public.user_plan;
  _old_plan public.user_plan;
  _old_plan_credits integer;
  _old_topup_credits integer;
  _old_cycle_started_at timestamptz;
  _old_cycle_ends_at timestamptz;
  _old_updated_at timestamptz;
  _blocked boolean := false;
  _third_blocked boolean := false;
  _plan public.user_plan;
  _grant_count integer;
BEGIN
  SELECT p.id, p.plan,
         (SELECT e.plan FROM public.plan_entitlements e
          WHERE e.active = true
            AND e.plan <> p.plan
            AND NOT EXISTS (
              SELECT 1 FROM public.subscription_requests sr
              WHERE sr.user_id = p.id AND sr.plan = e.plan AND sr.status IN ('pending','contacted')
            )
          ORDER BY CASE e.plan WHEN 'starter' THEN 1 WHEN 'growth' THEN 2 WHEN 'pro' THEN 3 WHEN 'business' THEN 4 ELSE 5 END
          LIMIT 1) AS test_plan
    INTO _user, _old_plan, _test_plan
  FROM public.profiles p
  WHERE NOT public.has_role(p.id, 'admin'::public.app_role)
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF _user IS NULL OR _test_plan IS NULL THEN
    RAISE EXCEPTION 'qa_no_suitable_non_admin_profile_or_plan_available';
  END IF;

  SELECT plan_credits, topup_credits, cycle_started_at, cycle_ends_at, updated_at
    INTO _old_plan_credits, _old_topup_credits, _old_cycle_started_at, _old_cycle_ends_at, _old_updated_at
  FROM public.user_credits
  WHERE user_id = _user;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', _user::text, 'role', 'authenticated')::text, true);

  BEGIN
    UPDATE public.profiles
       SET plan = CASE WHEN _old_plan = 'pro' THEN 'growth'::public.user_plan ELSE 'pro'::public.user_plan END
     WHERE id = _user;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%plan_change_not_allowed%' THEN
      _blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT _blocked THEN
    RAISE EXCEPTION 'qa_failed_profile_plan_change_was_not_blocked';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);

  INSERT INTO public.subscription_requests (
    id, user_id, plan, billing_cycle, email, whatsapp, store_name, status, notes
  ) VALUES (
    _request, _user, _test_plan, 'monthly', 'qa-trigger-existing-user@example.invalid', '966500000000', 'QA Trigger Store', 'pending', 'qa-trigger-smoke-test'
  );

  UPDATE public.subscription_requests
     SET status = 'activated'
   WHERE id = _request;

  UPDATE public.subscription_requests
     SET status = 'activated'
   WHERE id = _request;

  SELECT plan INTO _plan FROM public.profiles WHERE id = _user;
  IF _plan <> _test_plan THEN
    RAISE EXCEPTION 'qa_failed_subscription_activation_did_not_sync_plan: expected=% actual=%', _test_plan, _plan;
  END IF;

  SELECT count(*) INTO _grant_count
  FROM public.credit_ledger
  WHERE user_id = _user
    AND txn_type = 'plan_grant'
    AND metadata->>'plan' = _test_plan::text
    AND created_at > now() - interval '5 minutes';

  IF _grant_count <> 1 THEN
    RAISE EXCEPTION 'qa_failed_subscription_activation_not_idempotent: grant_count=% plan=%', _grant_count, _test_plan;
  END IF;

  INSERT INTO public.video_jobs (user_id, prompt, quality, duration_seconds, aspect_ratio, credits_charged, status, metadata)
  VALUES
    (_user, 'qa processing 1', 'fast', 5, '16:9', 1, 'processing', jsonb_build_object('qa', 'trigger-smoke')),
    (_user, 'qa processing 2', 'fast', 5, '16:9', 1, 'processing', jsonb_build_object('qa', 'trigger-smoke'));

  BEGIN
    INSERT INTO public.video_jobs (user_id, prompt, quality, duration_seconds, aspect_ratio, credits_charged, status, metadata)
    VALUES (_user, 'qa processing 3', 'fast', 5, '16:9', 1, 'processing', jsonb_build_object('qa', 'trigger-smoke'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%too_many_processing_video_jobs%' THEN
      _third_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT _third_blocked THEN
    RAISE EXCEPTION 'qa_failed_third_processing_video_job_was_not_blocked';
  END IF;

  DELETE FROM public.video_jobs WHERE user_id = _user AND metadata->>'qa' = 'trigger-smoke';
  DELETE FROM public.subscription_requests WHERE id = _request;
  DELETE FROM public.credit_ledger WHERE user_id = _user AND created_at > now() - interval '5 minutes' AND ((metadata->>'plan') = _test_plan::text OR (metadata->>'reason') = 'monthly_reset');

  UPDATE public.user_credits
     SET plan_credits = COALESCE(_old_plan_credits, 0),
         topup_credits = COALESCE(_old_topup_credits, 0),
         cycle_started_at = COALESCE(_old_cycle_started_at, now()),
         cycle_ends_at = _old_cycle_ends_at,
         updated_at = COALESCE(_old_updated_at, now())
   WHERE user_id = _user;

  UPDATE public.profiles
     SET plan = _old_plan
   WHERE id = _user;

  RAISE NOTICE 'qa_trigger_smoke_passed user=% plan=%', _user, _test_plan;
END $$;