-- Tighten ab_test_events insert policy (was permissive: WITH CHECK (true))
DROP POLICY IF EXISTS "Anyone can insert ab test events" ON public.ab_test_events;

CREATE POLICY "Anyone can insert valid ab test events"
ON public.ab_test_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Required, non-empty, length-bounded fields
  experiment IS NOT NULL AND char_length(experiment) BETWEEN 1 AND 64
  AND variant IS NOT NULL AND char_length(variant) BETWEEN 1 AND 64
  AND event_type IS NOT NULL AND event_type IN ('view','click','convert','impression','exposure')
  AND session_id IS NOT NULL AND char_length(session_id) BETWEEN 8 AND 128
  AND (user_agent IS NULL OR char_length(user_agent) <= 512)
);
