CREATE OR REPLACE FUNCTION public.notify_admin_on_subscription_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  webhook_url text;
  webhook_secret text;
  admin_chat_id text;
BEGIN
  BEGIN
    SELECT value INTO webhook_url FROM public.internal_config WHERE key = 'notify_webhook_url';
    SELECT value INTO webhook_secret FROM public.internal_config WHERE key = 'notify_webhook_secret';
    SELECT value INTO admin_chat_id FROM public.internal_config WHERE key = 'telegram_admin_chat_id';

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
      body := jsonb_build_object(
        'request_id', NEW.id::text,
        'admin_chat_id', admin_chat_id,
        'request', jsonb_build_object(
          'plan', NEW.plan,
          'billing_cycle', NEW.billing_cycle,
          'store_name', NEW.store_name,
          'email', NEW.email,
          'whatsapp', NEW.whatsapp,
          'payment_method', NEW.payment_method,
          'status', NEW.status,
          'notes', NEW.notes
        )
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;