-- P0 hardening: video constraints, plan protection, operational switches, receipt OCR tracking

-- 1) Ensure video jobs cannot store unsupported quality/duration/aspect values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'video_jobs_duration_seconds_allowed'
      AND conrelid = 'public.video_jobs'::regclass
  ) THEN
    ALTER TABLE public.video_jobs
      ADD CONSTRAINT video_jobs_duration_seconds_allowed
      CHECK (duration_seconds IN (5, 8));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'video_jobs_aspect_ratio_allowed'
      AND conrelid = 'public.video_jobs'::regclass
  ) THEN
    ALTER TABLE public.video_jobs
      ADD CONSTRAINT video_jobs_aspect_ratio_allowed
      CHECK (aspect_ratio IN ('9:16', '1:1', '16:9'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'video_jobs_provider_required'
      AND conrelid = 'public.video_jobs'::regclass
  ) THEN
    ALTER TABLE public.video_jobs
      ADD CONSTRAINT video_jobs_provider_required
      CHECK (char_length(provider) BETWEEN 2 AND 64);
  END IF;
END $$;

-- 2) Protect profile plan changes at database level.
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
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

-- 3) Keep at most two processing video jobs per user.
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

-- 4) Remove obsolete monthly generation quota trigger if it exists; daily quotas are the active guard.
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;

-- 5) Central operational switches for fast financial risk control.
CREATE TABLE IF NOT EXISTS public.operational_switches (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  reason text,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_switches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view operational switches" ON public.operational_switches;
CREATE POLICY "Admins can view operational switches"
ON public.operational_switches
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage operational switches" ON public.operational_switches;
CREATE POLICY "Admins can manage operational switches"
ON public.operational_switches
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_update_operational_switches_updated_at ON public.operational_switches;
CREATE TRIGGER trg_update_operational_switches_updated_at
BEFORE UPDATE ON public.operational_switches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.operational_switches (key, enabled, reason)
VALUES
  ('video_enabled', true, 'يسمح بتوليد الفيديو عموماً'),
  ('video_quality_enabled', true, 'يسمح بجودة الفيديو الأعلى عند توفرها في الباقة'),
  ('image_pro_enabled', true, 'يسمح بصور Pro عند توفرها في الباقة'),
  ('ocr_receipt_enabled', true, 'يسمح بتحليل إيصالات الدفع آلياً')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.operational_switch_enabled(_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT enabled FROM public.operational_switches WHERE key = _key), true)
$$;

-- 6) Receipt OCR idempotency tracking.
ALTER TABLE public.subscription_requests
  ADD COLUMN IF NOT EXISTS ocr_processed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ocr_receipt_path text,
  ADD COLUMN IF NOT EXISTS ocr_status text,
  ADD COLUMN IF NOT EXISTS ocr_error text;

-- 7) Storage policies for payment receipts: owner folder isolation + admin visibility.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own payment receipts" ON storage.objects;
CREATE POLICY "Users can upload own payment receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own payment receipts" ON storage.objects;
CREATE POLICY "Users can update own payment receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can view own payment receipts" ON storage.objects;
CREATE POLICY "Users can view own payment receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Admins can view payment receipts" ON storage.objects;
CREATE POLICY "Admins can view payment receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);