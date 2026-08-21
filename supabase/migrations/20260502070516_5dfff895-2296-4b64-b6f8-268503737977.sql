ALTER TABLE public.backup_video_jobs_20260502 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_video_provider_configs_20260502 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only - backup_video_jobs" ON public.backup_video_jobs_20260502
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins only - backup_video_provider_configs" ON public.backup_video_provider_configs_20260502
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));