CREATE TABLE public.domain_scan_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('db', 'html', 'combined')),
  status TEXT NOT NULL CHECK (status IN ('clean', 'dirty', 'error')),
  total_matches INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_domain_scan_log_scanned_at ON public.domain_scan_log(scanned_at DESC);
CREATE INDEX idx_domain_scan_log_status ON public.domain_scan_log(status);

ALTER TABLE public.domain_scan_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view domain scan log"
ON public.domain_scan_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert domain scan log"
ON public.domain_scan_log
FOR INSERT
WITH CHECK (auth.role() = 'service_role'::text);