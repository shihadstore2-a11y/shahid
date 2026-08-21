-- إكمال سياسة UPDATE على profiles بإضافة WITH CHECK لتفادي أي سلوك غامض في PostgREST
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);