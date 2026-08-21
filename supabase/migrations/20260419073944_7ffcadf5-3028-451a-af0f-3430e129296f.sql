-- إضافة أعمدة لتتبع توكنز وتكلفة كل توليد
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS prompt_tokens integer,
  ADD COLUMN IF NOT EXISTS completion_tokens integer,
  ADD COLUMN IF NOT EXISTS total_tokens integer,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric(10,6);

CREATE INDEX IF NOT EXISTS idx_generations_user_created
  ON public.generations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_created_at
  ON public.generations(created_at DESC);