-- 1) Pin search_path on pgmq wrapper functions (security)
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- 2) Performance index on generations
CREATE INDEX IF NOT EXISTS idx_generations_user_created
  ON public.generations (user_id, created_at DESC);

-- 3) Ensure unique constraint for atomic upsert on usage_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usage_logs_user_month_unique'
  ) THEN
    ALTER TABLE public.usage_logs
      ADD CONSTRAINT usage_logs_user_month_unique UNIQUE (user_id, month);
  END IF;
END$$;

-- 4) Atomic bump_usage RPC (race-condition safe)
CREATE OR REPLACE FUNCTION public.bump_usage(_month text, _kind text)
RETURNS public.usage_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.usage_logs;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _kind NOT IN ('text','image') THEN
    RAISE EXCEPTION 'invalid kind';
  END IF;

  INSERT INTO public.usage_logs (user_id, month, text_count, image_count)
  VALUES (
    _uid,
    _month,
    CASE WHEN _kind = 'text'  THEN 1 ELSE 0 END,
    CASE WHEN _kind = 'image' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, month) DO UPDATE
    SET text_count  = public.usage_logs.text_count  + EXCLUDED.text_count,
        image_count = public.usage_logs.image_count + EXCLUDED.image_count,
        updated_at  = now()
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_usage(text, text) TO authenticated;

-- 5) Move sensitive bank fields out of public app_settings into payment_settings
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id integer PRIMARY KEY DEFAULT 1,
  bank_name text,
  bank_account_holder text,
  bank_iban text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_settings_singleton CHECK (id = 1)
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view bank details (needed to make a transfer)
DROP POLICY IF EXISTS "Authenticated users can view payment settings" ON public.payment_settings;
CREATE POLICY "Authenticated users can view payment settings"
  ON public.payment_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can write
DROP POLICY IF EXISTS "Admins manage payment settings" ON public.payment_settings;
CREATE POLICY "Admins manage payment settings"
  ON public.payment_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing data
INSERT INTO public.payment_settings (id, bank_name, bank_account_holder, bank_iban, updated_at)
SELECT 1, bank_name, bank_account_holder, bank_iban, now()
FROM public.app_settings
WHERE id = 1
ON CONFLICT (id) DO UPDATE
  SET bank_name = EXCLUDED.bank_name,
      bank_account_holder = EXCLUDED.bank_account_holder,
      bank_iban = EXCLUDED.bank_iban,
      updated_at = now();

-- Drop the public columns (IBAN is no longer publicly readable)
ALTER TABLE public.app_settings DROP COLUMN IF EXISTS bank_name;
ALTER TABLE public.app_settings DROP COLUMN IF EXISTS bank_account_holder;
ALTER TABLE public.app_settings DROP COLUMN IF EXISTS bank_iban;