-- =========================================
-- 1) ENUM لأنواع الموافقات
-- =========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consent_type') THEN
    CREATE TYPE public.consent_type AS ENUM (
      'marketing_email',
      'marketing_whatsapp',
      'marketing_telegram',
      'marketing_sms',
      'product_updates',
      'newsletter'
    );
  END IF;
END
$$;

-- =========================================
-- 2) ENUM لمصادر الموافقة
-- =========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consent_source') THEN
    CREATE TYPE public.consent_source AS ENUM (
      'onboarding',
      'settings',
      'subscription_form',
      'telegram_bot',
      'whatsapp_form',
      'admin_action',
      'api'
    );
  END IF;
END
$$;

-- =========================================
-- 3) جدول consent_records
-- =========================================
CREATE TABLE IF NOT EXISTS public.consent_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type    public.consent_type NOT NULL,
  consent_given   boolean NOT NULL,
  consent_text    text NOT NULL,
  consent_version text NOT NULL DEFAULT 'v1',
  source          public.consent_source NOT NULL,
  ip_address      inet,
  user_agent      text,
  withdrawn_at    timestamptz,
  withdrawn_reason text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_records_text_length CHECK (
    char_length(consent_text) >= 10 AND char_length(consent_text) <= 5000
  ),
  CONSTRAINT consent_records_version_format CHECK (
    consent_version ~ '^v[0-9]+(\.[0-9]+)?$'
  ),
  CONSTRAINT consent_records_user_agent_length CHECK (
    user_agent IS NULL OR char_length(user_agent) <= 1000
  ),
  CONSTRAINT consent_records_withdrawn_consistency CHECK (
    (withdrawn_at IS NULL) OR (consent_given = true)
  ),
  CONSTRAINT consent_records_metadata_size CHECK (
    pg_column_size(metadata) <= 4000
  )
);

-- =========================================
-- 4) Indexes
-- =========================================
CREATE INDEX IF NOT EXISTS idx_consent_records_user_type 
  ON public.consent_records(user_id, consent_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consent_records_user_active 
  ON public.consent_records(user_id, consent_type) 
  WHERE consent_given = true AND withdrawn_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_consent_records_created 
  ON public.consent_records(created_at DESC);

-- =========================================
-- 5) RLS Policies
-- =========================================
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own consents" ON public.consent_records;
CREATE POLICY "Users can view own consents"
  ON public.consent_records FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all consents" ON public.consent_records;
CREATE POLICY "Admins can view all consents"
  ON public.consent_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Service role can insert consents" ON public.consent_records;
CREATE POLICY "Service role can insert consents"
  ON public.consent_records FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

-- =========================================
-- 6) أعمدة جديدة في profiles
-- =========================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_email_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_telegram_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS product_updates_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_last_updated_at timestamptz;

