-- Normalize existing WhatsApp numbers to a single canonical format where possible
UPDATE public.profiles
SET whatsapp = CASE
  WHEN whatsapp IS NULL OR btrim(whatsapp) = '' THEN NULL
  ELSE regexp_replace(whatsapp, '[^0-9]', '', 'g')
END;

UPDATE public.profiles
SET whatsapp = CASE
  WHEN whatsapp LIKE '00966%' THEN '966' || substring(whatsapp from 6)
  WHEN whatsapp LIKE '05%' THEN '966' || substring(whatsapp from 2)
  WHEN whatsapp LIKE '5%' AND length(whatsapp) = 9 THEN '966' || whatsapp
  ELSE whatsapp
END
WHERE whatsapp IS NOT NULL;

-- Remove invalid Saudi mobile numbers before enforcing the rule
UPDATE public.profiles
SET whatsapp = NULL
WHERE whatsapp IS NOT NULL
  AND whatsapp !~ '^9665[0-9]{8}$';

-- Existing duplicate cleanup: keep the first profile record and clear the later duplicates
WITH ranked AS (
  SELECT
    id,
    whatsapp,
    row_number() OVER (PARTITION BY whatsapp ORDER BY created_at ASC, id ASC) AS duplicate_rank
  FROM public.profiles
  WHERE whatsapp IS NOT NULL
)
UPDATE public.profiles AS p
SET whatsapp = NULL
FROM ranked AS r
WHERE p.id = r.id
  AND r.duplicate_rank > 1;

-- Canonicalize and validate WhatsApp before every profile save
CREATE OR REPLACE FUNCTION public.normalize_profile_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF NEW.whatsapp IS NULL OR btrim(NEW.whatsapp) = '' THEN
    NEW.whatsapp := NULL;
    RETURN NEW;
  END IF;

  digits := regexp_replace(NEW.whatsapp, '[^0-9]', '', 'g');

  IF digits LIKE '00966%' THEN
    digits := '966' || substring(digits from 6);
  ELSIF digits LIKE '05%' THEN
    digits := '966' || substring(digits from 2);
  ELSIF digits LIKE '5%' AND length(digits) = 9 THEN
    digits := '966' || digits;
  END IF;

  IF digits !~ '^9665[0-9]{8}$' THEN
    RAISE EXCEPTION 'INVALID_SAUDI_WHATSAPP';
  END IF;

  NEW.whatsapp := digits;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_profile_whatsapp_before_save ON public.profiles;
CREATE TRIGGER normalize_profile_whatsapp_before_save
BEFORE INSERT OR UPDATE OF whatsapp ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.normalize_profile_whatsapp();

-- Enforce one WhatsApp number per account after cleanup
CREATE UNIQUE INDEX IF NOT EXISTS profiles_whatsapp_unique_idx
ON public.profiles (whatsapp)
WHERE whatsapp IS NOT NULL;