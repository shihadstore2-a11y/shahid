-- Allow users to insert their own usage rows
CREATE POLICY "Users can insert own usage"
ON public.usage_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own usage rows
CREATE POLICY "Users can update own usage"
ON public.usage_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);