-- =========================================
-- 7) record_consent
-- =========================================
CREATE OR REPLACE FUNCTION public.record_consent(
  _consent_type    public.consent_type,
  _consent_given   boolean,
  _consent_text    text,
  _consent_version text DEFAULT 'v1',
  _source          public.consent_source DEFAULT 'settings',
  _user_agent      text DEFAULT NULL,
  _metadata        jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _record_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: user must be authenticated';
  END IF;
  INSERT INTO public.consent_records (
    user_id, consent_type, consent_given, consent_text, 
    consent_version, source, user_agent, metadata
  )
  VALUES (
    _user_id, _consent_type, _consent_given, _consent_text,
    _consent_version, _source, _user_agent, _metadata
  )
  RETURNING id INTO _record_id;
  RETURN _record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_consent FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_consent TO authenticated;

-- =========================================
-- 8) withdraw_consent
-- =========================================
CREATE OR REPLACE FUNCTION public.withdraw_consent(
  _consent_type public.consent_type,
  _reason       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _record_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: user must be authenticated';
  END IF;
  INSERT INTO public.consent_records (
    user_id, consent_type, consent_given, consent_text,
    consent_version, source, withdrawn_at, withdrawn_reason, metadata
  )
  VALUES (
    _user_id, _consent_type, false,
    'سحب موافقة من قبل المستخدم', 'v1', 'settings',
    now(), _reason, jsonb_build_object('action', 'withdrawal')
  )
  RETURNING id INTO _record_id;
  RETURN _record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_consent FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_consent TO authenticated;

-- =========================================
-- 9) get_user_consent_status
-- =========================================
CREATE OR REPLACE FUNCTION public.get_user_consent_status(
  _consent_type public.consent_type DEFAULT NULL
)
RETURNS TABLE (
  consent_type   public.consent_type,
  consent_given  boolean,
  last_updated   timestamptz,
  source         public.consent_source,
  consent_version text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: user must be authenticated';
  END IF;
  RETURN QUERY
  WITH latest_consents AS (
    SELECT DISTINCT ON (cr.consent_type)
      cr.consent_type, cr.consent_given, cr.created_at AS last_updated,
      cr.source, cr.consent_version, cr.withdrawn_at
    FROM public.consent_records cr
    WHERE cr.user_id = _user_id
      AND (_consent_type IS NULL OR cr.consent_type = _consent_type)
    ORDER BY cr.consent_type, cr.created_at DESC
  )
  SELECT lc.consent_type,
    (lc.consent_given AND lc.withdrawn_at IS NULL) AS consent_given,
    lc.last_updated, lc.source, lc.consent_version
  FROM latest_consents lc;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_consent_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_consent_status TO authenticated;

-- =========================================
-- 10) sync_profile_consent_status + trigger
-- =========================================
CREATE OR REPLACE FUNCTION public.sync_profile_consent_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_active boolean;
BEGIN
  _is_active := NEW.consent_given AND NEW.withdrawn_at IS NULL;
  IF NEW.consent_type = 'marketing_email' THEN
    UPDATE public.profiles 
       SET marketing_email_opt_in = _is_active,
           consent_last_updated_at = NEW.created_at
     WHERE id = NEW.user_id;
  ELSIF NEW.consent_type = 'marketing_whatsapp' THEN
    UPDATE public.profiles 
       SET marketing_whatsapp_opt_in = _is_active,
           consent_last_updated_at = NEW.created_at
     WHERE id = NEW.user_id;
  ELSIF NEW.consent_type = 'marketing_telegram' THEN
    UPDATE public.profiles 
       SET marketing_telegram_opt_in = _is_active,
           consent_last_updated_at = NEW.created_at
     WHERE id = NEW.user_id;
  ELSIF NEW.consent_type = 'product_updates' THEN
    UPDATE public.profiles 
       SET product_updates_opt_in = _is_active,
           consent_last_updated_at = NEW.created_at
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_consent_status ON public.consent_records;
CREATE TRIGGER trg_sync_profile_consent_status
AFTER INSERT ON public.consent_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_consent_status();

-- =========================================
-- 11) has_marketing_consent
-- =========================================
CREATE OR REPLACE FUNCTION public.has_marketing_consent(
  _user_id      uuid,
  _consent_type public.consent_type
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _has_consent boolean;
BEGIN
  SELECT (cr.consent_given AND cr.withdrawn_at IS NULL)
    INTO _has_consent
    FROM public.consent_records cr
   WHERE cr.user_id = _user_id
     AND cr.consent_type = _consent_type
   ORDER BY cr.created_at DESC
   LIMIT 1;
  RETURN COALESCE(_has_consent, false);
END;
$$;

REVOKE ALL ON FUNCTION public.has_marketing_consent FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_marketing_consent TO service_role;
GRANT EXECUTE ON FUNCTION public.has_marketing_consent TO authenticated;

-- =========================================
-- 12) admin_consent_stats view
-- =========================================
CREATE OR REPLACE VIEW public.admin_consent_stats AS
SELECT 
  consent_type,
  COUNT(DISTINCT user_id) AS total_users_decided,
  COUNT(DISTINCT user_id) FILTER (WHERE consent_given AND withdrawn_at IS NULL) AS active_consents,
  COUNT(DISTINCT user_id) FILTER (WHERE NOT consent_given) AS denied_consents,
  COUNT(DISTINCT user_id) FILTER (WHERE withdrawn_at IS NOT NULL) AS withdrawn_consents,
  MIN(created_at) AS first_consent_at,
  MAX(created_at) AS last_consent_at
FROM public.consent_records
GROUP BY consent_type;

-- =========================================
-- 13) COMMENTS
-- =========================================
COMMENT ON TABLE public.consent_records IS 
  'Immutable audit log for user consent under PDPL (Saudi Arabia). Records cannot be updated or deleted. Use withdraw_consent function to add a new withdrawal record.';

COMMENT ON FUNCTION public.record_consent IS 
  'Records a new consent. Inserts a new immutable row in consent_records. Use this from client-side after showing the user a clear consent dialog.';

COMMENT ON FUNCTION public.withdraw_consent IS 
  'Withdraws a previously given consent. Inserts a new row marking withdrawal (does not modify old record).';

COMMENT ON FUNCTION public.has_marketing_consent IS 
  'Server-side check before sending any marketing message. Returns true only if user has given AND not withdrawn the specified consent type.';