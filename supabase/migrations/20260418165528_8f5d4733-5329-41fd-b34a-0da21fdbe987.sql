-- Update founding program: 1000 seats with 30% discount, base subscriber count of 563
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS founding_base_count integer NOT NULL DEFAULT 563,
  ADD COLUMN IF NOT EXISTS founding_discount_pct integer NOT NULL DEFAULT 30;

UPDATE public.app_settings
SET founding_total_seats = 1000,
    founding_base_count = 563,
    founding_discount_pct = 30,
    updated_at = now()
WHERE id = 1;