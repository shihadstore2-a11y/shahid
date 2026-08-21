-- Enum for subscription request status
CREATE TYPE public.subscription_request_status AS ENUM (
  'pending',
  'contacted',
  'activated',
  'rejected',
  'expired'
);

-- subscription_requests table
CREATE TABLE public.subscription_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan public.user_plan NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  store_name TEXT,
  whatsapp TEXT NOT NULL,
  email TEXT NOT NULL,
  payment_method TEXT,
  notes TEXT,
  admin_notes TEXT,
  status public.subscription_request_status NOT NULL DEFAULT 'pending',
  activated_at TIMESTAMPTZ,
  activated_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_requests_user ON public.subscription_requests(user_id);
CREATE INDEX idx_subscription_requests_status ON public.subscription_requests(status);
CREATE INDEX idx_subscription_requests_created ON public.subscription_requests(created_at DESC);

ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

-- Users: view & insert their own
CREATE POLICY "Users can view own subscription requests"
ON public.subscription_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscription requests"
ON public.subscription_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins: full access
CREATE POLICY "Admins can view all subscription requests"
ON public.subscription_requests FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update subscription requests"
ON public.subscription_requests FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete subscription requests"
ON public.subscription_requests FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- app_settings table (singleton row id=1)
CREATE TABLE public.app_settings (
  id INTEGER NOT NULL PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  whatsapp_number TEXT NOT NULL DEFAULT '966582286215',
  founding_total_seats INTEGER NOT NULL DEFAULT 50,
  founding_program_active BOOLEAN NOT NULL DEFAULT true,
  bank_name TEXT,
  bank_iban TEXT,
  bank_account_holder TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Public read (it's safe public marketing info)
CREATE POLICY "App settings are publicly readable"
ON public.app_settings FOR SELECT
USING (true);

CREATE POLICY "Only admins can update app settings"
ON public.app_settings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert app settings"
ON public.app_settings FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default settings row
INSERT INTO public.app_settings (id, whatsapp_number, founding_total_seats, founding_program_active)
VALUES (1, '966582286215', 50, true)
ON CONFLICT (id) DO NOTHING;