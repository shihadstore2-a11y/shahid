-- Tighten subscription_requests INSERT policy to prevent impersonation
DROP POLICY IF EXISTS "Users can create own subscription requests" ON public.subscription_requests;

CREATE POLICY "Users can create own subscription requests"
ON public.subscription_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  AND length(coalesce(email, '')) BETWEEN 5 AND 254
  AND length(coalesce(whatsapp, '')) BETWEEN 6 AND 20
);