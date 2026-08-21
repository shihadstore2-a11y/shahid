-- دالة مزامنة الخطة + سجل تدقيق
CREATE OR REPLACE FUNCTION public.sync_profile_plan_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- نتفاعل فقط عند الانتقال إلى "activated" مع وجود خطة صالحة
  IF NEW.status = 'activated'::subscription_request_status
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.plan IS NOT NULL THEN
    UPDATE public.profiles
       SET plan = NEW.plan,
           updated_at = now()
     WHERE id = NEW.user_id;

    -- best-effort audit
    BEGIN
      INSERT INTO public.admin_audit_log (
        admin_user_id, action, target_table, target_id, after_value, metadata
      ) VALUES (
        COALESCE(auth.uid(), NEW.user_id),
        'auto_sync_plan_on_activation',
        'profiles',
        NEW.user_id::text,
        jsonb_build_object('plan', NEW.plan),
        jsonb_build_object('subscription_request_id', NEW.id, 'billing_cycle', NEW.billing_cycle)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sync plan audit failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
CREATE TRIGGER trg_sync_profile_plan_on_activation
  AFTER UPDATE ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_plan_on_activation();