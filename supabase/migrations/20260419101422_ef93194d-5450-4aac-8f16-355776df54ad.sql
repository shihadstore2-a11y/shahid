-- جدول أحداث A/B Testing
CREATE TABLE public.ab_test_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B')),
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'cta_click', 'demo_try')),
  session_id TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- فهارس للاستعلامات السريعة
CREATE INDEX idx_ab_test_experiment_variant ON public.ab_test_events(experiment, variant, event_type);
CREATE INDEX idx_ab_test_created_at ON public.ab_test_events(created_at DESC);
CREATE INDEX idx_ab_test_session ON public.ab_test_events(session_id);

-- تفعيل RLS
ALTER TABLE public.ab_test_events ENABLE ROW LEVEL SECURITY;

-- أي زائر يستطيع تسجيل حدث (حتى غير المسجّلين)
CREATE POLICY "Anyone can insert ab test events"
ON public.ab_test_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- فقط الأدمن يقرأ الأحداث
CREATE POLICY "Admins can view ab test events"
ON public.ab_test_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));