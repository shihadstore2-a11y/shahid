-- Add idempotent daily image quota release for technical failures.
CREATE OR REPLACE FUNCTION public.release_image_daily_quota(_user_id uuid DEFAULT auth.uid())
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

  UPDATE public.daily_text_usage
  SET image_count = GREATEST(image_count - 1, 0), updated_at = now()
  WHERE user_id = _uid AND day = _today AND image_count > 0;
END;
$$;