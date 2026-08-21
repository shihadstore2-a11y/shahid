DROP POLICY IF EXISTS "Users can insert own generations" ON public.generations;

DROP POLICY IF EXISTS "Users can update own generations" ON public.generations;

CREATE POLICY "Users can update own generations"
ON public.generations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);