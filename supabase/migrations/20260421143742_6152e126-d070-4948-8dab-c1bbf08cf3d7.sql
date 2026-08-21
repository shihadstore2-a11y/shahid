-- Fix ab_test_events insert policy to match actual event types used by the app
DROP POLICY IF EXISTS "Anyone can insert valid ab test events" ON public.ab_test_events;

CREATE POLICY "Anyone can insert valid ab test events"
ON public.ab_test_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  experiment IS NOT NULL AND char_length(experiment) BETWEEN 1 AND 64
  AND variant IS NOT NULL AND char_length(variant) BETWEEN 1 AND 32
  AND event_type IS NOT NULL
    AND event_type IN ('view','cta_click','demo_try','click','convert','impression','exposure','signup','submit')
  AND session_id IS NOT NULL AND char_length(session_id) BETWEEN 8 AND 128
  AND (user_agent IS NULL OR char_length(user_agent) <= 512)
);
