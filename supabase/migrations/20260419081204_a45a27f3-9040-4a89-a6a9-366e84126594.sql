
-- Allow admins to read all generations and usage_logs for analytics dashboard
CREATE POLICY "Admins can view all generations"
  ON public.generations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can view all usage_logs"
  ON public.usage_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
