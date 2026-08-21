-- Consolidated Supabase Schema Migration Script
-- Generated for fresh Supabase database initialization

-- ==========================================
-- Migration File: 20260418134654_e6ba39c0-ba35-40d8-874b-5cd0677eefec.sql
-- ==========================================


-- =========================================
-- 1) ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.generation_type AS ENUM ('text', 'image', 'image_enhance');
CREATE TYPE public.user_plan AS ENUM ('free', 'pro', 'business');

-- =========================================
-- 2) Helper: updated_at trigger function
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================
-- 3) PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  full_name     TEXT,
  store_name    TEXT,
  product_type  TEXT,
  audience      TEXT,
  tone          TEXT,
  brand_color   TEXT DEFAULT '#1a5d3e',
  whatsapp      TEXT,
  plan          public.user_plan NOT NULL DEFAULT 'free',
  onboarded     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 4) USER ROLES (separate table — security best practice)
-- =========================================
CREATE TABLE public.user_roles (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- 5) GENERATIONS
-- =========================================
CREATE TABLE public.generations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         public.generation_type NOT NULL,
  prompt       TEXT NOT NULL,
  result       TEXT,
  model_used   TEXT,
  template     TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  is_favorite  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_generations_user_created
  ON public.generations (user_id, created_at DESC);

CREATE INDEX idx_generations_user_favorite
  ON public.generations (user_id, is_favorite)
  WHERE is_favorite = true;

CREATE POLICY "Users can view own generations"
  ON public.generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations"
  ON public.generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations"
  ON public.generations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generations"
  ON public.generations FOR DELETE
  USING (auth.uid() = user_id);

-- =========================================
-- 6) USAGE LOGS (read-only for users — server writes via service role)
-- =========================================
CREATE TABLE public.usage_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month        TEXT NOT NULL,
  text_count   INT NOT NULL DEFAULT 0,
  image_count  INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON public.usage_logs FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE intentionally NOT exposed to client — only Edge Functions (service role)

CREATE TRIGGER update_usage_logs_updated_at
  BEFORE UPDATE ON public.usage_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 7) Auto-create profile + assign 'user' role on signup
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- 8) STORAGE: generated-images bucket
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-images', 'generated-images', true);

CREATE POLICY "Generated images are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'generated-images');

CREATE POLICY "Users can upload own images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'generated-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'generated-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'generated-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ==========================================
-- Migration File: 20260418134710_9a617ac2-ea21-43fd-b465-2289dab5e72d.sql
-- ==========================================


-- Drop the broad public SELECT policy that allowed listing all files
DROP POLICY IF EXISTS "Generated images are publicly viewable" ON storage.objects;

-- Allow public read of specific files (direct URL access works), but prevent listing
-- Users can list/view their own folder
CREATE POLICY "Users can view own folder"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'generated-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Note: The bucket remains "public" so direct URLs work for sharing generated images,
-- but the absence of a broad SELECT policy means listing is restricted to owners.


-- ==========================================
-- Migration File: 20260418143041_0c65a34b-b1de-4ec3-b819-dcf5adf157f9.sql
-- ==========================================

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

-- ==========================================
-- Migration File: 20260418153353_1dec582a-b392-4a10-b1c2-db5d19b98748.sql
-- ==========================================

-- Auto-assign admin role to saalla012@gmail.com on signup
-- Also assigns retroactively if user already exists

-- 1. Update handle_new_user to grant admin to specific email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  );

  -- Grant admin role to the founder email, regular user role to everyone else
  IF LOWER(NEW.email) = 'saalla012@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Retroactively grant admin if the user already exists
DO $$
DECLARE
  founder_id uuid;
BEGIN
  SELECT id INTO founder_id FROM auth.users WHERE LOWER(email) = 'saalla012@gmail.com' LIMIT 1;
  IF founder_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (founder_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- ==========================================
-- Migration File: 20260418160332_45fde5a5-0361-4517-aaa2-a237418ceb20.sql
-- ==========================================

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

-- ==========================================
-- Migration File: 20260418165528_8f5d4733-5329-41fd-b34a-0da21fdbe987.sql
-- ==========================================

-- Update founding program: 1000 seats with 30% discount, base subscriber count of 563
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS founding_base_count integer NOT NULL DEFAULT 563,
  ADD COLUMN IF NOT EXISTS founding_discount_pct integer NOT NULL DEFAULT 30;

UPDATE public.app_settings
SET founding_total_seats = 1000,
    founding_base_count = 563,
    founding_discount_pct = 30,
    updated_at = now()
WHERE id = 1;

-- ==========================================
-- Migration File: 20260418165635_38c53765-fb72-4b59-aef7-df4863ad4316.sql
-- ==========================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_requests;

-- ==========================================
-- Migration File: 20260418172233_92cfc949-693e-4b26-a884-773b2b6cdea2.sql
-- ==========================================

UPDATE public.app_settings SET founding_base_count = 564, updated_at = now() WHERE id = 1;

-- ==========================================
-- Migration File: 20260418173629_0e775a72-44f9-4f45-9217-779c00e45ecf.sql
-- ==========================================

-- 1. إضافة أعمدة الإيصال لجدول طلبات الاشتراك
ALTER TABLE public.subscription_requests
ADD COLUMN IF NOT EXISTS receipt_path text,
ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamp with time zone;

-- 2. إنشاء bucket خاص للإيصالات
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. RLS Policies على storage.objects للـbucket payment-receipts

-- INSERT: المستخدم يرفع لـfolder الخاص به فقط (مسار = user_id/...)
CREATE POLICY "Users can upload own payment receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: المستخدم يقرأ ملفاته + الأدمن يقرأ الكل
CREATE POLICY "Users can view own payment receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- UPDATE: المستخدم يستبدل ملفاته (للسماح بإعادة الرفع)
CREATE POLICY "Users can update own payment receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: الأدمن فقط (الإيصالات سجل محاسبي)
CREATE POLICY "Admins can delete payment receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- ==========================================
-- Migration File: 20260418184718_3c70320a-b067-454a-9e0f-d63a4070b790.sql
-- ==========================================

UPDATE public.app_settings SET bank_name = 'مصرف الإنماء', updated_at = now() WHERE id = 1;

-- ==========================================
-- Migration File: 20260418191936_6d42b059-0e13-40a5-87f2-a40f67b36494.sql
-- ==========================================

-- 1) Enable pg_net for HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Internal config table (admin-only, no public access)
CREATE TABLE IF NOT EXISTS public.internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view internal config" ON public.internal_config;
CREATE POLICY "Admins can view internal config"
  ON public.internal_config FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage internal config" ON public.internal_config;
CREATE POLICY "Admins can manage internal config"
  ON public.internal_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Trigger function — sends async HTTP POST to TanStack server route
CREATE OR REPLACE FUNCTION public.notify_admin_on_subscription_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  webhook_url text;
  webhook_secret text;
BEGIN
  BEGIN
    SELECT value INTO webhook_url FROM public.internal_config WHERE key = 'notify_webhook_url';
    SELECT value INTO webhook_secret FROM public.internal_config WHERE key = 'notify_webhook_secret';

    IF webhook_url IS NULL OR webhook_secret IS NULL THEN
      RAISE WARNING 'notify_admin: webhook config missing, skipping';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', webhook_secret
      ),
      body := jsonb_build_object('request_id', NEW.id::text),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 4) Attach trigger
DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;
CREATE TRIGGER trg_notify_admin_on_subscription_request
  AFTER INSERT ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_subscription_request();

-- ==========================================
-- Migration File: 20260418200151_4b3949cc-7805-4dbc-af3d-1c1f5155a719.sql
-- ==========================================

CREATE OR REPLACE FUNCTION public.notify_admin_on_subscription_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  webhook_url text;
  webhook_secret text;
  admin_chat_id text;
BEGIN
  BEGIN
    SELECT value INTO webhook_url FROM public.internal_config WHERE key = 'notify_webhook_url';
    SELECT value INTO webhook_secret FROM public.internal_config WHERE key = 'notify_webhook_secret';
    SELECT value INTO admin_chat_id FROM public.internal_config WHERE key = 'telegram_admin_chat_id';

    IF webhook_url IS NULL OR webhook_secret IS NULL THEN
      RAISE WARNING 'notify_admin: webhook config missing, skipping';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', webhook_secret
      ),
      body := jsonb_build_object(
        'request_id', NEW.id::text,
        'admin_chat_id', admin_chat_id,
        'request', jsonb_build_object(
          'plan', NEW.plan,
          'billing_cycle', NEW.billing_cycle,
          'store_name', NEW.store_name,
          'email', NEW.email,
          'whatsapp', NEW.whatsapp,
          'payment_method', NEW.payment_method,
          'status', NEW.status,
          'notes', NEW.notes
        )
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- ==========================================
-- Migration File: 20260418200846_19cd8dad-fbb5-43b8-80a2-3c6b120977b6.sql
-- ==========================================

UPDATE public.internal_config 
SET value = 'https://id-preview--694f48b8-26d0-46e8-9443-b81b61c8f1f6.lovable.app/api/notify-telegram-admin',
    updated_at = now()
WHERE key = 'notify_webhook_url';

-- ==========================================
-- Migration File: 20260418204259_email_infra.sql
-- ==========================================

-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: DO $$ BEGIN BEGIN PERFORM cron.unschedule('process-email-queue'); EXCEPTION WHEN OTHERS THEN NULL; END; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ==========================================
-- Migration File: 20260418210642_19ff1557-0a4c-44fd-aa44-925c0cbcd71b.sql
-- ==========================================

-- Test data: set one subscription to expire in 7 days, one in 1 day
UPDATE subscription_requests
SET activated_until = now() + INTERVAL '7 days'
WHERE id = 'b2d7090a-a979-433c-8dfe-3745aa790407';

UPDATE subscription_requests
SET activated_until = now() + INTERVAL '1 day'
WHERE id = 'c52ad8c3-a3f9-423a-8807-e55dd77f22c2';

-- Cleanup old DLQ rows (emails disabled era) so dashboard reflects current reality
DELETE FROM email_send_log WHERE status = 'dlq';

-- ==========================================
-- Migration File: 20260419065051_9db963b3-deab-44e4-bb73-58cea563757a.sql
-- ==========================================

DELETE FROM public.email_send_log WHERE message_id LIKE 'sub-expiring-1d-%';

-- ==========================================
-- Migration File: 20260419070619_987e838e-7669-4bf7-b048-f4c467def441.sql
-- ==========================================

-- 1) Pin search_path on pgmq wrapper functions (security)
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- 2) Performance index on generations
CREATE INDEX IF NOT EXISTS idx_generations_user_created
  ON public.generations (user_id, created_at DESC);

-- 3) Ensure unique constraint for atomic upsert on usage_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usage_logs_user_month_unique'
  ) THEN
    ALTER TABLE public.usage_logs
      ADD CONSTRAINT usage_logs_user_month_unique UNIQUE (user_id, month);
  END IF;
END$$;

-- 4) Atomic bump_usage RPC (race-condition safe)
CREATE OR REPLACE FUNCTION public.bump_usage(_month text, _kind text)
RETURNS public.usage_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.usage_logs;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _kind NOT IN ('text','image') THEN
    RAISE EXCEPTION 'invalid kind';
  END IF;

  INSERT INTO public.usage_logs (user_id, month, text_count, image_count)
  VALUES (
    _uid,
    _month,
    CASE WHEN _kind = 'text'  THEN 1 ELSE 0 END,
    CASE WHEN _kind = 'image' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, month) DO UPDATE
    SET text_count  = public.usage_logs.text_count  + EXCLUDED.text_count,
        image_count = public.usage_logs.image_count + EXCLUDED.image_count,
        updated_at  = now()
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_usage(text, text) TO authenticated;

-- 5) Move sensitive bank fields out of public app_settings into payment_settings
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id integer PRIMARY KEY DEFAULT 1,
  bank_name text,
  bank_account_holder text,
  bank_iban text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_settings_singleton CHECK (id = 1)
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view bank details (needed to make a transfer)
DROP POLICY IF EXISTS "Authenticated users can view payment settings" ON public.payment_settings;
CREATE POLICY "Authenticated users can view payment settings"
  ON public.payment_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can write
DROP POLICY IF EXISTS "Admins manage payment settings" ON public.payment_settings;
CREATE POLICY "Admins manage payment settings"
  ON public.payment_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing data
INSERT INTO public.payment_settings (id, bank_name, bank_account_holder, bank_iban, updated_at)
SELECT 1, bank_name, bank_account_holder, bank_iban, now()
FROM public.app_settings
WHERE id = 1
ON CONFLICT (id) DO UPDATE
  SET bank_name = EXCLUDED.bank_name,
      bank_account_holder = EXCLUDED.bank_account_holder,
      bank_iban = EXCLUDED.bank_iban,
      updated_at = now();

-- Drop the public columns (IBAN is no longer publicly readable)
ALTER TABLE public.app_settings DROP COLUMN IF EXISTS bank_name;
ALTER TABLE public.app_settings DROP COLUMN IF EXISTS bank_account_holder;
ALTER TABLE public.app_settings DROP COLUMN IF EXISTS bank_iban;

-- ==========================================
-- Migration File: 20260419071315_7456ea69-2a29-4c62-99ae-8754f8383f81.sql
-- ==========================================

-- جدول لتقييد طلبات /api/demo-generate حسب الـIP وكل ساعة
CREATE TABLE IF NOT EXISTS public.demo_rate_limits (
  ip text NOT NULL,
  hour_bucket timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip, hour_bucket)
);

ALTER TABLE public.demo_rate_limits ENABLE ROW LEVEL SECURITY;

-- لا أحد يقرأ/يكتب من العميل — service_role فقط
DROP POLICY IF EXISTS "Service role manages demo rate limits" ON public.demo_rate_limits;
CREATE POLICY "Service role manages demo rate limits"
  ON public.demo_rate_limits FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_demo_rate_limits_hour
  ON public.demo_rate_limits (hour_bucket);

-- دالة ذرّية لاستهلاك توكن — ترجع (allowed, remaining, reset_at)
CREATE OR REPLACE FUNCTION public.consume_demo_token(_ip text, _limit integer)
RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bucket timestamptz := date_trunc('hour', now());
  _next   timestamptz := _bucket + interval '1 hour';
  _new_count integer;
BEGIN
  INSERT INTO public.demo_rate_limits (ip, hour_bucket, count, updated_at)
  VALUES (_ip, _bucket, 1, now())
  ON CONFLICT (ip, hour_bucket) DO UPDATE
    SET count = public.demo_rate_limits.count + 1,
        updated_at = now()
  RETURNING count INTO _new_count;

  IF _new_count > _limit THEN
    -- تراجع: ما نخصم العدّاد الزائد (نتركه فوق الحد، بس نرفض)
    RETURN QUERY SELECT false, 0, _next;
  ELSE
    RETURN QUERY SELECT true, GREATEST(_limit - _new_count, 0), _next;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_demo_token(text, integer) TO service_role;

-- ==========================================
-- Migration File: 20260419073944_7ffcadf5-3028-451a-af0f-3430e129296f.sql
-- ==========================================

-- إضافة أعمدة لتتبع توكنز وتكلفة كل توليد
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS prompt_tokens integer,
  ADD COLUMN IF NOT EXISTS completion_tokens integer,
  ADD COLUMN IF NOT EXISTS total_tokens integer,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric(10,6);

CREATE INDEX IF NOT EXISTS idx_generations_user_created
  ON public.generations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_created_at
  ON public.generations(created_at DESC);

-- ==========================================
-- Migration File: 20260419080315_608c3282-a563-4467-831c-953b0ceb73b9.sql
-- ==========================================

-- 1) Plan limits table — instead of hardcoding limits in app code
CREATE TABLE public.plan_limits (
  plan public.user_plan NOT NULL,
  kind text NOT NULL CHECK (kind IN ('text','image')),
  monthly_limit integer NOT NULL CHECK (monthly_limit >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan, kind)
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read limits (needed by client + server)
CREATE POLICY "Plan limits readable by everyone"
  ON public.plan_limits FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage plan limits"
  ON public.plan_limits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed current limits (matches PLAN_LIMITS in src/server/ai-functions.ts)
INSERT INTO public.plan_limits (plan, kind, monthly_limit) VALUES
  ('free',     'text',  5),
  ('free',     'image', 2),
  ('pro',      'text',  1000),
  ('pro',      'image', 60),
  ('business', 'text',  5000),
  ('business', 'image', 300);

-- 2) DB-level quota enforcement trigger on generations
-- Defense in depth: even if app code is bypassed, DB rejects over-quota inserts.
CREATE OR REPLACE FUNCTION public.enforce_generation_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.user_plan;
  _kind text;
  _limit integer;
  _used integer;
  _month text;
BEGIN
  -- Map generation type -> usage kind
  _kind := CASE WHEN NEW.type = 'text' THEN 'text' ELSE 'image' END;

  -- Current month in Riyadh tz (matches usage-month.ts)
  _month := to_char((now() AT TIME ZONE 'Asia/Riyadh')::date, 'YYYY-MM');

  -- Resolve user's plan
  SELECT plan INTO _plan FROM public.profiles WHERE id = NEW.user_id;
  IF _plan IS NULL THEN _plan := 'free'; END IF;

  -- Resolve limit
  SELECT monthly_limit INTO _limit
    FROM public.plan_limits
   WHERE plan = _plan AND kind = _kind;
  IF _limit IS NULL THEN _limit := 0; END IF;

  -- Resolve current usage (may be null if no row yet)
  IF _kind = 'text' THEN
    SELECT text_count INTO _used FROM public.usage_logs
     WHERE user_id = NEW.user_id AND month = _month;
  ELSE
    SELECT image_count INTO _used FROM public.usage_logs
     WHERE user_id = NEW.user_id AND month = _month;
  END IF;
  IF _used IS NULL THEN _used := 0; END IF;

  IF _used >= _limit THEN
    RAISE EXCEPTION 'quota_exceeded: plan=% kind=% used=% limit=%',
      _plan, _kind, _used, _limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_generation_quota
  BEFORE INSERT ON public.generations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_generation_quota();

-- 3) Helpful index for analytics queries (cost reports + top users)
CREATE INDEX IF NOT EXISTS idx_generations_user_created_cost
  ON public.generations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_created_at
  ON public.generations (created_at DESC);

-- ==========================================
-- Migration File: 20260419081204_a45a27f3-9040-4a89-a6a9-366e84126594.sql
-- ==========================================


-- Allow admins to read all generations and usage_logs for analytics dashboard
CREATE POLICY "Admins can view all generations"
  ON public.generations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can view all usage_logs"
  ON public.usage_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));


-- ==========================================
-- Migration File: 20260419081939_4f0624de-fc20-45e9-9409-59dcf2cc36a0.sql
-- ==========================================

-- Audit log for admin actions
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id text,
  before_value jsonb,
  after_value jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON public.admin_audit_log(admin_user_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert audit log"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = admin_user_id);


-- ==========================================
-- Migration File: 20260419082928_201c0b0f-cbbc-4767-af9b-9cfe087deb8c.sql
-- ==========================================

-- Reconcile usage_logs against actual generations counts
-- Admin-only. Returns a report of corrections made.
CREATE OR REPLACE FUNCTION public.reconcile_usage_logs(_month text DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  month text,
  old_text_count integer,
  new_text_count integer,
  old_image_count integer,
  new_image_count integer,
  text_diff integer,
  image_diff integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _admin_id uuid := auth.uid();
  _target_month text;
  _rows_affected integer := 0;
  _total_text_diff integer := 0;
  _total_image_diff integer := 0;
  _users_corrected integer := 0;
BEGIN
  -- Admin guard
  IF _admin_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT public.has_role(_admin_id, 'admin'::app_role) INTO _is_admin;
  IF NOT _is_admin THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  -- Default to current Riyadh month
  _target_month := COALESCE(_month, to_char((now() AT TIME ZONE 'Asia/Riyadh')::date, 'YYYY-MM'));

  -- Build actual counts from generations for the month
  CREATE TEMP TABLE _actual ON COMMIT DROP AS
  SELECT
    g.user_id,
    _target_month AS month,
    COUNT(*) FILTER (WHERE g.type = 'text')::int AS text_count,
    COUNT(*) FILTER (WHERE g.type IN ('image','image_enhance'))::int AS image_count
  FROM public.generations g
  WHERE to_char((g.created_at AT TIME ZONE 'Asia/Riyadh')::date, 'YYYY-MM') = _target_month
  GROUP BY g.user_id;

  -- Also include users who have a usage row but zero generations (to zero them out)
  INSERT INTO _actual (user_id, month, text_count, image_count)
  SELECT u.user_id, _target_month, 0, 0
  FROM public.usage_logs u
  WHERE u.month = _target_month
    AND u.user_id NOT IN (SELECT a.user_id FROM _actual a);

  -- Return diffs and apply corrections
  RETURN QUERY
  WITH joined AS (
    SELECT
      a.user_id,
      a.month,
      COALESCE(u.text_count, 0)  AS old_text_count,
      a.text_count               AS new_text_count,
      COALESCE(u.image_count, 0) AS old_image_count,
      a.image_count              AS new_image_count
    FROM _actual a
    LEFT JOIN public.usage_logs u
      ON u.user_id = a.user_id AND u.month = a.month
  ),
  diffs AS (
    SELECT
      j.*,
      (j.new_text_count  - j.old_text_count)  AS text_diff,
      (j.new_image_count - j.old_image_count) AS image_diff
    FROM joined j
    WHERE j.new_text_count <> j.old_text_count
       OR j.new_image_count <> j.old_image_count
  ),
  upserted AS (
    INSERT INTO public.usage_logs (user_id, month, text_count, image_count, updated_at)
    SELECT d.user_id, d.month, d.new_text_count, d.new_image_count, now()
    FROM diffs d
    ON CONFLICT (user_id, month) DO UPDATE
      SET text_count  = EXCLUDED.text_count,
          image_count = EXCLUDED.image_count,
          updated_at  = now()
    RETURNING usage_logs.user_id
  )
  SELECT d.user_id, d.month,
         d.old_text_count, d.new_text_count,
         d.old_image_count, d.new_image_count,
         d.text_diff, d.image_diff
  FROM diffs d;

  GET DIAGNOSTICS _rows_affected = ROW_COUNT;

  -- Audit log entry (best-effort)
  BEGIN
    INSERT INTO public.admin_audit_log (
      admin_user_id, action, target_table, target_id, before_value, after_value, metadata
    ) VALUES (
      _admin_id,
      'reconcile_usage_logs',
      'usage_logs',
      _target_month,
      NULL,
      jsonb_build_object('users_corrected', _rows_affected),
      jsonb_build_object('month', _target_month)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit log insert failed: %', SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_usage_logs(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_usage_logs(text) TO authenticated;

-- ==========================================
-- Migration File: 20260419101422_ef93194d-5450-4aac-8f16-355776df54ad.sql
-- ==========================================

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

-- ==========================================
-- Migration File: 20260421105452_0d60ce56-0eb9-42a5-99e7-f926bad5b639.sql
-- ==========================================

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

-- ==========================================
-- Migration File: 20260421120009_feccfd16-19a5-4241-ba86-4a61e3f303f5.sql
-- ==========================================

-- Clear stale Resend-era logs (root cause "Emails disabled" — no longer applicable)
DELETE FROM public.email_send_log
WHERE status IN ('pending','dlq')
  AND created_at < '2026-04-21'::date;

-- Purge any orphaned messages still sitting in pgmq queues
SELECT pgmq.purge_queue('auth_emails');
SELECT pgmq.purge_queue('transactional_emails');

-- ==========================================
-- Migration File: 20260421133408_8b4b8fac-95c2-4945-ba75-a1b34386c802.sql
-- ==========================================

-- ============================================
-- C1: Tighten payment_settings RLS (admin-only read)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view payment settings" ON public.payment_settings;

CREATE POLICY "Admins can view payment settings"
ON public.payment_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- C2: Remove subscription_requests from realtime publication
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'subscription_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.subscription_requests';
  END IF;
END $$;

-- ============================================
-- C3: Make generated-images bucket private + owner-scoped policies
-- ============================================
UPDATE storage.buckets SET public = false WHERE id = 'generated-images';

DROP POLICY IF EXISTS "Users can read own generated images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own generated images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own generated images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own generated images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all generated images" ON storage.objects;

CREATE POLICY "Users can read own generated images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload own generated images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own generated images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own generated images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can read all generated images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- ============================================
-- HIGH: Allow admins to read all profiles
-- ============================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- HIGH: Purge stale DLQ messages from old Resend era
-- ============================================
SELECT pgmq.purge_queue('transactional_emails_dlq');
SELECT pgmq.purge_queue('auth_emails_dlq');

-- ==========================================
-- Migration File: 20260421133600_d6244d60-6c69-4518-93ae-7b610df8e449.sql
-- ==========================================

-- Hook quota enforcement BEFORE insert on generations
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;
CREATE TRIGGER trg_enforce_generation_quota
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_quota();

-- Hook telegram notification AFTER insert on subscription_requests
DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;
CREATE TRIGGER trg_notify_admin_on_subscription_request
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();

-- ==========================================
-- Migration File: 20260421134830_1c3a9824-19fb-449f-adac-495d6e7d4058.sql
-- ==========================================

-- 1. Idempotency: prevent duplicate pending subscription requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_requests_unique_pending
  ON public.subscription_requests (user_id, plan)
  WHERE status = 'pending';

-- 2. DLQ Health Check Function (service-role only)
CREATE OR REPLACE FUNCTION public.check_email_dlq_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  auth_dlq_count int := 0;
  trans_dlq_count int := 0;
  auth_pending int := 0;
  trans_pending int := 0;
BEGIN
  BEGIN
    SELECT count(*) INTO auth_dlq_count FROM pgmq.q_auth_emails_dlq;
  EXCEPTION WHEN undefined_table THEN auth_dlq_count := 0;
  END;
  BEGIN
    SELECT count(*) INTO trans_dlq_count FROM pgmq.q_transactional_emails_dlq;
  EXCEPTION WHEN undefined_table THEN trans_dlq_count := 0;
  END;
  BEGIN
    SELECT count(*) INTO auth_pending FROM pgmq.q_auth_emails;
  EXCEPTION WHEN undefined_table THEN auth_pending := 0;
  END;
  BEGIN
    SELECT count(*) INTO trans_pending FROM pgmq.q_transactional_emails;
  EXCEPTION WHEN undefined_table THEN trans_pending := 0;
  END;

  RETURN jsonb_build_object(
    'auth_dlq', auth_dlq_count,
    'transactional_dlq', trans_dlq_count,
    'auth_pending', auth_pending,
    'transactional_pending', trans_pending,
    'total_dlq', auth_dlq_count + trans_dlq_count,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_email_dlq_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_dlq_health() TO service_role;

-- 3. DLQ Alert State (singleton — rate-limit Telegram alerts)
CREATE TABLE IF NOT EXISTS public.dlq_alert_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_alert_at timestamptz,
  last_alert_count int DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.dlq_alert_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.dlq_alert_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages dlq alert state" ON public.dlq_alert_state;
CREATE POLICY "Service role manages dlq alert state"
ON public.dlq_alert_state
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can read dlq alert state" ON public.dlq_alert_state;
CREATE POLICY "Admins can read dlq alert state"
ON public.dlq_alert_state
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ==========================================
-- Migration File: 20260421140629_e602e550-11f0-4f76-a398-f803c9bb00c3.sql
-- ==========================================

-- إعادة تعريف سياسة القراءة لتقييد رقم الواتساب على المستخدمين المسجلين
DROP POLICY IF EXISTS "App settings are publicly readable" ON public.app_settings;

-- زوار غير مسجلين: لا قراءة مباشرة (يستخدمون RPC public_app_settings)
CREATE POLICY "Authenticated users can read app settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- دالة عامة تُرجع فقط الحقول التسويقية الآمنة (بدون whatsapp_number)
CREATE OR REPLACE FUNCTION public.get_public_app_settings()
RETURNS TABLE (
  founding_base_count integer,
  founding_total_seats integer,
  founding_discount_pct integer,
  founding_program_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    founding_base_count,
    founding_total_seats,
    founding_discount_pct,
    founding_program_active
  FROM public.app_settings
  WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_app_settings() TO anon, authenticated;

-- ==========================================
-- Migration File: 20260421140701_0ce9841d-1af8-4e04-9e28-5260e8ea3b21.sql
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_founding_status()
RETURNS TABLE (
  current_subscribers integer,
  seats_total integer,
  seats_left integer,
  discount_pct integer,
  program_active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base int;
  _total int;
  _disc int;
  _active boolean;
  _taken int;
BEGIN
  SELECT founding_base_count, founding_total_seats, founding_discount_pct, founding_program_active
    INTO _base, _total, _disc, _active
  FROM public.app_settings WHERE id = 1;

  SELECT COUNT(*)::int INTO _taken
  FROM public.subscription_requests
  WHERE status IN ('activated','contacted','pending');

  RETURN QUERY SELECT
    COALESCE(_base, 0) + COALESCE(_taken, 0) AS current_subscribers,
    COALESCE(_total, 1000)                   AS seats_total,
    GREATEST(0, COALESCE(_total, 1000) - (COALESCE(_base, 0) + COALESCE(_taken, 0))) AS seats_left,
    COALESCE(_disc, 30)                      AS discount_pct,
    COALESCE(_active, true)                  AS program_active;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_founding_status() TO anon, authenticated;

-- ==========================================
-- Migration File: 20260421140804_6768d9e7-9cbe-4665-b5d9-7d534f97b478.sql
-- ==========================================

-- دالة مزامنة الخطة + سجل تدقيق
CREATE OR REPLACE FUNCTION public.sync_profile_plan_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- نتفاعل فقط عند الانتقال إلى "activated" مع وجود خطة صالحة
  IF NEW.status = 'activated'::subscription_request_status
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.plan IS NOT NULL THEN
    UPDATE public.profiles
       SET plan = NEW.plan,
           updated_at = now()
     WHERE id = NEW.user_id;

    -- best-effort audit
    BEGIN
      INSERT INTO public.admin_audit_log (
        admin_user_id, action, target_table, target_id, after_value, metadata
      ) VALUES (
        COALESCE(auth.uid(), NEW.user_id),
        'auto_sync_plan_on_activation',
        'profiles',
        NEW.user_id::text,
        jsonb_build_object('plan', NEW.plan),
        jsonb_build_object('subscription_request_id', NEW.id, 'billing_cycle', NEW.billing_cycle)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sync plan audit failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
CREATE TRIGGER trg_sync_profile_plan_on_activation
  AFTER UPDATE ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_plan_on_activation();

-- ==========================================
-- Migration File: 20260421143640_60c3ce57-113e-47be-985a-ad1ad641aa38.sql
-- ==========================================

-- =====================================================
-- WAVE 1: Critical pre-launch security hardening
-- =====================================================

-- ----- 1) user_roles: split ALL policy into granular policies with WITH CHECK -----
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ----- 2) storage.objects: explicit admin SELECT policy on payment-receipts -----
-- (Existing policy "Users can view own payment receipts" already includes admin via OR,
--  but we add a dedicated, clearly-named policy for auditability.)
DROP POLICY IF EXISTS "Admins can view all payment receipts" ON storage.objects;

CREATE POLICY "Admins can view all payment receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- ----- 3) Cleanup: remove duplicate storage policies on generated-images -----
-- These three are exact duplicates of "... own generated images" variants.
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own folder" ON storage.objects;


-- ==========================================
-- Migration File: 20260421143718_3697baa7-78ca-4460-b372-38eedb1e49c0.sql
-- ==========================================

-- Tighten ab_test_events insert policy (was permissive: WITH CHECK (true))
DROP POLICY IF EXISTS "Anyone can insert ab test events" ON public.ab_test_events;

CREATE POLICY "Anyone can insert valid ab test events"
ON public.ab_test_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Required, non-empty, length-bounded fields
  experiment IS NOT NULL AND char_length(experiment) BETWEEN 1 AND 64
  AND variant IS NOT NULL AND char_length(variant) BETWEEN 1 AND 64
  AND event_type IS NOT NULL AND event_type IN ('view','click','convert','impression','exposure')
  AND session_id IS NOT NULL AND char_length(session_id) BETWEEN 8 AND 128
  AND (user_agent IS NULL OR char_length(user_agent) <= 512)
);


-- ==========================================
-- Migration File: 20260421143742_6152e126-d070-4948-8dab-c1bbf08cf3d7.sql
-- ==========================================

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


-- ==========================================
-- Migration File: 20260421145301_0de2b761-8df6-43f3-a7fe-bfa342248f5a.sql
-- ==========================================


-- دالة لجلب الطلبات المعلّقة منذ أكثر من 24 ساعة
CREATE OR REPLACE FUNCTION public.get_stale_subscription_requests()
RETURNS TABLE(
  id uuid,
  plan public.user_plan,
  billing_cycle text,
  status public.subscription_request_status,
  email text,
  whatsapp text,
  store_name text,
  hours_old numeric,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, plan, billing_cycle, status, email, whatsapp, store_name,
    ROUND(EXTRACT(EPOCH FROM (now() - created_at))/3600, 1) AS hours_old,
    created_at
  FROM public.subscription_requests
  WHERE status IN ('pending', 'contacted')
    AND created_at < now() - interval '24 hours'
  ORDER BY created_at ASC
  LIMIT 50;
$$;

-- جدول state لمنع تكرار التنبيه (تنبيه واحد كل 24 ساعة كحدّ أقصى)
CREATE TABLE IF NOT EXISTS public.stale_subs_alert_state (
  id integer PRIMARY KEY DEFAULT 1,
  last_alert_at timestamptz,
  last_alert_count integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stale_subs_alert_state_singleton CHECK (id = 1)
);

INSERT INTO public.stale_subs_alert_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.stale_subs_alert_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read stale subs alert state"
ON public.stale_subs_alert_state FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages stale subs alert state"
ON public.stale_subs_alert_state FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Cron job يومي 09:00 UTC (12:00 الرياض)
SELECT cron.schedule(
  'check-stale-subscriptions',
  '0 9 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rifd.lovable.app/api/public/hooks/check-stale-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) AS request_id;
  $cron$
);


-- ==========================================
-- Migration File: 20260422130342_c9c16437-e5b1-4bd6-b385-d0b09e867509.sql
-- ==========================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS brand_personality TEXT,
ADD COLUMN IF NOT EXISTS unique_selling_point TEXT,
ADD COLUMN IF NOT EXISTS banned_phrases TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS shipping_policy TEXT,
ADD COLUMN IF NOT EXISTS exchange_policy TEXT,
ADD COLUMN IF NOT EXISTS faq_notes TEXT,
ADD COLUMN IF NOT EXISTS high_margin_products TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS cta_style TEXT,
ADD COLUMN IF NOT EXISTS seasonal_priorities TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS compliance_notes TEXT;

-- ==========================================
-- Migration File: 20260424092012_c5979ae8-043d-4d3b-b553-9399425c5a78.sql
-- ==========================================

-- ============================================================
-- P1 Security Hardening Migration
-- ============================================================

-- (1) PRIVILEGE_ESCALATION: منع المستخدم من إدخال/تعديل/حذف أدواره
-- السياسات الحالية تسمح لـ "authenticated" + has_role(admin) — لكن has_role
-- نفسها معتمدة على user_roles. الحل: سياسة RESTRICTIVE تمنع كل شيء إلا
-- service_role أو وجود admin سابق فعلي (من خلال has_role) — مع الاعتماد
-- على trigger للتعيين الأولي بـ SECURITY DEFINER (handle_new_user موجودة).

-- نحذف السياسات الحالية ونعيد بناءها بشكل أكثر صرامة:
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- سياسة restrictive: يمنع أي شيء إلا (service_role) أو (admin حقيقي)
CREATE POLICY "Block non-admin role mutations"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- وسياسات permissive عادية للأدمن (تعمل فقط بعد المرور من restrictive):
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- (2) MISSING_RLS_PROTECTION: usage_logs — المستخدم يستطيع تصفير عداداته
-- نحذف INSERT/UPDATE من المستخدم، ويبقى SELECT فقط. الزيادة تحدث عبر
-- bump_usage (SECURITY DEFINER) و enforce_generation_quota (trigger).
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_logs;
DROP POLICY IF EXISTS "Users can update own usage" ON public.usage_logs;

-- نضيف سياسات service_role للوضوح
CREATE POLICY "Service role manages usage_logs"
ON public.usage_logs
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- (3) جدول contact_submissions (P2.1) — نُحضّره مع P1 في نفس المايجريشن
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  user_agent text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- validation داخل الـ DB كطبقة دفاع ثانية
  CONSTRAINT contact_name_len CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  CONSTRAINT contact_email_len CHECK (char_length(trim(email)) BETWEEN 3 AND 255),
  CONSTRAINT contact_email_fmt CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT contact_phone_len CHECK (phone IS NULL OR char_length(phone) <= 20),
  CONSTRAINT contact_subject_len CHECK (char_length(trim(subject)) BETWEEN 1 AND 150),
  CONSTRAINT contact_message_len CHECK (char_length(trim(message)) BETWEEN 5 AND 2000),
  CONSTRAINT contact_status_valid CHECK (status IN ('new','read','replied','archived','spam'))
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- INSERT مغلق من الـ client. الإدراج يتم فقط من server route عبر service_role.
-- لا نضع سياسة INSERT للأنون/المستخدم — هذا يمنع الـ spam من المتصفح.

CREATE POLICY "Admins can view contact submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update contact submissions"
ON public.contact_submissions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete contact submissions"
ON public.contact_submissions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert contact submissions"
ON public.contact_submissions
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

-- index للأدمن لعرض الأحدث
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status_created
ON public.contact_submissions (status, created_at DESC);

-- trigger لتحديث updated_at
CREATE TRIGGER update_contact_submissions_updated_at
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- ==========================================
-- Migration File: 20260424092907_581bb1fe-bf3a-406c-9a36-b97f2dfd577b.sql
-- ==========================================

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

-- ==========================================
-- Migration File: 20260424142750_56b04548-c628-4bfe-a131-c73e1c8df77e.sql
-- ==========================================

-- إصلاح cron jobs بعد تغيير النشر إلى rifd.site
-- المشكلة: الـ URLs القديمة (rifd.lovable.app + id-preview) لم تعد تعمل

-- 1. process-email-queue: نقل من preview URL إلى stable production URL
DO $$ BEGIN BEGIN PERFORM cron.unschedule('process-email-queue'); EXCEPTION WHEN OTHERS THEN NULL; END; EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'process-email-queue',
  '5 seconds',
  $$
  SELECT CASE
    WHEN (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now()
      THEN NULL
    WHEN EXISTS (SELECT 1 FROM pgmq.q_auth_emails LIMIT 1)
      OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails LIMIT 1)
      THEN net.http_post(
        url := 'https://project--694f48b8-26d0-46e8-9443-b81b61c8f1f6.lovable.app/lovable/email/queue/process',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'email_queue_service_role_key'
          )
        ),
        body := '{}'::jsonb
      )
    ELSE NULL
  END;
  $$
);

-- 2. check-stale-subscriptions: تحديث URL
DO $$ BEGIN BEGIN PERFORM cron.unschedule('check-stale-subscriptions'); EXCEPTION WHEN OTHERS THEN NULL; END; EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'check-stale-subscriptions',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifd.site/api/public/hooks/check-stale-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) AS request_id;
  $$
);

-- 3. daily-domain-scan: تحديث URL
DO $$ BEGIN BEGIN PERFORM cron.unschedule('daily-domain-scan'); EXCEPTION WHEN OTHERS THEN NULL; END; EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'daily-domain-scan',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifd.site/hooks/domain-scan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- 4. rifd-onboarding-emails-daily: تحديث URL
DO $$ BEGIN BEGIN PERFORM cron.unschedule('rifd-onboarding-emails-daily'); EXCEPTION WHEN OTHERS THEN NULL; END; EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'rifd-onboarding-emails-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifd.site/hooks/onboarding-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- 5. send-expiring-subscription-reminders: تحديث URL
DO $$ BEGIN BEGIN PERFORM cron.unschedule('send-expiring-subscription-reminders'); EXCEPTION WHEN OTHERS THEN NULL; END; EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'send-expiring-subscription-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifd.site/hooks/expiring-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- ==========================================
-- Migration File: 20260424143238_14a2f0a1-5159-4b0b-8b0b-3cab675e4107.sql
-- ==========================================

DO $$ BEGIN BEGIN PERFORM cron.unschedule('process-email-queue'); EXCEPTION WHEN OTHERS THEN NULL; END; EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'process-email-queue',
  '5 seconds',
  $$
  SELECT CASE
    WHEN (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now()
      THEN NULL
    WHEN EXISTS (SELECT 1 FROM pgmq.q_auth_emails LIMIT 1)
      OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails LIMIT 1)
      THEN net.http_post(
        url := 'https://rifd.lovable.app/lovable/email/queue/process',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'email_queue_service_role_key'
          )
        ),
        body := '{}'::jsonb
      )
    ELSE NULL
  END;
  $$
);

-- ==========================================
-- Migration File: 20260424143324_bef85043-507d-49ea-abb5-af062241ddf3.sql
-- ==========================================

DO $$ BEGIN BEGIN PERFORM cron.unschedule('process-email-queue'); EXCEPTION WHEN OTHERS THEN NULL; END; EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'process-email-queue',
  '5 seconds',
  $$
  SELECT CASE
    WHEN (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now()
      THEN NULL
    WHEN EXISTS (SELECT 1 FROM pgmq.q_auth_emails LIMIT 1)
      OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails LIMIT 1)
      THEN net.http_post(
        url := 'https://rifd.site/lovable/email/queue/process',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'email_queue_service_role_key'
          )
        ),
        body := '{}'::jsonb
      )
    ELSE NULL
  END;
  $$
);

-- ==========================================
-- Migration File: 20260424144327_226dbf3b-ae6b-4a9b-b9c7-3a41112ccb76.sql
-- ==========================================


-- =====================================================================
-- P1 Security: قفل INSERT على generations لمنع تجاوز الحصة والتزوير
-- =====================================================================
-- الإستراتيجية:
-- 1. نُنشئ دالة SECURITY DEFINER اسمها record_generation تستقبل القيم الحساسة
--    وتُدخل الصف بقيمها الحقيقية. هذه الدالة وحدها مَن يكتب cost/tokens/model.
-- 2. نُنشئ trigger BEFORE INSERT على generations يصفّر/يرفض الحقول الحساسة
--    إن جاء الإدراج من دور authenticated (المستخدم العادي عبر العميل)،
--    ويسمح بالقيم الكاملة فقط للسياق الخاص (security_definer = local setting).
-- 3. النتيجة: المستخدم لا يستطيع تزوير cost/tokens حتى لو أدرج صفاً يدوياً.
-- =====================================================================

-- 1) دالة آمنة للسيرفر تستخدم session-local marker
CREATE OR REPLACE FUNCTION public.record_generation(
  _type public.generation_type,
  _prompt text,
  _result text,
  _template text DEFAULT NULL,
  _model_used text DEFAULT NULL,
  _prompt_tokens integer DEFAULT NULL,
  _completion_tokens integer DEFAULT NULL,
  _total_tokens integer DEFAULT NULL,
  _estimated_cost_usd numeric DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS public.generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.generations;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  -- نضع علامة جلسة محلية تسمح للـ trigger بقبول الحقول الحساسة
  PERFORM set_config('app.trusted_generation_insert', 'on', true);

  INSERT INTO public.generations (
    user_id, type, prompt, result, template,
    model_used, prompt_tokens, completion_tokens, total_tokens,
    estimated_cost_usd, metadata
  ) VALUES (
    _uid, _type, _prompt, _result, _template,
    _model_used, _prompt_tokens, _completion_tokens, _total_tokens,
    _estimated_cost_usd, _metadata
  )
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_generation(
  public.generation_type, text, text, text, text,
  integer, integer, integer, numeric, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_generation(
  public.generation_type, text, text, text, text,
  integer, integer, integer, numeric, jsonb
) TO authenticated;

-- 2) trigger يفرض القيم الموثوقة فقط
CREATE OR REPLACE FUNCTION public.enforce_generation_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _trusted text := current_setting('app.trusted_generation_insert', true);
BEGIN
  -- إجبار user_id = auth.uid() دائماً
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    NEW.user_id := auth.uid();
  END IF;

  -- إن لم يكن السياق موثوقاً (إدراج مباشر من العميل)، صفّر الحقول الحساسة
  IF _trusted IS DISTINCT FROM 'on' THEN
    NEW.estimated_cost_usd := NULL;
    NEW.prompt_tokens := NULL;
    NEW.completion_tokens := NULL;
    NEW.total_tokens := NULL;
    NEW.model_used := NULL;
    NEW.is_favorite := false;
    -- نسمح بالـprompt/result/type/template/metadata كما هي (لا تأثير على الفوترة)
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
CREATE TRIGGER trg_enforce_generation_integrity
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

COMMENT ON FUNCTION public.record_generation IS
  'مدخل آمن لإنشاء توليدات مع قيم cost/tokens موثوقة. يُستخدم من server functions فقط.';

COMMENT ON FUNCTION public.enforce_generation_integrity IS
  'يمنع المستخدم من تزوير cost/tokens/model عند الإدراج المباشر، ويفرض user_id = auth.uid().';


-- ==========================================
-- Migration File: 20260424150457_a2e08704-5ce4-4f0c-b24d-91b7200f49c4.sql
-- ==========================================

-- إضافة سياسة عرض للأدمن على جدول البريد المحجوب (suppressed_emails)
-- هذا يسمح للأدمن بمراجعة وإدارة قائمة الحجب من لوحة التحكم
CREATE POLICY "Admins can view suppressed emails"
ON public.suppressed_emails
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ==========================================
-- Migration File: 20260424194739_54ea75e2-d990-4e41-93cb-b6fe17432b0c.sql
-- ==========================================

-- ============================================================
-- Phase 1: Credits System Migration
-- ============================================================

-- 1) جدول رصيد النقاط لكل مستخدم
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_credits integer NOT NULL DEFAULT 0 CHECK (plan_credits >= 0),
  topup_credits integer NOT NULL DEFAULT 0 CHECK (topup_credits >= 0),
  cycle_started_at timestamptz NOT NULL DEFAULT now(),
  cycle_ends_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credits" ON public.user_credits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all credits" ON public.user_credits
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- لا UPDATE/INSERT/DELETE مباشر — كله عبر RPCs

-- 2) سجل المحاسبة الكامل (audit trail)
CREATE TYPE public.credit_txn_type AS ENUM (
  'plan_grant',      -- منح أولي/شهري للباقة
  'topup_purchase',  -- شراء حزمة إضافية
  'consume_image',   -- استهلاك لتوليد صورة
  'consume_video',   -- استهلاك لتوليد فيديو
  'refund',          -- استرداد لعملية فاشلة
  'admin_adjust',    -- تعديل يدوي من الأدمن
  'expire'           -- انتهاء صلاحية نقاط الباقة عند التجديد
);

CREATE TYPE public.credit_source AS ENUM ('plan', 'topup');

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  txn_type public.credit_txn_type NOT NULL,
  amount integer NOT NULL,                    -- موجب=إضافة، سالب=خصم
  source public.credit_source,                -- من أي رصيد (plan/topup)
  balance_after_plan integer NOT NULL,        -- snapshot
  balance_after_topup integer NOT NULL,       -- snapshot
  reference_id uuid,                          -- ربط بـ generation/video_job/topup_purchase
  reference_type text,                        -- 'generation' | 'video_job' | 'topup_purchase'
  refunded_at timestamptz,                    -- لمنع الاسترداد المزدوج
  refund_ledger_id uuid REFERENCES public.credit_ledger(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_ledger_user_created ON public.credit_ledger(user_id, created_at DESC);
CREATE INDEX idx_credit_ledger_reference ON public.credit_ledger(reference_id) WHERE reference_id IS NOT NULL;

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ledger" ON public.credit_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all ledger" ON public.credit_ledger
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) نقاط الباقات (يحل محل plan_limits للنقاط)
CREATE TABLE IF NOT EXISTS public.plan_credits (
  plan public.user_plan PRIMARY KEY,
  monthly_credits integer NOT NULL CHECK (monthly_credits >= 0),
  daily_text_cap integer NOT NULL DEFAULT 200 CHECK (daily_text_cap >= 0),
  daily_image_cap integer NOT NULL DEFAULT 50 CHECK (daily_image_cap >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan credits readable by all" ON public.plan_credits
  FOR SELECT USING (true);

CREATE POLICY "Admins manage plan credits" ON public.plan_credits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) حزم Top-up
CREATE TABLE IF NOT EXISTS public.topup_packages (
  id text PRIMARY KEY,                -- 'pkg_500', 'pkg_1500', 'pkg_5000'
  credits integer NOT NULL CHECK (credits > 0),
  price_sar numeric(10,2) NOT NULL CHECK (price_sar > 0),
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topup_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Topup packages readable by authenticated" ON public.topup_packages
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins manage topup packages" ON public.topup_packages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) طلبات شراء حزم Top-up
CREATE TYPE public.topup_status AS ENUM ('pending', 'paid', 'activated', 'rejected', 'refunded');

CREATE TABLE IF NOT EXISTS public.topup_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id text NOT NULL REFERENCES public.topup_packages(id),
  credits integer NOT NULL,
  price_sar numeric(10,2) NOT NULL,
  status public.topup_status NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL,                     -- لمنع الازدواج
  payment_method text,
  receipt_path text,
  receipt_uploaded_at timestamptz,
  activated_at timestamptz,
  activated_by uuid,                                  -- admin user_id
  ledger_id uuid REFERENCES public.credit_ledger(id), -- ربط للتتبع
  admin_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX idx_topup_purchases_user ON public.topup_purchases(user_id, created_at DESC);
CREATE INDEX idx_topup_purchases_status ON public.topup_purchases(status) WHERE status IN ('pending','paid');

ALTER TABLE public.topup_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own topups" ON public.topup_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users create own topups" ON public.topup_purchases
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins view all topups" ON public.topup_purchases
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update topups" ON public.topup_purchases
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6) جدول طلبات الفيديو
CREATE TYPE public.video_job_status AS ENUM (
  'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'
);

CREATE TYPE public.video_quality AS ENUM ('fast', 'quality');

CREATE TABLE IF NOT EXISTS public.video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  quality public.video_quality NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 5 CHECK (duration_seconds IN (5, 10)),
  aspect_ratio text NOT NULL DEFAULT '16:9',
  starting_frame_url text,
  credits_charged integer NOT NULL CHECK (credits_charged > 0),
  ledger_id uuid REFERENCES public.credit_ledger(id),    -- لربط الاسترداد
  refund_ledger_id uuid REFERENCES public.credit_ledger(id),
  status public.video_job_status NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'replicate',
  provider_job_id text,                                   -- Replicate prediction id
  result_url text,
  storage_path text,
  error_message text,
  estimated_cost_usd numeric(10,4),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_video_jobs_user ON public.video_jobs(user_id, created_at DESC);
CREATE INDEX idx_video_jobs_status ON public.video_jobs(status) WHERE status IN ('pending','processing');
CREATE INDEX idx_video_jobs_provider ON public.video_jobs(provider_job_id) WHERE provider_job_id IS NOT NULL;

ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own video jobs" ON public.video_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all video jobs" ON public.video_jobs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- لا INSERT/UPDATE/DELETE مباشر — عبر RPCs والـwebhook

-- 7) عداد يومي للنصوص (لمنع abuse)
CREATE TABLE IF NOT EXISTS public.daily_text_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  text_count integer NOT NULL DEFAULT 0 CHECK (text_count >= 0),
  image_count integer NOT NULL DEFAULT 0 CHECK (image_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

CREATE INDEX idx_daily_text_day ON public.daily_text_usage(day);

ALTER TABLE public.daily_text_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own daily usage" ON public.daily_text_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all daily usage" ON public.daily_text_usage
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- DOĞAN'S RULE: كل تعديل على الرصيد عبر RPC ذرّية فقط
-- ============================================================

-- دالة مساعدة: ضمان وجود سجل user_credits
CREATE OR REPLACE FUNCTION public._ensure_user_credits(_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits)
  VALUES (_uid, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- 8) consume_credits — خصم ذرّي مع تحقق
CREATE OR REPLACE FUNCTION public.consume_credits(
  _amount integer,
  _txn_type public.credit_txn_type,
  _reference_id uuid DEFAULT NULL,
  _reference_type text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  ledger_id uuid,
  remaining_plan integer,
  remaining_topup integer,
  remaining_total integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.user_credits;
  _from_plan integer := 0;
  _from_topup integer := 0;
  _new_ledger_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF _txn_type NOT IN ('consume_image','consume_video') THEN
    RAISE EXCEPTION 'invalid_txn_type';
  END IF;

  PERFORM public._ensure_user_credits(_uid);

  -- قفل الصف ذرّياً
  SELECT * INTO _row
  FROM public.user_credits
  WHERE user_id = _uid
  FOR UPDATE;

  IF (_row.plan_credits + _row.topup_credits) < _amount THEN
    RAISE EXCEPTION 'insufficient_credits: required=% available=%',
      _amount, (_row.plan_credits + _row.topup_credits)
      USING ERRCODE = 'check_violation';
  END IF;

  -- استهلك من plan أولاً ثم topup
  IF _row.plan_credits >= _amount THEN
    _from_plan := _amount;
    _from_topup := 0;
  ELSE
    _from_plan := _row.plan_credits;
    _from_topup := _amount - _from_plan;
  END IF;

  UPDATE public.user_credits
  SET plan_credits = plan_credits - _from_plan,
      topup_credits = topup_credits - _from_topup,
      updated_at = now()
  WHERE user_id = _uid
  RETURNING * INTO _row;

  -- سجل في الدفتر (سجل واحد إذا من مصدر واحد، اثنين إذا مختلط)
  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _uid, _txn_type, -_amount,
    CASE WHEN _from_topup = 0 THEN 'plan'::credit_source
         WHEN _from_plan = 0 THEN 'topup'::credit_source
         ELSE 'plan'::credit_source END,  -- mixed → نسجلها plan ونضيف split في metadata
    _row.plan_credits, _row.topup_credits,
    _reference_id, _reference_type,
    _metadata || jsonb_build_object('from_plan', _from_plan, 'from_topup', _from_topup)
  ) RETURNING id INTO _new_ledger_id;

  RETURN QUERY SELECT
    _new_ledger_id,
    _row.plan_credits,
    _row.topup_credits,
    (_row.plan_credits + _row.topup_credits);
END;
$$;

-- 9) refund_credits — استرداد لعملية فاشلة (آمن من الازدواج)
CREATE OR REPLACE FUNCTION public.refund_credits(
  _ledger_id uuid,
  _reason text DEFAULT 'generation_failed'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _orig public.credit_ledger;
  _uid uuid := auth.uid();
  _from_plan integer;
  _from_topup integer;
  _refund_amount integer;
  _row public.user_credits;
  _refund_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  -- قفل سجل المعاملة الأصلية
  SELECT * INTO _orig
  FROM public.credit_ledger
  WHERE id = _ledger_id AND user_id = _uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ledger_not_found';
  END IF;
  IF _orig.refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_refunded';
  END IF;
  IF _orig.txn_type NOT IN ('consume_image','consume_video') THEN
    RAISE EXCEPTION 'not_refundable';
  END IF;

  _refund_amount := -_orig.amount;  -- amount كان سالب
  _from_plan := COALESCE((_orig.metadata->>'from_plan')::integer, _refund_amount);
  _from_topup := COALESCE((_orig.metadata->>'from_topup')::integer, 0);

  PERFORM public._ensure_user_credits(_uid);

  UPDATE public.user_credits
  SET plan_credits = plan_credits + _from_plan,
      topup_credits = topup_credits + _from_topup,
      updated_at = now()
  WHERE user_id = _uid
  RETURNING * INTO _row;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _uid, 'refund', _refund_amount, _orig.source,
    _row.plan_credits, _row.topup_credits,
    _orig.reference_id, _orig.reference_type,
    jsonb_build_object('reason', _reason, 'original_ledger_id', _ledger_id,
                       'restored_plan', _from_plan, 'restored_topup', _from_topup)
  ) RETURNING id INTO _refund_id;

  -- علامة الأصل كمسترد
  UPDATE public.credit_ledger
  SET refunded_at = now(), refund_ledger_id = _refund_id
  WHERE id = _ledger_id;

  RETURN _refund_id;
END;
$$;

-- 10) consume_text_quota — للنصوص المجانية مع cap يومي
CREATE OR REPLACE FUNCTION public.consume_text_quota()
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _plan public.user_plan;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT plan INTO _plan FROM public.profiles WHERE id = _uid;
  IF _plan IS NULL THEN _plan := 'free'; END IF;

  SELECT daily_text_cap INTO _cap FROM public.plan_credits WHERE plan = _plan;
  IF _cap IS NULL THEN _cap := 200; END IF;

  INSERT INTO public.daily_text_usage (user_id, day, text_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET text_count = public.daily_text_usage.text_count + 1,
        updated_at = now()
  RETURNING text_count INTO _new_count;

  IF _new_count > _cap THEN
    -- تراجع: ارجع العداد
    UPDATE public.daily_text_usage
    SET text_count = text_count - 1, updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

-- 11) reset_monthly_credits — للتجديد الشهري (يستدعى من admin/webhook)
CREATE OR REPLACE FUNCTION public.reset_monthly_credits(_user_id uuid, _plan public.user_plan)
RETURNS public.user_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _new_credits integer;
  _row public.user_credits;
  _old_plan_credits integer;
BEGIN
  -- فقط admin أو service_role
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO _is_admin;
  IF NOT _is_admin AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT monthly_credits INTO _new_credits FROM public.plan_credits WHERE plan = _plan;
  IF _new_credits IS NULL THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  PERFORM public._ensure_user_credits(_user_id);

  -- قفل الصف
  SELECT plan_credits INTO _old_plan_credits
  FROM public.user_credits WHERE user_id = _user_id FOR UPDATE;

  -- سجل انتهاء النقاط القديمة (إن وجدت)
  IF _old_plan_credits > 0 THEN
    INSERT INTO public.credit_ledger (
      user_id, txn_type, amount, source,
      balance_after_plan, balance_after_topup, metadata
    )
    SELECT _user_id, 'expire', -_old_plan_credits, 'plan',
           0, topup_credits, jsonb_build_object('reason', 'monthly_reset')
    FROM public.user_credits WHERE user_id = _user_id;
  END IF;

  UPDATE public.user_credits
  SET plan_credits = _new_credits,
      cycle_started_at = now(),
      cycle_ends_at = now() + interval '30 days',
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING * INTO _row;

  -- سجل المنح الجديد
  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup, metadata
  ) VALUES (
    _user_id, 'plan_grant', _new_credits, 'plan',
    _row.plan_credits, _row.topup_credits,
    jsonb_build_object('plan', _plan)
  );

  RETURN _row;
END;
$$;

-- 12) activate_topup_purchase — تفعيل حزمة بعد دفع (admin only)
CREATE OR REPLACE FUNCTION public.activate_topup_purchase(_purchase_id uuid)
RETURNS public.user_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _purchase public.topup_purchases;
  _row public.user_credits;
  _ledger_id uuid;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO _is_admin;
  IF NOT _is_admin THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  -- Advisory lock لمنع التفعيل المتزامن
  IF NOT pg_try_advisory_xact_lock(hashtext('topup_activate_' || _purchase_id::text)) THEN
    RAISE EXCEPTION 'concurrent_activation';
  END IF;

  SELECT * INTO _purchase
  FROM public.topup_purchases
  WHERE id = _purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'purchase_not_found';
  END IF;
  IF _purchase.status = 'activated' THEN
    RAISE EXCEPTION 'already_activated';
  END IF;
  IF _purchase.status NOT IN ('pending','paid') THEN
    RAISE EXCEPTION 'invalid_status: %', _purchase.status;
  END IF;

  PERFORM public._ensure_user_credits(_purchase.user_id);

  UPDATE public.user_credits
  SET topup_credits = topup_credits + _purchase.credits,
      updated_at = now()
  WHERE user_id = _purchase.user_id
  RETURNING * INTO _row;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _purchase.user_id, 'topup_purchase', _purchase.credits, 'topup',
    _row.plan_credits, _row.topup_credits,
    _purchase.id, 'topup_purchase',
    jsonb_build_object('package_id', _purchase.package_id, 'price_sar', _purchase.price_sar)
  ) RETURNING id INTO _ledger_id;

  UPDATE public.topup_purchases
  SET status = 'activated',
      activated_at = now(),
      activated_by = auth.uid(),
      ledger_id = _ledger_id,
      updated_at = now()
  WHERE id = _purchase_id;

  RETURN _row;
END;
$$;

-- 13) get_user_credits_summary — للـUI
CREATE OR REPLACE FUNCTION public.get_user_credits_summary()
RETURNS TABLE(
  plan_credits integer,
  topup_credits integer,
  total_credits integer,
  cycle_ends_at timestamptz,
  daily_text_used integer,
  daily_text_cap integer,
  plan public.user_plan
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(uc.plan_credits, 0),
    COALESCE(uc.topup_credits, 0),
    COALESCE(uc.plan_credits, 0) + COALESCE(uc.topup_credits, 0),
    uc.cycle_ends_at,
    COALESCE(dtu.text_count, 0),
    COALESCE(pc.daily_text_cap, 200),
    COALESCE(p.plan, 'free'::user_plan)
  FROM (SELECT _uid AS uid) base
  LEFT JOIN public.user_credits uc ON uc.user_id = base.uid
  LEFT JOIN public.profiles p ON p.id = base.uid
  LEFT JOIN public.plan_credits pc ON pc.plan = COALESCE(p.plan, 'free'::user_plan)
  LEFT JOIN public.daily_text_usage dtu
    ON dtu.user_id = base.uid
    AND dtu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date;
END;
$$;

-- 14) Trigger: عند إنشاء profile جديد، أنشئ user_credits + امنح نقاط الباقة الأولية
CREATE OR REPLACE FUNCTION public.grant_initial_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credits integer;
BEGIN
  SELECT monthly_credits INTO _credits
  FROM public.plan_credits WHERE plan = COALESCE(NEW.plan, 'free'::user_plan);

  IF _credits IS NULL THEN _credits := 50; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  -- سجل المنح الأولي
  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup, metadata
  ) VALUES (
    NEW.id, 'plan_grant', _credits, 'plan',
    _credits, 0,
    jsonb_build_object('reason', 'initial_signup', 'plan', NEW.plan)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_grant_credits ON public.profiles;
CREATE TRIGGER on_profile_created_grant_credits
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_initial_credits();

-- 15) Trigger: عند تغيير plan في subscription_requests إلى activated، جدد النقاط
CREATE OR REPLACE FUNCTION public.reset_credits_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- فقط عند تفعيل اشتراك جديد
  IF NEW.status = 'activated'::subscription_request_status
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.plan IS NOT NULL THEN
    BEGIN
      PERFORM public.reset_monthly_credits(NEW.user_id, NEW.plan);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'reset_monthly_credits failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_subscription_activated_reset_credits ON public.subscription_requests;
CREATE TRIGGER on_subscription_activated_reset_credits
  AFTER UPDATE ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_credits_on_plan_change();

-- 16) Trigger: updated_at على الجداول الجديدة
CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_topup_packages_updated_at
  BEFORE UPDATE ON public.topup_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_topup_purchases_updated_at
  BEFORE UPDATE ON public.topup_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_jobs_updated_at
  BEFORE UPDATE ON public.video_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_text_usage_updated_at
  BEFORE UPDATE ON public.daily_text_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_credits_updated_at
  BEFORE UPDATE ON public.plan_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- بيانات أولية
-- ============================================================

INSERT INTO public.plan_credits (plan, monthly_credits, daily_text_cap, daily_image_cap)
VALUES
  ('free', 50, 200, 50),
  ('pro', 7000, 200, 50),
  ('business', 20000, 500, 200)
ON CONFLICT (plan) DO UPDATE
  SET monthly_credits = EXCLUDED.monthly_credits,
      daily_text_cap = EXCLUDED.daily_text_cap,
      daily_image_cap = EXCLUDED.daily_image_cap,
      updated_at = now();

INSERT INTO public.topup_packages (id, credits, price_sar, display_name, display_order)
VALUES
  ('pkg_500', 500, 29.00, 'حزمة صغيرة — 500 نقطة', 1),
  ('pkg_1500', 1500, 79.00, 'حزمة متوسطة — 1500 نقطة', 2),
  ('pkg_5000', 5000, 249.00, 'حزمة كبيرة — 5000 نقطة', 3)
ON CONFLICT (id) DO UPDATE
  SET credits = EXCLUDED.credits,
      price_sar = EXCLUDED.price_sar,
      display_name = EXCLUDED.display_name,
      display_order = EXCLUDED.display_order,
      updated_at = now();

-- زرع رصيد أولي للمستخدمين الموجودين
INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
SELECT
  p.id,
  COALESCE(pc.monthly_credits, 50),
  0,
  now(),
  now() + interval '30 days'
FROM public.profiles p
LEFT JOIN public.plan_credits pc ON pc.plan = p.plan
ON CONFLICT (user_id) DO NOTHING;

-- ==========================================
-- Migration File: 20260424194757_9c6b54c4-b769-46b5-9320-3dd7f9ce84d7.sql
-- ==========================================

-- إضافة الباقات الجديدة
ALTER TYPE public.user_plan ADD VALUE IF NOT EXISTS 'starter';
ALTER TYPE public.user_plan ADD VALUE IF NOT EXISTS 'growth';

-- ==========================================
-- Migration File: 20260424195346_95547050-2f26-4e9a-9f60-c06584f4f03c.sql
-- ==========================================

-- (1) handle_new_user — منح النقاط الأولية atomically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credits integer;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  IF LOWER(NEW.email) = 'saalla012@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  SELECT monthly_credits INTO _credits FROM public.plan_credits WHERE plan = 'free'::user_plan;
  IF _credits IS NULL THEN _credits := 50; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup, metadata
  ) VALUES (
    NEW.id, 'plan_grant', _credits, 'plan',
    _credits, 0,
    jsonb_build_object('reason','initial_signup','plan','free')
  );

  RETURN NEW;
END;
$$;

-- (2) Triggers على subscription_requests
DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
CREATE TRIGGER trg_sync_profile_plan_on_activation
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
CREATE TRIGGER trg_reset_credits_on_plan_change
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

-- (3) إغلاق الدوال الإدارية
REVOKE EXECUTE ON FUNCTION public.activate_topup_purchase(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_monthly_credits(uuid, public.user_plan) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, text) FROM PUBLIC, anon, authenticated;

-- (4) Trigger يقفل credits/price من topup_packages
CREATE OR REPLACE FUNCTION public.lock_topup_from_package()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pkg public.topup_packages;
BEGIN
  SELECT * INTO _pkg FROM public.topup_packages
  WHERE id = NEW.package_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'package_not_found_or_inactive: %', NEW.package_id;
  END IF;

  NEW.credits   := _pkg.credits;
  NEW.price_sar := _pkg.price_sar;

  IF auth.uid() IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    NEW.user_id := auth.uid();
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending'::topup_status THEN
    NEW.status := 'pending'::topup_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;
CREATE TRIGGER trg_lock_topup_from_package
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

-- (5) Index على refund_ledger_id
CREATE INDEX IF NOT EXISTS idx_credit_ledger_refund
ON public.credit_ledger (refund_ledger_id)
WHERE refund_ledger_id IS NOT NULL;

-- (6) get_user_credits_summary مع daily_image_used (DROP أولاً لتغيير return type)
DROP FUNCTION IF EXISTS public.get_user_credits_summary();

CREATE FUNCTION public.get_user_credits_summary()
RETURNS TABLE(
  plan_credits integer,
  topup_credits integer,
  total_credits integer,
  cycle_ends_at timestamp with time zone,
  daily_text_used integer,
  daily_text_cap integer,
  daily_image_used integer,
  daily_image_cap integer,
  plan public.user_plan
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(uc.plan_credits, 0),
    COALESCE(uc.topup_credits, 0),
    COALESCE(uc.plan_credits, 0) + COALESCE(uc.topup_credits, 0),
    uc.cycle_ends_at,
    COALESCE(dtu.text_count, 0),
    COALESCE(pc.daily_text_cap, 200),
    COALESCE(dtu.image_count, 0),
    COALESCE(pc.daily_image_cap, 50),
    COALESCE(p.plan, 'free'::user_plan)
  FROM (SELECT _uid AS uid) base
  LEFT JOIN public.user_credits uc ON uc.user_id = base.uid
  LEFT JOIN public.profiles p ON p.id = base.uid
  LEFT JOIN public.plan_credits pc ON pc.plan = COALESCE(p.plan, 'free'::user_plan)
  LEFT JOIN public.daily_text_usage dtu
    ON dtu.user_id = base.uid
    AND dtu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date;
END;
$$;

-- (7) refund_credits — تأكيد ownership صريح + دعم service_role
CREATE OR REPLACE FUNCTION public.refund_credits(_ledger_id uuid, _reason text DEFAULT 'generation_failed')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _orig public.credit_ledger;
  _uid uuid := auth.uid();
  _is_service boolean := (auth.role() = 'service_role');
  _from_plan integer;
  _from_topup integer;
  _refund_amount integer;
  _row public.user_credits;
  _refund_id uuid;
BEGIN
  IF _uid IS NULL AND NOT _is_service THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT * INTO _orig FROM public.credit_ledger WHERE id = _ledger_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ledger_not_found'; END IF;

  IF NOT _is_service AND _orig.user_id IS DISTINCT FROM _uid THEN
    RAISE EXCEPTION 'forbidden_not_owner';
  END IF;

  IF _orig.refunded_at IS NOT NULL THEN RAISE EXCEPTION 'already_refunded'; END IF;
  IF _orig.txn_type NOT IN ('consume_image','consume_video') THEN
    RAISE EXCEPTION 'not_refundable';
  END IF;

  _refund_amount := -_orig.amount;
  _from_plan := COALESCE((_orig.metadata->>'from_plan')::integer, _refund_amount);
  _from_topup := COALESCE((_orig.metadata->>'from_topup')::integer, 0);

  PERFORM public._ensure_user_credits(_orig.user_id);

  UPDATE public.user_credits
  SET plan_credits = plan_credits + _from_plan,
      topup_credits = topup_credits + _from_topup,
      updated_at = now()
  WHERE user_id = _orig.user_id
  RETURNING * INTO _row;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _orig.user_id, 'refund', _refund_amount, _orig.source,
    _row.plan_credits, _row.topup_credits,
    _orig.reference_id, _orig.reference_type,
    jsonb_build_object('reason', _reason, 'original_ledger_id', _ledger_id,
                       'restored_plan', _from_plan, 'restored_topup', _from_topup,
                       'refunded_by', COALESCE(_uid::text, 'service_role'))
  ) RETURNING id INTO _refund_id;

  UPDATE public.credit_ledger
  SET refunded_at = now(), refund_ledger_id = _refund_id
  WHERE id = _ledger_id;

  RETURN _refund_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, text) FROM PUBLIC, anon, authenticated;

-- ==========================================
-- Migration File: 20260424195424_17d36731-4f5a-4a6b-ba79-602d8c89ddca.sql
-- ==========================================

-- إزالة التريغرات المكرّرة
DROP TRIGGER IF EXISTS on_profile_created_grant_credits ON public.profiles;
DROP TRIGGER IF EXISTS on_subscription_activated_reset_credits ON public.subscription_requests;

-- تنظيف ledger duplicates لـ initial_signup (إن وُجدت): الإبقاء على الأقدم لكل مستخدم
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.credit_ledger
  WHERE txn_type = 'plan_grant'
    AND metadata->>'reason' = 'initial_signup'
)
DELETE FROM public.credit_ledger
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ==========================================
-- Migration File: 20260424195753_a175d128-cc20-49a4-912f-0118db10fea8.sql
-- ==========================================


-- حصر تنفيذ الدوال على المستخدمين المسجَّلين فقط
REVOKE EXECUTE ON FUNCTION public.consume_credits(integer, public.credit_txn_type, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.consume_credits(integer, public.credit_txn_type, uuid, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.consume_text_quota() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.consume_text_quota() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_credits_summary() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_credits_summary() TO authenticated;


-- ==========================================
-- Migration File: 20260424200508_3d4e72b4-d17e-4293-8484-6ffcd3bed85b.sql
-- ==========================================

-- ============================================================
-- Phase 1 — إصلاح: ربط جميع الـ functions بـ triggers فعّالة
-- ============================================================

-- 1) Trigger لتسجيل المستخدمين الجدد (auth.users)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2) Triggers على subscription_requests
DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
CREATE TRIGGER trg_sync_profile_plan_on_activation
  AFTER UPDATE ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_plan_on_activation();

DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
CREATE TRIGGER trg_reset_credits_on_plan_change
  AFTER UPDATE ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_credits_on_plan_change();

DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;
CREATE TRIGGER trg_notify_admin_on_subscription_request
  AFTER INSERT ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_subscription_request();

DROP TRIGGER IF EXISTS trg_subscription_requests_updated_at ON public.subscription_requests;
CREATE TRIGGER trg_subscription_requests_updated_at
  BEFORE UPDATE ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Triggers على topup_purchases — قفل القيم من الباقة + updated_at
DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;
CREATE TRIGGER trg_lock_topup_from_package
  BEFORE INSERT ON public.topup_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_topup_from_package();

DROP TRIGGER IF EXISTS trg_topup_purchases_updated_at ON public.topup_purchases;
CREATE TRIGGER trg_topup_purchases_updated_at
  BEFORE UPDATE ON public.topup_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Triggers على generations — نزاهة الإدراج + الحصة
DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
CREATE TRIGGER trg_enforce_generation_integrity
  BEFORE INSERT ON public.generations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_generation_integrity();

-- ملاحظة: enforce_generation_quota أصبح زائداً مع نظام النقاط الجديد
-- النقاط هي مصدر الحجب، لذا لا نُفعّله لتجنب double-blocking

-- 5) Triggers على updated_at للجداول الجديدة
DROP TRIGGER IF EXISTS trg_user_credits_updated_at ON public.user_credits;
CREATE TRIGGER trg_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_daily_text_usage_updated_at ON public.daily_text_usage;
CREATE TRIGGER trg_daily_text_usage_updated_at
  BEFORE UPDATE ON public.daily_text_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_topup_packages_updated_at ON public.topup_packages;
CREATE TRIGGER trg_topup_packages_updated_at
  BEFORE UPDATE ON public.topup_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_plan_credits_updated_at ON public.plan_credits;
CREATE TRIGGER trg_plan_credits_updated_at
  BEFORE UPDATE ON public.plan_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- Migration File: 20260424200546_abb0e413-1ad3-4fa8-bf16-a901a757a8eb.sql
-- ==========================================

-- ============================================================
-- تنظيف triggers مكررة + إزالة الحجب المزدوج
-- ============================================================

-- 1) إزالة الحجب المزدوج (النقاط هي مصدر الحجب الآن)
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;

-- 2) إزالة triggers updated_at القديمة (نُبقي trg_* الجديدة)
DROP TRIGGER IF EXISTS update_daily_text_usage_updated_at ON public.daily_text_usage;
DROP TRIGGER IF EXISTS update_plan_credits_updated_at ON public.plan_credits;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS update_topup_packages_updated_at ON public.topup_packages;
DROP TRIGGER IF EXISTS update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;

-- ==========================================
-- Migration File: 20260424200812_94a325ae-2325-4aa6-88f2-d7b66978ec80.sql
-- ==========================================


-- 1) حجب الدوال الحساسة عن anon و public (لا أحد بدون auth يقدر يستدعيها)
REVOKE EXECUTE ON FUNCTION public.bump_usage(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_generation(
  public.generation_type, text, text, text, text, integer, integer, integer, numeric, jsonb
) FROM PUBLIC, anon;

-- (التأكد) السماح للمصادَق عليهم وservice_role
GRANT EXECUTE ON FUNCTION public.bump_usage(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_generation(
  public.generation_type, text, text, text, text, integer, integer, integer, numeric, jsonb
) TO authenticated, service_role;

-- 2) حذف UNIQUE constraint مكرّر على usage_logs
-- نُبقي على usage_logs_user_id_month_key (الاسم القياسي) ونحذف القديم المكرّر
ALTER TABLE public.usage_logs
  DROP CONSTRAINT IF EXISTS usage_logs_user_month_unique;


-- ==========================================
-- Migration File: 20260424200829_96ad8c79-1224-4580-8d32-1b55ab1969c3.sql
-- ==========================================


-- نمنح authenticated صلاحية الاستدعاء، والدالة نفسها تفحص has_role admin داخلياً
GRANT EXECUTE ON FUNCTION public.activate_topup_purchase(uuid) TO authenticated;


-- ==========================================
-- Migration File: 20260424203418_ca0c4d62-5544-494c-acf2-ed5ac541f27e.sql
-- ==========================================

-- Phase 5: Performance indexes for credits/topup admin queries

-- credit_ledger: استعلامات الأدمن (تصفية بنوع الحركة + ترتيب زمني)
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created
  ON public.credit_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_txn_created
  ON public.credit_ledger (txn_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_created
  ON public.credit_ledger (created_at DESC);

-- topup_purchases: فلترة الأدمن حسب الحالة + سجل المستخدم
CREATE INDEX IF NOT EXISTS idx_topup_purchases_status_created
  ON public.topup_purchases (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_topup_purchases_user_created
  ON public.topup_purchases (user_id, created_at DESC);

-- daily_text_usage: تقارير يومية
CREATE INDEX IF NOT EXISTS idx_daily_text_usage_day
  ON public.daily_text_usage (day DESC);

-- usage_logs: تقارير شهرية + reconcile
CREATE INDEX IF NOT EXISTS idx_usage_logs_month
  ON public.usage_logs (month);


-- ==========================================
-- Migration File: 20260424214449_ece19c28-66ef-4299-81e8-8af3f2786fc7.sql
-- ==========================================

CREATE OR REPLACE FUNCTION public.consume_image_quota()
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _plan public.user_plan;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT plan INTO _plan FROM public.profiles WHERE id = _uid;
  IF _plan IS NULL THEN _plan := 'free'; END IF;

  SELECT daily_image_cap INTO _cap FROM public.plan_credits WHERE plan = _plan;
  IF _cap IS NULL THEN _cap := 50; END IF;

  INSERT INTO public.daily_text_usage (user_id, day, image_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET image_count = public.daily_text_usage.image_count + 1,
        updated_at = now()
  RETURNING image_count INTO _new_count;

  IF _new_count > _cap THEN
    UPDATE public.daily_text_usage
    SET image_count = image_count - 1, updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_credits(_amount integer, _txn_type credit_txn_type, _reference_id uuid DEFAULT NULL::uuid, _reference_type text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(ledger_id uuid, remaining_plan integer, remaining_topup integer, remaining_total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.user_credits;
  _from_plan integer := 0;
  _from_topup integer := 0;
  _new_ledger_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF _txn_type <> 'consume_video' THEN
    RAISE EXCEPTION 'video_credits_only';
  END IF;

  PERFORM public._ensure_user_credits(_uid);

  SELECT * INTO _row
  FROM public.user_credits
  WHERE user_id = _uid
  FOR UPDATE;

  IF (_row.plan_credits + _row.topup_credits) < _amount THEN
    RAISE EXCEPTION 'insufficient_credits: required=% available=%',
      _amount, (_row.plan_credits + _row.topup_credits)
      USING ERRCODE = 'check_violation';
  END IF;

  IF _row.plan_credits >= _amount THEN
    _from_plan := _amount;
    _from_topup := 0;
  ELSE
    _from_plan := _row.plan_credits;
    _from_topup := _amount - _from_plan;
  END IF;

  UPDATE public.user_credits
  SET plan_credits = plan_credits - _from_plan,
      topup_credits = topup_credits - _from_topup,
      updated_at = now()
  WHERE user_id = _uid
  RETURNING * INTO _row;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _uid, _txn_type, -_amount,
    CASE WHEN _from_topup = 0 THEN 'plan'::credit_source
         WHEN _from_plan = 0 THEN 'topup'::credit_source
         ELSE 'plan'::credit_source END,
    _row.plan_credits, _row.topup_credits,
    _reference_id, _reference_type,
    _metadata || jsonb_build_object('from_plan', _from_plan, 'from_topup', _from_topup, 'credit_scope', 'video')
  ) RETURNING id INTO _new_ledger_id;

  RETURN QUERY SELECT
    _new_ledger_id,
    _row.plan_credits,
    _row.topup_credits,
    (_row.plan_credits + _row.topup_credits);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_credits_summary()
RETURNS TABLE(plan_credits integer, topup_credits integer, total_credits integer, cycle_ends_at timestamp with time zone, daily_text_used integer, daily_text_cap integer, daily_image_used integer, daily_image_cap integer, plan user_plan)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(uc.plan_credits, 0),
    COALESCE(uc.topup_credits, 0),
    COALESCE(uc.plan_credits, 0) + COALESCE(uc.topup_credits, 0),
    uc.cycle_ends_at,
    COALESCE(dtu.text_count, 0),
    COALESCE(pc.daily_text_cap, 200),
    COALESCE(dtu.image_count, 0),
    COALESCE(pc.daily_image_cap, 50),
    COALESCE(p.plan, 'free'::user_plan)
  FROM (SELECT _uid AS uid) base
  LEFT JOIN public.user_credits uc ON uc.user_id = base.uid
  LEFT JOIN public.profiles p ON p.id = base.uid
  LEFT JOIN public.plan_credits pc ON pc.plan = COALESCE(p.plan, 'free'::user_plan)
  LEFT JOIN public.daily_text_usage dtu
    ON dtu.user_id = base.uid
    AND dtu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_initial_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _credits integer;
BEGIN
  SELECT monthly_credits INTO _credits
  FROM public.plan_credits WHERE plan = COALESCE(NEW.plan, 'free'::user_plan);

  IF _credits IS NULL THEN _credits := 150; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup, metadata
  ) VALUES (
    NEW.id, 'plan_grant', _credits, 'plan',
    _credits, 0,
    jsonb_build_object('reason', 'initial_signup', 'plan', NEW.plan, 'credit_scope', 'video')
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _credits integer;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  IF LOWER(NEW.email) = 'saalla012@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  SELECT monthly_credits INTO _credits FROM public.plan_credits WHERE plan = 'free'::user_plan;
  IF _credits IS NULL THEN _credits := 150; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup, metadata
  ) VALUES (
    NEW.id, 'plan_grant', _credits, 'plan',
    _credits, 0,
    jsonb_build_object('reason','initial_signup','plan','free','credit_scope','video')
  );

  RETURN NEW;
END;
$$;

-- ==========================================
-- Migration File: 20260425072016_85d1b497-ae57-446b-a001-9b571a45da55.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS public.campaign_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  offer TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT 'launch',
  channel TEXT NOT NULL DEFAULT 'instagram',
  status TEXT NOT NULL DEFAULT 'draft',
  brief TEXT NOT NULL DEFAULT '',
  text_prompt TEXT NOT NULL DEFAULT '',
  image_prompt TEXT NOT NULL DEFAULT '',
  video_prompt TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_packs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_campaign_packs_user_updated ON public.campaign_packs (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_packs_status ON public.campaign_packs (status);

CREATE POLICY "Users can view own campaign packs"
ON public.campaign_packs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all campaign packs"
ON public.campaign_packs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own campaign packs"
ON public.campaign_packs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('draft', 'generated', 'archived')
  AND goal IN ('launch', 'offer', 'seasonal', 'retention')
  AND channel IN ('instagram', 'snapchat', 'tiktok', 'whatsapp')
  AND char_length(product) <= 500
  AND char_length(audience) <= 500
  AND char_length(offer) <= 500
  AND char_length(brief) <= 5000
  AND char_length(text_prompt) <= 5000
  AND char_length(image_prompt) <= 3000
  AND char_length(video_prompt) <= 3000
);

CREATE POLICY "Users can update own campaign packs"
ON public.campaign_packs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('draft', 'generated', 'archived')
  AND goal IN ('launch', 'offer', 'seasonal', 'retention')
  AND channel IN ('instagram', 'snapchat', 'tiktok', 'whatsapp')
  AND char_length(product) <= 500
  AND char_length(audience) <= 500
  AND char_length(offer) <= 500
  AND char_length(brief) <= 5000
  AND char_length(text_prompt) <= 5000
  AND char_length(image_prompt) <= 3000
  AND char_length(video_prompt) <= 3000
);

CREATE POLICY "Users can delete own campaign packs"
ON public.campaign_packs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_campaign_packs_updated_at ON public.campaign_packs;
CREATE TRIGGER update_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- Migration File: 20260425073929_dbcc543c-e2b5-4c8f-9c42-3400c47ef553.sql
-- ==========================================

DROP POLICY IF EXISTS "Users can insert own generations" ON public.generations;

DROP POLICY IF EXISTS "Users can update own generations" ON public.generations;

CREATE POLICY "Users can update own generations"
ON public.generations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- Migration File: 20260425075817_7eebfe41-6814-444c-86a5-ce7149e43d44.sql
-- ==========================================

-- Enable required triggers for existing production functions.
-- Idempotent: safe to run even if some triggers already exist.

-- New user bootstrap: profile, role, and initial credits.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Automatic updated_at maintenance for mutable public tables.
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
CREATE TRIGGER update_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_contact_submissions_updated_at ON public.contact_submissions;
CREATE TRIGGER update_contact_submissions_updated_at
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;
CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_plan_credits_updated_at ON public.plan_credits;
CREATE TRIGGER update_plan_credits_updated_at
BEFORE UPDATE ON public.plan_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_settings_updated_at ON public.payment_settings;
CREATE TRIGGER update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_topup_packages_updated_at ON public.topup_packages;
CREATE TRIGGER update_topup_packages_updated_at
BEFORE UPDATE ON public.topup_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_topup_purchases_updated_at ON public.topup_purchases;
CREATE TRIGGER update_topup_purchases_updated_at
BEFORE UPDATE ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_packs_updated_at ON public.campaign_packs;
CREATE TRIGGER update_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_video_jobs_updated_at ON public.video_jobs;
CREATE TRIGGER update_video_jobs_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_send_state_updated_at ON public.email_send_state;
CREATE TRIGGER update_email_send_state_updated_at
BEFORE UPDATE ON public.email_send_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_dlq_alert_state_updated_at ON public.dlq_alert_state;
CREATE TRIGGER update_dlq_alert_state_updated_at
BEFORE UPDATE ON public.dlq_alert_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_stale_subs_alert_state_updated_at ON public.stale_subs_alert_state;
CREATE TRIGGER update_stale_subs_alert_state_updated_at
BEFORE UPDATE ON public.stale_subs_alert_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Top-up integrity: lock credits and price from package, force pending ownership.
DROP TRIGGER IF EXISTS lock_topup_from_package_before_insert ON public.topup_purchases;
CREATE TRIGGER lock_topup_from_package_before_insert
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

-- Generation protection and quota enforcement.
DROP TRIGGER IF EXISTS enforce_generation_integrity_before_insert ON public.generations;
CREATE TRIGGER enforce_generation_integrity_before_insert
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

DROP TRIGGER IF EXISTS enforce_generation_quota_before_insert ON public.generations;
CREATE TRIGGER enforce_generation_quota_before_insert
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_quota();

-- Subscription activation side effects.
DROP TRIGGER IF EXISTS sync_profile_plan_on_subscription_activation ON public.subscription_requests;
CREATE TRIGGER sync_profile_plan_on_subscription_activation
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

DROP TRIGGER IF EXISTS reset_credits_on_subscription_activation ON public.subscription_requests;
CREATE TRIGGER reset_credits_on_subscription_activation
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

-- Operational notification for new subscription requests.
DROP TRIGGER IF EXISTS notify_admin_on_subscription_request_insert ON public.subscription_requests;
CREATE TRIGGER notify_admin_on_subscription_request_insert
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();

-- ==========================================
-- Migration File: 20260425081444_3a8eab08-ada6-4aea-8a76-fdec2b05da77.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS public.daily_video_usage (
  user_id uuid NOT NULL,
  day date NOT NULL,
  video_count integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.daily_video_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own daily video usage" ON public.daily_video_usage;
CREATE POLICY "Users view own daily video usage"
ON public.daily_video_usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all daily video usage" ON public.daily_video_usage;
CREATE POLICY "Admins view all daily video usage"
ON public.daily_video_usage
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_daily_video_usage_updated_at ON public.daily_video_usage;
CREATE TRIGGER update_daily_video_usage_updated_at
BEFORE UPDATE ON public.daily_video_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.video_daily_cap_for_plan(_plan public.user_plan)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'business'::public.user_plan THEN 20
    WHEN 'pro'::public.user_plan THEN 12
    WHEN 'growth'::public.user_plan THEN 6
    WHEN 'starter'::public.user_plan THEN 3
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.consume_video_daily_quota()
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _plan public.user_plan;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT plan INTO _plan FROM public.profiles WHERE id = _uid;
  IF _plan IS NULL THEN _plan := 'free'::public.user_plan; END IF;

  SELECT public.video_daily_cap_for_plan(_plan) INTO _cap;
  IF _cap IS NULL THEN _cap := 1; END IF;

  INSERT INTO public.daily_video_usage (user_id, day, video_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET video_count = public.daily_video_usage.video_count + 1,
        updated_at = now()
  RETURNING video_count INTO _new_count;

  IF _new_count > _cap THEN
    UPDATE public.daily_video_usage
    SET video_count = GREATEST(video_count - 1, 0), updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_video_daily_quota(_user_id uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := COALESCE(_user_id, auth.uid());
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  UPDATE public.daily_video_usage
  SET video_count = GREATEST(video_count - 1, 0), updated_at = now()
  WHERE user_id = _uid AND day = _today AND video_count > 0;
END;
$$;

-- ==========================================
-- Migration File: 20260425081516_40bb1626-732f-42b2-823d-d424d78f5eab.sql
-- ==========================================

DROP FUNCTION IF EXISTS public.get_user_credits_summary();

CREATE FUNCTION public.get_user_credits_summary()
RETURNS TABLE(
  plan_credits integer,
  topup_credits integer,
  total_credits integer,
  cycle_ends_at timestamp with time zone,
  daily_text_used integer,
  daily_text_cap integer,
  daily_image_used integer,
  daily_image_cap integer,
  daily_video_used integer,
  daily_video_cap integer,
  plan public.user_plan
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(uc.plan_credits, 0),
    COALESCE(uc.topup_credits, 0),
    COALESCE(uc.plan_credits, 0) + COALESCE(uc.topup_credits, 0),
    uc.cycle_ends_at,
    COALESCE(dtu.text_count, 0),
    COALESCE(pc.daily_text_cap, 200),
    COALESCE(dtu.image_count, 0),
    COALESCE(pc.daily_image_cap, 50),
    COALESCE(dvu.video_count, 0),
    public.video_daily_cap_for_plan(COALESCE(p.plan, 'free'::public.user_plan)),
    COALESCE(p.plan, 'free'::public.user_plan)
  FROM (SELECT _uid AS uid) base
  LEFT JOIN public.user_credits uc ON uc.user_id = base.uid
  LEFT JOIN public.profiles p ON p.id = base.uid
  LEFT JOIN public.plan_credits pc ON pc.plan = COALESCE(p.plan, 'free'::public.user_plan)
  LEFT JOIN public.daily_text_usage dtu
    ON dtu.user_id = base.uid
    AND dtu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date
  LEFT JOIN public.daily_video_usage dvu
    ON dvu.user_id = base.uid
    AND dvu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date;
END;
$$;

-- ==========================================
-- Migration File: 20260425082133_47dc1fe6-0c43-4c97-94ae-14153e9a8645.sql
-- ==========================================

DROP TRIGGER IF EXISTS enforce_generation_integrity_before_insert ON public.generations;
DROP TRIGGER IF EXISTS enforce_generation_quota_before_insert ON public.generations;
DROP TRIGGER IF EXISTS sync_profile_plan_on_subscription_activation ON public.subscription_requests;
DROP TRIGGER IF EXISTS reset_credits_on_subscription_activation ON public.subscription_requests;
DROP TRIGGER IF EXISTS notify_admin_on_subscription_request_insert ON public.subscription_requests;
DROP TRIGGER IF EXISTS lock_topup_from_package_before_insert ON public.topup_purchases;
DROP TRIGGER IF EXISTS update_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS update_contact_submissions_updated_at ON public.contact_submissions;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS update_topup_packages_updated_at ON public.topup_packages;
DROP TRIGGER IF EXISTS update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;
DROP TRIGGER IF EXISTS update_plan_credits_updated_at ON public.plan_credits;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_action
ON public.admin_audit_log (created_at DESC, action, target_table);

-- ==========================================
-- Migration File: 20260425082401_8f30da81-74af-4b91-b90a-b36999e686a6.sql
-- ==========================================

CREATE TRIGGER trg_enforce_generation_quota
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_quota();

CREATE TRIGGER trg_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_contact_submissions_updated_at
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- Migration File: 20260425083047_ec0f3d00-5790-48b0-a0bd-62acabb31c21.sql
-- ==========================================

DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;
DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_update_topup_packages_updated_at ON public.topup_packages;
DROP TRIGGER IF EXISTS trg_update_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS trg_update_contact_submissions_updated_at ON public.contact_submissions;
DROP TRIGGER IF EXISTS trg_update_user_credits_updated_at ON public.user_credits;

CREATE TRIGGER trg_enforce_generation_integrity
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

CREATE TRIGGER trg_enforce_generation_quota
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_quota();

CREATE TRIGGER trg_sync_profile_plan_on_activation
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

CREATE TRIGGER trg_reset_credits_on_plan_change
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

CREATE TRIGGER trg_notify_admin_on_subscription_request
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();

CREATE TRIGGER trg_lock_topup_from_package
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

CREATE TRIGGER trg_update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_topup_purchases_updated_at
BEFORE UPDATE ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_topup_packages_updated_at
BEFORE UPDATE ON public.topup_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_contact_submissions_updated_at
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- Migration File: 20260425083109_ca4a3d05-2784-4a36-985c-49c7124ad707.sql
-- ==========================================

DROP TRIGGER IF EXISTS trg_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS trg_contact_submissions_updated_at ON public.contact_submissions;
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_topup_packages_updated_at ON public.topup_packages;
DROP TRIGGER IF EXISTS trg_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_user_credits_updated_at ON public.user_credits;

-- ==========================================
-- Migration File: 20260425083833_beea0679-c44a-4b15-ab5c-cce2f430327f.sql
-- ==========================================

-- Remove legacy or duplicate public triggers before creating the canonical set
DROP TRIGGER IF EXISTS enforce_generation_integrity_before_insert ON public.generations;
DROP TRIGGER IF EXISTS enforce_generation_quota_before_insert ON public.generations;
DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;

DROP TRIGGER IF EXISTS sync_profile_plan_on_subscription_activation ON public.subscription_requests;
DROP TRIGGER IF EXISTS reset_credits_on_subscription_activation ON public.subscription_requests;
DROP TRIGGER IF EXISTS notify_admin_on_subscription_request_insert ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;

DROP TRIGGER IF EXISTS lock_topup_from_package_before_insert ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;

DROP TRIGGER IF EXISTS update_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS update_contact_submissions_updated_at ON public.contact_submissions;
DROP TRIGGER IF EXISTS update_daily_video_usage_updated_at ON public.daily_video_usage;
DROP TRIGGER IF EXISTS update_payment_settings_updated_at ON public.payment_settings;
DROP TRIGGER IF EXISTS update_plan_credits_updated_at ON public.plan_credits;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS update_topup_packages_updated_at ON public.topup_packages;
DROP TRIGGER IF EXISTS update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;
DROP TRIGGER IF EXISTS trg_update_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS trg_update_contact_submissions_updated_at ON public.contact_submissions;
DROP TRIGGER IF EXISTS trg_update_daily_video_usage_updated_at ON public.daily_video_usage;
DROP TRIGGER IF EXISTS trg_update_payment_settings_updated_at ON public.payment_settings;
DROP TRIGGER IF EXISTS trg_update_plan_credits_updated_at ON public.plan_credits;
DROP TRIGGER IF EXISTS trg_update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_update_topup_packages_updated_at ON public.topup_packages;
DROP TRIGGER IF EXISTS trg_update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_update_user_credits_updated_at ON public.user_credits;

-- Generation protection and quota enforcement
CREATE TRIGGER trg_enforce_generation_integrity
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

CREATE TRIGGER trg_enforce_generation_quota
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_quota();

-- Subscription activation automation
CREATE TRIGGER trg_sync_profile_plan_on_activation
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

CREATE TRIGGER trg_reset_credits_on_plan_change
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

CREATE TRIGGER trg_notify_admin_on_subscription_request
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();

-- Top-up package locking before user purchase is stored
CREATE TRIGGER trg_lock_topup_from_package
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

-- Canonical updated_at triggers on public operational tables
CREATE TRIGGER trg_update_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_contact_submissions_updated_at
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_daily_video_usage_updated_at
BEFORE UPDATE ON public.daily_video_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_plan_credits_updated_at
BEFORE UPDATE ON public.plan_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_topup_packages_updated_at
BEFORE UPDATE ON public.topup_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_topup_purchases_updated_at
BEFORE UPDATE ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- Migration File: 20260425083857_db473025-e280-48ec-88d1-a3580e326c8c.sql
-- ==========================================

DROP TRIGGER IF EXISTS trg_plan_credits_updated_at ON public.plan_credits;

-- ==========================================
-- Migration File: 20260425084626_eb62efa2-3d76-4ff8-ad44-e34947f87670.sql
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_update_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_campaign_packs_updated_at ON public.campaign_packs;
CREATE TRIGGER trg_update_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_contact_submissions_updated_at ON public.contact_submissions;
CREATE TRIGGER trg_update_contact_submissions_updated_at
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_payment_settings_updated_at ON public.payment_settings;
CREATE TRIGGER trg_update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_plan_credits_updated_at ON public.plan_credits;
CREATE TRIGGER trg_update_plan_credits_updated_at
BEFORE UPDATE ON public.plan_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_plan_limits_updated_at ON public.plan_limits;
CREATE TRIGGER trg_update_plan_limits_updated_at
BEFORE UPDATE ON public.plan_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_topup_packages_updated_at ON public.topup_packages;
CREATE TRIGGER trg_update_topup_packages_updated_at
BEFORE UPDATE ON public.topup_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_topup_purchases_updated_at ON public.topup_purchases;
CREATE TRIGGER trg_update_topup_purchases_updated_at
BEFORE UPDATE ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_user_credits_updated_at ON public.user_credits;
CREATE TRIGGER trg_update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_usage_logs_updated_at ON public.usage_logs;
CREATE TRIGGER trg_update_usage_logs_updated_at
BEFORE UPDATE ON public.usage_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_daily_text_usage_updated_at ON public.daily_text_usage;
CREATE TRIGGER trg_update_daily_text_usage_updated_at
BEFORE UPDATE ON public.daily_text_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_daily_video_usage_updated_at ON public.daily_video_usage;
CREATE TRIGGER trg_update_daily_video_usage_updated_at
BEFORE UPDATE ON public.daily_video_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_subscription_requests_updated_at ON public.subscription_requests;
CREATE TRIGGER trg_update_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
CREATE TRIGGER trg_enforce_generation_integrity
BEFORE INSERT OR UPDATE ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;
CREATE TRIGGER trg_enforce_generation_quota
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_quota();

DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
CREATE TRIGGER trg_sync_profile_plan_on_activation
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
CREATE TRIGGER trg_reset_credits_on_plan_change
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;
CREATE TRIGGER trg_notify_admin_on_subscription_request
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();

DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;
CREATE TRIGGER trg_lock_topup_from_package
BEFORE INSERT OR UPDATE OF package_id, credits, price_sar, status, user_id ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

-- ==========================================
-- Migration File: 20260425085013_5405b346-fb62-46b7-8052-d0d05c051d74.sql
-- ==========================================

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
DROP TRIGGER IF EXISTS trg_daily_text_usage_updated_at ON public.daily_text_usage;
DROP TRIGGER IF EXISTS update_usage_logs_updated_at ON public.usage_logs;

-- ==========================================
-- Migration File: 20260425133906_533bbe5d-02a7-40ae-acc0-d1cb31f96467.sql
-- ==========================================

-- Phase 1 hardening: plans, profile plan safety, video constraints, quotas/refunds

-- 1) Keep plan catalog aligned with current public pricing while reducing Free image risk.
INSERT INTO public.plan_credits (plan, monthly_credits, daily_text_cap, daily_image_cap)
VALUES
  ('free'::public.user_plan, 150, 200, 5),
  ('starter'::public.user_plan, 3000, 200, 25),
  ('growth'::public.user_plan, 6000, 300, 50),
  ('pro'::public.user_plan, 11000, 600, 100),
  ('business'::public.user_plan, 30000, 1000, 150)
ON CONFLICT (plan) DO UPDATE
SET monthly_credits = EXCLUDED.monthly_credits,
    daily_text_cap = EXCLUDED.daily_text_cap,
    daily_image_cap = EXCLUDED.daily_image_cap,
    updated_at = now();

-- 2) Retire the old monthly generation trigger; daily quota functions are now authoritative.
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;
DROP TRIGGER IF EXISTS enforce_generation_quota_before_insert ON public.generations;

-- 3) Prevent users from self-upgrading profiles.plan while preserving normal profile edits.
CREATE OR REPLACE FUNCTION public.protect_profile_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'plan_change_not_allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_plan_change ON public.profiles;
CREATE TRIGGER trg_protect_profile_plan_change
BEFORE UPDATE OF plan ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

-- 4) Make video duration database rules match the app UI/server: 5 or 8 seconds.
ALTER TABLE public.video_jobs
DROP CONSTRAINT IF EXISTS video_jobs_duration_seconds_check;

ALTER TABLE public.video_jobs
ADD CONSTRAINT video_jobs_duration_seconds_check
CHECK (duration_seconds IN (5, 8));

-- 5) Database-level guard against concurrent processing video jobs per user.
CREATE OR REPLACE FUNCTION public.enforce_video_processing_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _processing_count integer;
BEGIN
  IF NEW.status = 'processing'::public.video_job_status THEN
    PERFORM pg_advisory_xact_lock(hashtext('video_processing_' || NEW.user_id::text));

    SELECT count(*) INTO _processing_count
    FROM public.video_jobs
    WHERE user_id = NEW.user_id
      AND status = 'processing'::public.video_job_status
      AND id IS DISTINCT FROM NEW.id;

    IF _processing_count >= 2 THEN
      RAISE EXCEPTION 'too_many_processing_video_jobs';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_video_processing_limit ON public.video_jobs;
CREATE TRIGGER trg_enforce_video_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

-- 6) Make subscription credit reset fail loudly instead of silently activating without credits.
CREATE OR REPLACE FUNCTION public.reset_credits_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'activated'::subscription_request_status
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.plan IS NOT NULL THEN
    PERFORM public.reset_monthly_credits(NEW.user_id, NEW.plan);
  END IF;
  RETURN NEW;
END;
$$;

-- 7) Tighten video daily quota release to owner/admin/service only.
CREATE OR REPLACE FUNCTION public.release_video_daily_quota(_user_id uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _uid uuid := COALESCE(_user_id, auth.uid());
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF auth.role() <> 'service_role'
     AND _uid IS DISTINCT FROM _caller
     AND NOT public.has_role(_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden_not_owner';
  END IF;

  UPDATE public.daily_video_usage
  SET video_count = GREATEST(video_count - 1, 0), updated_at = now()
  WHERE user_id = _uid AND day = _today AND video_count > 0;
END;
$$;

-- 8) Ensure authenticated users can only execute refund/release through ownership checks in the functions.
REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.release_video_daily_quota(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_video_daily_quota(uuid) TO authenticated, service_role;


-- ==========================================
-- Migration File: 20260425135927_d3a5b52e-bb57-4b61-b713-43baae4a6358.sql
-- ==========================================

DROP FUNCTION IF EXISTS public.get_user_credits_summary();
DROP FUNCTION IF EXISTS public.consume_image_quota();
DROP FUNCTION IF EXISTS public.consume_video_daily_quota();

CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  plan public.user_plan PRIMARY KEY,
  monthly_price_sar integer NOT NULL DEFAULT 0,
  yearly_price_sar integer NOT NULL DEFAULT 0,
  monthly_credits integer NOT NULL DEFAULT 0,
  daily_text_cap integer NOT NULL DEFAULT 20,
  daily_image_cap integer NOT NULL DEFAULT 2,
  daily_video_cap integer NOT NULL DEFAULT 0,
  image_pro_allowed boolean NOT NULL DEFAULT false,
  video_fast_allowed boolean NOT NULL DEFAULT true,
  video_quality_allowed boolean NOT NULL DEFAULT false,
  max_video_duration_seconds integer NOT NULL DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plan entitlements readable by everyone" ON public.plan_entitlements;
CREATE POLICY "Plan entitlements readable by everyone"
ON public.plan_entitlements
FOR SELECT
USING (active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage plan entitlements" ON public.plan_entitlements;
CREATE POLICY "Admins manage plan entitlements"
ON public.plan_entitlements
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_update_plan_entitlements_updated_at ON public.plan_entitlements;
CREATE TRIGGER trg_update_plan_entitlements_updated_at
BEFORE UPDATE ON public.plan_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plan_entitlements (
  plan, monthly_price_sar, yearly_price_sar, monthly_credits,
  daily_text_cap, daily_image_cap, daily_video_cap,
  image_pro_allowed, video_fast_allowed, video_quality_allowed,
  max_video_duration_seconds, active
)
VALUES
  ('free'::public.user_plan, 0, 0, 0, 10, 2, 0, false, false, false, 5, true),
  ('starter'::public.user_plan, 149, 1490, 1500, 100, 20, 3, false, true, false, 5, true),
  ('growth'::public.user_plan, 249, 2490, 5000, 250, 50, 6, true, true, true, 8, true),
  ('pro'::public.user_plan, 399, 3990, 11000, 600, 100, 12, true, true, true, 8, true),
  ('business'::public.user_plan, 999, 9990, 30000, 1000, 150, 20, true, true, true, 8, true)
ON CONFLICT (plan) DO UPDATE
SET monthly_price_sar = EXCLUDED.monthly_price_sar,
    yearly_price_sar = EXCLUDED.yearly_price_sar,
    monthly_credits = EXCLUDED.monthly_credits,
    daily_text_cap = EXCLUDED.daily_text_cap,
    daily_image_cap = EXCLUDED.daily_image_cap,
    daily_video_cap = EXCLUDED.daily_video_cap,
    image_pro_allowed = EXCLUDED.image_pro_allowed,
    video_fast_allowed = EXCLUDED.video_fast_allowed,
    video_quality_allowed = EXCLUDED.video_quality_allowed,
    max_video_duration_seconds = EXCLUDED.max_video_duration_seconds,
    active = EXCLUDED.active,
    updated_at = now();

INSERT INTO public.plan_credits (plan, monthly_credits, daily_text_cap, daily_image_cap)
SELECT plan, monthly_credits, daily_text_cap, daily_image_cap
FROM public.plan_entitlements
ON CONFLICT (plan) DO UPDATE
SET monthly_credits = EXCLUDED.monthly_credits,
    daily_text_cap = EXCLUDED.daily_text_cap,
    daily_image_cap = EXCLUDED.daily_image_cap,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.plan_entitlement_for_user(_user_id uuid DEFAULT auth.uid())
RETURNS public.plan_entitlements
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _uid uuid := COALESCE(_user_id, auth.uid());
  _plan public.user_plan;
  _ent public.plan_entitlements;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  IF auth.role() <> 'service_role'
     AND _uid IS DISTINCT FROM _caller
     AND NOT public.has_role(_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden_not_owner';
  END IF;

  SELECT plan INTO _plan FROM public.profiles WHERE id = _uid;
  IF _plan IS NULL THEN _plan := 'free'::public.user_plan; END IF;

  SELECT * INTO _ent FROM public.plan_entitlements WHERE plan = _plan AND active = true;
  IF NOT FOUND THEN SELECT * INTO _ent FROM public.plan_entitlements WHERE plan = 'free'::public.user_plan; END IF;
  RETURN _ent;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_text_quota()
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);
  _cap := COALESCE(_ent.daily_text_cap, 10);

  INSERT INTO public.daily_text_usage (user_id, day, text_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET text_count = public.daily_text_usage.text_count + 1,
        updated_at = now()
  RETURNING text_count INTO _new_count;

  IF _new_count > _cap THEN
    UPDATE public.daily_text_usage SET text_count = GREATEST(text_count - 1, 0), updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_image_quota(_quality text DEFAULT 'flash')
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _quality NOT IN ('flash', 'pro') THEN RAISE EXCEPTION 'invalid_image_quality'; END IF;

  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);
  IF _quality = 'pro' AND COALESCE(_ent.image_pro_allowed, false) = false THEN
    RAISE EXCEPTION 'image_pro_not_allowed';
  END IF;

  _cap := COALESCE(_ent.daily_image_cap, 2);

  INSERT INTO public.daily_text_usage (user_id, day, image_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET image_count = public.daily_text_usage.image_count + 1,
        updated_at = now()
  RETURNING image_count INTO _new_count;

  IF _new_count > _cap THEN
    UPDATE public.daily_text_usage SET image_count = GREATEST(image_count - 1, 0), updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.video_daily_cap_for_plan(_plan public.user_plan)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT daily_video_cap FROM public.plan_entitlements WHERE plan = _plan AND active = true), 0)
$$;

CREATE OR REPLACE FUNCTION public.consume_video_daily_quota(_quality text DEFAULT 'fast', _duration_seconds integer DEFAULT 5)
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _quality NOT IN ('fast', 'quality') THEN RAISE EXCEPTION 'invalid_video_quality'; END IF;
  IF _duration_seconds NOT IN (5, 8) THEN RAISE EXCEPTION 'invalid_video_duration'; END IF;

  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);
  IF _quality = 'fast' AND COALESCE(_ent.video_fast_allowed, false) = false THEN RAISE EXCEPTION 'video_fast_not_allowed'; END IF;
  IF _quality = 'quality' AND COALESCE(_ent.video_quality_allowed, false) = false THEN RAISE EXCEPTION 'video_quality_not_allowed'; END IF;
  IF _duration_seconds > COALESCE(_ent.max_video_duration_seconds, 5) THEN RAISE EXCEPTION 'video_duration_not_allowed'; END IF;

  _cap := COALESCE(_ent.daily_video_cap, 0);

  INSERT INTO public.daily_video_usage (user_id, day, video_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET video_count = public.daily_video_usage.video_count + 1,
        updated_at = now()
  RETURNING video_count INTO _new_count;

  IF _new_count > _cap THEN
    UPDATE public.daily_video_usage SET video_count = GREATEST(video_count - 1, 0), updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_credits_summary()
RETURNS TABLE(
  plan_credits integer,
  topup_credits integer,
  total_credits integer,
  cycle_ends_at timestamp with time zone,
  daily_text_used integer,
  daily_text_cap integer,
  daily_image_used integer,
  daily_image_cap integer,
  daily_video_used integer,
  daily_video_cap integer,
  plan public.user_plan,
  image_pro_allowed boolean,
  video_fast_allowed boolean,
  video_quality_allowed boolean,
  max_video_duration_seconds integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(uc.plan_credits, 0),
    COALESCE(uc.topup_credits, 0),
    COALESCE(uc.plan_credits, 0) + COALESCE(uc.topup_credits, 0),
    uc.cycle_ends_at,
    COALESCE(dtu.text_count, 0),
    COALESCE(pe.daily_text_cap, 10),
    COALESCE(dtu.image_count, 0),
    COALESCE(pe.daily_image_cap, 2),
    COALESCE(dvu.video_count, 0),
    COALESCE(pe.daily_video_cap, 0),
    COALESCE(p.plan, 'free'::public.user_plan),
    COALESCE(pe.image_pro_allowed, false),
    COALESCE(pe.video_fast_allowed, false),
    COALESCE(pe.video_quality_allowed, false),
    COALESCE(pe.max_video_duration_seconds, 5)
  FROM (SELECT _uid AS uid) base
  LEFT JOIN public.user_credits uc ON uc.user_id = base.uid
  LEFT JOIN public.profiles p ON p.id = base.uid
  LEFT JOIN public.plan_entitlements pe ON pe.plan = COALESCE(p.plan, 'free'::public.user_plan) AND pe.active = true
  LEFT JOIN public.daily_text_usage dtu ON dtu.user_id = base.uid AND dtu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date
  LEFT JOIN public.daily_video_usage dvu ON dvu.user_id = base.uid AND dvu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_monthly_credits(_user_id uuid, _plan public.user_plan)
RETURNS public.user_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _new_credits integer;
  _row public.user_credits;
  _old_plan_credits integer;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role) INTO _is_admin;
  IF NOT _is_admin AND auth.role() <> 'service_role' THEN RAISE EXCEPTION 'admin_only'; END IF;

  SELECT monthly_credits INTO _new_credits FROM public.plan_entitlements WHERE plan = _plan AND active = true;
  IF _new_credits IS NULL THEN SELECT monthly_credits INTO _new_credits FROM public.plan_credits WHERE plan = _plan; END IF;
  IF _new_credits IS NULL THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  PERFORM public._ensure_user_credits(_user_id);

  SELECT plan_credits INTO _old_plan_credits FROM public.user_credits WHERE user_id = _user_id FOR UPDATE;

  IF _old_plan_credits > 0 THEN
    INSERT INTO public.credit_ledger (user_id, txn_type, amount, source, balance_after_plan, balance_after_topup, metadata)
    SELECT _user_id, 'expire', -_old_plan_credits, 'plan', 0, topup_credits, jsonb_build_object('reason', 'monthly_reset')
    FROM public.user_credits WHERE user_id = _user_id;
  END IF;

  UPDATE public.user_credits
  SET plan_credits = _new_credits,
      cycle_started_at = now(),
      cycle_ends_at = now() + interval '30 days',
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING * INTO _row;

  INSERT INTO public.credit_ledger (user_id, txn_type, amount, source, balance_after_plan, balance_after_topup, metadata)
  VALUES (_user_id, 'plan_grant', _new_credits, 'plan', _row.plan_credits, _row.topup_credits, jsonb_build_object('plan', _plan, 'source', 'plan_entitlements'));

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.plan_entitlement_for_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_image_quota(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_video_daily_quota(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_credits_summary() TO authenticated;

-- ==========================================
-- Migration File: 20260425140333_8c401db1-537c-4e57-9091-c3ca62b42498.sql
-- ==========================================

CREATE TRIGGER trg_profiles_protect_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

CREATE TRIGGER trg_video_jobs_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

CREATE TRIGGER trg_subscription_requests_sync_profile_plan
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

CREATE TRIGGER trg_subscription_requests_reset_credits
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_video_jobs_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_plan_entitlements_updated_at
BEFORE UPDATE ON public.plan_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.video_jobs
ADD CONSTRAINT video_jobs_duration_seconds_valid
CHECK (duration_seconds IN (5, 8));

ALTER TABLE public.video_jobs
ADD CONSTRAINT video_jobs_aspect_ratio_valid
CHECK (aspect_ratio IN ('9:16', '1:1', '16:9'));

ALTER TABLE public.video_jobs
ADD CONSTRAINT video_jobs_credits_charged_positive
CHECK (credits_charged > 0);

-- ==========================================
-- Migration File: 20260425140700_707657cf-7029-46c7-ae18-94d7add096a6.sql
-- ==========================================

DROP TRIGGER IF EXISTS trg_profiles_protect_plan_change ON public.profiles;
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_subscription_requests_reset_credits ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_subscription_requests_sync_profile_plan ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_plan_entitlements_updated_at ON public.plan_entitlements;
DROP TRIGGER IF EXISTS trg_user_credits_updated_at ON public.user_credits;
DROP TRIGGER IF EXISTS trg_video_jobs_processing_limit ON public.video_jobs;
DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON public.video_jobs;

-- ==========================================
-- Migration File: 20260425141133_14785b5f-a086-426d-b716-de1c2a56bc79.sql
-- ==========================================

-- Ensure required operational triggers exist and stale duplicates are removed
DROP TRIGGER IF EXISTS trg_profiles_protect_plan_change ON public.profiles;
DROP TRIGGER IF EXISTS protect_profile_plan_change_trigger ON public.profiles;
CREATE TRIGGER trg_profiles_protect_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

DROP TRIGGER IF EXISTS trg_subscription_requests_sync_plan ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
CREATE TRIGGER trg_subscription_requests_sync_plan
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

DROP TRIGGER IF EXISTS trg_subscription_requests_reset_credits ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
CREATE TRIGGER trg_subscription_requests_reset_credits
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

DROP TRIGGER IF EXISTS trg_video_jobs_processing_limit ON public.video_jobs;
CREATE TRIGGER trg_video_jobs_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON public.video_jobs;
CREATE TRIGGER trg_video_jobs_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_subscription_requests_updated_at ON public.subscription_requests;
CREATE TRIGGER trg_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_daily_text_usage_updated_at ON public.daily_text_usage;
CREATE TRIGGER trg_daily_text_usage_updated_at
BEFORE UPDATE ON public.daily_text_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_daily_video_usage_updated_at ON public.daily_video_usage;
CREATE TRIGGER trg_daily_video_usage_updated_at
BEFORE UPDATE ON public.daily_video_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.video_jobs
  DROP CONSTRAINT IF EXISTS video_jobs_duration_seconds_allowed,
  ADD CONSTRAINT video_jobs_duration_seconds_allowed CHECK (duration_seconds IN (5, 8));

ALTER TABLE public.video_jobs
  DROP CONSTRAINT IF EXISTS video_jobs_aspect_ratio_allowed,
  ADD CONSTRAINT video_jobs_aspect_ratio_allowed CHECK (aspect_ratio IN ('16:9', '9:16', '1:1'));

-- Align initial signup grants with the free plan in plan_entitlements (free = 0 video credits)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _credits integer;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  IF LOWER(NEW.email) = 'saalla012@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  SELECT monthly_credits INTO _credits
  FROM public.plan_entitlements
  WHERE plan = 'free'::public.user_plan AND active = true;

  IF _credits IS NULL THEN _credits := 0; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  IF _credits > 0 THEN
    INSERT INTO public.credit_ledger (
      user_id, txn_type, amount, source,
      balance_after_plan, balance_after_topup, metadata
    ) VALUES (
      NEW.id, 'plan_grant', _credits, 'plan',
      _credits, 0,
      jsonb_build_object('reason','initial_signup','plan','free','credit_scope','video','source','plan_entitlements')
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_initial_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _credits integer;
BEGIN
  SELECT monthly_credits INTO _credits
  FROM public.plan_entitlements
  WHERE plan = COALESCE(NEW.plan, 'free'::public.user_plan) AND active = true;

  IF _credits IS NULL THEN _credits := 0; END IF;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (NEW.id, _credits, 0, now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  IF _credits > 0 THEN
    INSERT INTO public.credit_ledger (
      user_id, txn_type, amount, source,
      balance_after_plan, balance_after_topup, metadata
    ) VALUES (
      NEW.id, 'plan_grant', _credits, 'plan',
      _credits, 0,
      jsonb_build_object('reason', 'initial_signup', 'plan', NEW.plan, 'credit_scope', 'video', 'source', 'plan_entitlements')
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- ==========================================
-- Migration File: 20260425141510_f5a4ecf1-3a3b-4a0a-b3c6-c99838c57003.sql
-- ==========================================

DROP TRIGGER IF EXISTS trg_protect_profile_plan_change ON public.profiles;

DROP TRIGGER IF EXISTS trg_update_daily_text_usage_updated_at ON public.daily_text_usage;
DROP TRIGGER IF EXISTS trg_update_daily_video_usage_updated_at ON public.daily_video_usage;
DROP TRIGGER IF EXISTS trg_update_subscription_requests_updated_at ON public.subscription_requests;

DROP TRIGGER IF EXISTS trg_enforce_video_processing_limit ON public.video_jobs;
DROP TRIGGER IF EXISTS update_video_jobs_updated_at ON public.video_jobs;

-- ==========================================
-- Migration File: 20260425141838_90d4c0ab-43e4-4ff2-8453-03d0c8e9a997.sql
-- ==========================================

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_profiles_protect_plan_change ON public.profiles;
DROP TRIGGER IF EXISTS trg_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_subscription_requests_sync_profile_plan ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_subscription_requests_reset_credits ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON public.video_jobs;
DROP TRIGGER IF EXISTS trg_video_jobs_processing_limit ON public.video_jobs;
DROP TRIGGER IF EXISTS trg_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS trg_generations_integrity ON public.generations;
DROP TRIGGER IF EXISTS trg_generations_quota ON public.generations;
DROP TRIGGER IF EXISTS trg_topup_purchases_lock_package ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_topup_purchases_updated_at ON public.topup_purchases;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_profiles_protect_plan_change
BEFORE UPDATE OF plan ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

CREATE TRIGGER trg_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_subscription_requests_sync_profile_plan
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

CREATE TRIGGER trg_subscription_requests_reset_credits
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

CREATE TRIGGER trg_video_jobs_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_video_jobs_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

CREATE TRIGGER trg_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_generations_integrity
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

CREATE TRIGGER trg_generations_quota
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_quota();

CREATE TRIGGER trg_topup_purchases_lock_package
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

CREATE TRIGGER trg_topup_purchases_updated_at
BEFORE UPDATE ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- Migration File: 20260425142125_7e51da0b-29bf-489e-bdaa-03686b5909ef.sql
-- ==========================================

DROP TRIGGER IF EXISTS trg_update_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS trg_update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_subscription_requests_sync_plan ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_update_topup_purchases_updated_at ON public.topup_purchases;

-- ==========================================
-- Migration File: 20260425150911_2d0225e2-417e-40ba-afa5-90bc1622ff8e.sql
-- ==========================================

-- Reconnect operational triggers that already have vetted functions.
-- Scope: public schema only. No reserved auth/storage/realtime schema changes.

-- Timestamp triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_subscription_requests_updated_at ON public.subscription_requests;
CREATE TRIGGER trg_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_topup_purchases_updated_at ON public.topup_purchases;
CREATE TRIGGER trg_topup_purchases_updated_at
BEFORE UPDATE ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_campaign_packs_updated_at ON public.campaign_packs;
CREATE TRIGGER trg_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payment_settings_updated_at ON public.payment_settings;
CREATE TRIGGER trg_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_plan_credits_updated_at ON public.plan_credits;
CREATE TRIGGER trg_plan_credits_updated_at
BEFORE UPDATE ON public.plan_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_plan_entitlements_updated_at ON public.plan_entitlements;
CREATE TRIGGER trg_plan_entitlements_updated_at
BEFORE UPDATE ON public.plan_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_plan_limits_updated_at ON public.plan_limits;
CREATE TRIGGER trg_plan_limits_updated_at
BEFORE UPDATE ON public.plan_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_email_send_state_updated_at ON public.email_send_state;
CREATE TRIGGER trg_email_send_state_updated_at
BEFORE UPDATE ON public.email_send_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_dlq_alert_state_updated_at ON public.dlq_alert_state;
CREATE TRIGGER trg_dlq_alert_state_updated_at
BEFORE UPDATE ON public.dlq_alert_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_stale_subs_alert_state_updated_at ON public.stale_subs_alert_state;
CREATE TRIGGER trg_stale_subs_alert_state_updated_at
BEFORE UPDATE ON public.stale_subs_alert_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Security and business invariants
DROP TRIGGER IF EXISTS trg_protect_profile_plan_change ON public.profiles;
CREATE TRIGGER trg_protect_profile_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;
CREATE TRIGGER trg_lock_topup_from_package
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
CREATE TRIGGER trg_enforce_generation_integrity
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

-- Keep legacy monthly generation quota disconnected from direct inserts.
-- Modern quotas are consumed explicitly by server functions before record_generation.
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;

DROP TRIGGER IF EXISTS trg_enforce_video_processing_limit ON public.video_jobs;
CREATE TRIGGER trg_enforce_video_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

-- Subscription activation automation
DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
CREATE TRIGGER trg_sync_profile_plan_on_activation
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
WHEN (NEW.status = 'activated'::public.subscription_request_status AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
CREATE TRIGGER trg_reset_credits_on_plan_change
AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW
WHEN (NEW.status = 'activated'::public.subscription_request_status AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.reset_credits_on_plan_change();

DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;
CREATE TRIGGER trg_notify_admin_on_subscription_request
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();

-- ==========================================
-- Migration File: 20260425151050_7b05b271-2600-4278-868f-513edaa0237a.sql
-- ==========================================

-- Normalize public triggers after reconnecting operational automation.
-- Keep one canonical trigger per invariant and remove old duplicate names.

-- Remove legacy monthly generation quota trigger variants.
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;
DROP TRIGGER IF EXISTS trg_generations_quota ON public.generations;

-- Remove duplicate generation integrity variant; keep trg_enforce_generation_integrity.
DROP TRIGGER IF EXISTS trg_generations_integrity ON public.generations;

-- Remove duplicate profile plan guard variant; keep trg_protect_profile_plan_change.
DROP TRIGGER IF EXISTS trg_profiles_protect_plan_change ON public.profiles;

-- Remove duplicate updated_at trigger variants where canonical trg_<table>_updated_at exists.
DROP TRIGGER IF EXISTS trg_update_app_settings_updated_at ON public.app_settings;
DROP TRIGGER IF EXISTS trg_update_payment_settings_updated_at ON public.payment_settings;
DROP TRIGGER IF EXISTS trg_update_plan_credits_updated_at ON public.plan_credits;
DROP TRIGGER IF EXISTS trg_update_plan_entitlements_updated_at ON public.plan_entitlements;
DROP TRIGGER IF EXISTS trg_update_plan_limits_updated_at ON public.plan_limits;
DROP TRIGGER IF EXISTS trg_update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON public.video_jobs;
DROP TRIGGER IF EXISTS trg_update_video_jobs_updated_at ON public.video_jobs;

-- Keep existing distinct table triggers that do not overlap with the newly canonical ones.
-- Examples: contact_submissions, daily_text_usage, daily_video_usage may already use older names and are left intact unless duplicated later.

-- ==========================================
-- Migration File: 20260425151219_4e0deba8-d29d-4437-bdbb-20e613bf02bc.sql
-- ==========================================

-- Final trigger normalization for duplicated legacy trigger names.

-- Subscription activation: keep canonical guarded triggers only.
DROP TRIGGER IF EXISTS trg_subscription_requests_reset_credits ON public.subscription_requests;
DROP TRIGGER IF EXISTS trg_subscription_requests_sync_profile_plan ON public.subscription_requests;

-- Top-up package lock: keep trg_lock_topup_from_package only.
DROP TRIGGER IF EXISTS trg_topup_purchases_lock_package ON public.topup_purchases;

-- Video processing concurrency: keep trg_enforce_video_processing_limit only.
DROP TRIGGER IF EXISTS trg_video_jobs_processing_limit ON public.video_jobs;

-- Ensure video_jobs updated_at is maintained once.
DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON public.video_jobs;
CREATE TRIGGER trg_video_jobs_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- Migration File: 20260425151519_c3a96ea2-2097-4554-9be2-d79aa408473e.sql
-- ==========================================

DROP TRIGGER IF EXISTS update_dlq_alert_state_updated_at ON public.dlq_alert_state;
DROP TRIGGER IF EXISTS update_email_send_state_updated_at ON public.email_send_state;
DROP TRIGGER IF EXISTS update_stale_subs_alert_state_updated_at ON public.stale_subs_alert_state;

-- ==========================================
-- Migration File: 20260425185445_9ca2f84c-57e7-4198-8aab-5fb026c8979d.sql
-- ==========================================

-- P0 hardening: video constraints, plan protection, operational switches, receipt OCR tracking

-- 1) Ensure video jobs cannot store unsupported quality/duration/aspect values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'video_jobs_duration_seconds_allowed'
      AND conrelid = 'public.video_jobs'::regclass
  ) THEN
    ALTER TABLE public.video_jobs
      ADD CONSTRAINT video_jobs_duration_seconds_allowed
      CHECK (duration_seconds IN (5, 8));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'video_jobs_aspect_ratio_allowed'
      AND conrelid = 'public.video_jobs'::regclass
  ) THEN
    ALTER TABLE public.video_jobs
      ADD CONSTRAINT video_jobs_aspect_ratio_allowed
      CHECK (aspect_ratio IN ('9:16', '1:1', '16:9'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'video_jobs_provider_required'
      AND conrelid = 'public.video_jobs'::regclass
  ) THEN
    ALTER TABLE public.video_jobs
      ADD CONSTRAINT video_jobs_provider_required
      CHECK (char_length(provider) BETWEEN 2 AND 64);
  END IF;
END $$;

-- 2) Protect profile plan changes at database level.
CREATE OR REPLACE FUNCTION public.protect_profile_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'plan_change_not_allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_plan_change ON public.profiles;
CREATE TRIGGER trg_protect_profile_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

-- 3) Keep at most two processing video jobs per user.
CREATE OR REPLACE FUNCTION public.enforce_video_processing_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _processing_count integer;
BEGIN
  IF NEW.status = 'processing'::public.video_job_status THEN
    PERFORM pg_advisory_xact_lock(hashtext('video_processing_' || NEW.user_id::text));

    SELECT count(*) INTO _processing_count
    FROM public.video_jobs
    WHERE user_id = NEW.user_id
      AND status = 'processing'::public.video_job_status
      AND id IS DISTINCT FROM NEW.id;

    IF _processing_count >= 2 THEN
      RAISE EXCEPTION 'too_many_processing_video_jobs';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_video_processing_limit ON public.video_jobs;
CREATE TRIGGER trg_enforce_video_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

-- 4) Remove obsolete monthly generation quota trigger if it exists; daily quotas are the active guard.
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;

-- 5) Central operational switches for fast financial risk control.
CREATE TABLE IF NOT EXISTS public.operational_switches (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  reason text,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_switches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view operational switches" ON public.operational_switches;
CREATE POLICY "Admins can view operational switches"
ON public.operational_switches
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage operational switches" ON public.operational_switches;
CREATE POLICY "Admins can manage operational switches"
ON public.operational_switches
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_update_operational_switches_updated_at ON public.operational_switches;
CREATE TRIGGER trg_update_operational_switches_updated_at
BEFORE UPDATE ON public.operational_switches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.operational_switches (key, enabled, reason)
VALUES
  ('video_enabled', true, 'يسمح بتوليد الفيديو عموماً'),
  ('video_quality_enabled', true, 'يسمح بجودة الفيديو الأعلى عند توفرها في الباقة'),
  ('image_pro_enabled', true, 'يسمح بصور Pro عند توفرها في الباقة'),
  ('ocr_receipt_enabled', true, 'يسمح بتحليل إيصالات الدفع آلياً')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.operational_switch_enabled(_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT enabled FROM public.operational_switches WHERE key = _key), true)
$$;

-- 6) Receipt OCR idempotency tracking.
ALTER TABLE public.subscription_requests
  ADD COLUMN IF NOT EXISTS ocr_processed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ocr_receipt_path text,
  ADD COLUMN IF NOT EXISTS ocr_status text,
  ADD COLUMN IF NOT EXISTS ocr_error text;

-- 7) Storage policies for payment receipts: owner folder isolation + admin visibility.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own payment receipts" ON storage.objects;
CREATE POLICY "Users can upload own payment receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own payment receipts" ON storage.objects;
CREATE POLICY "Users can update own payment receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can view own payment receipts" ON storage.objects;
CREATE POLICY "Users can view own payment receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Admins can view payment receipts" ON storage.objects;
CREATE POLICY "Admins can view payment receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- ==========================================
-- Migration File: 20260425185514_30623079-4209-47ef-a272-eaaa3fb4d0bf.sql
-- ==========================================

-- Add idempotent daily image quota release for technical failures.
CREATE OR REPLACE FUNCTION public.release_image_daily_quota(_user_id uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _uid uuid := COALESCE(_user_id, auth.uid());
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF auth.role() <> 'service_role'
     AND _uid IS DISTINCT FROM _caller
     AND NOT public.has_role(_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden_not_owner';
  END IF;

  UPDATE public.daily_text_usage
  SET image_count = GREATEST(image_count - 1, 0), updated_at = now()
  WHERE user_id = _uid AND day = _today AND image_count > 0;
END;
$$;

-- ==========================================
-- Migration File: 20260425190921_28a5c5c7-7175-4483-8d05-0dd37dbfe6ed.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS public.video_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  display_name_admin text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  public_enabled boolean NOT NULL DEFAULT false,
  supported_qualities text[] NOT NULL DEFAULT ARRAY[]::text[],
  priority integer NOT NULL DEFAULT 100,
  cost_5s integer NOT NULL DEFAULT 0,
  cost_8s integer NOT NULL DEFAULT 0,
  supports_9_16 boolean NOT NULL DEFAULT true,
  supports_1_1 boolean NOT NULL DEFAULT true,
  supports_16_9 boolean NOT NULL DEFAULT true,
  supports_starting_frame boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'api',
  health_status text NOT NULL DEFAULT 'inactive',
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_provider_configs_provider_key_check CHECK (provider_key ~ '^[a-z0-9_\-]+$'),
  CONSTRAINT video_provider_configs_supported_qualities_check CHECK (supported_qualities <@ ARRAY['fast','balanced','quality']::text[]),
  CONSTRAINT video_provider_configs_mode_check CHECK (mode IN ('api','bridge','manual')),
  CONSTRAINT video_provider_configs_health_status_check CHECK (health_status IN ('active','inactive','testing','manual_required','unhealthy')),
  CONSTRAINT video_provider_configs_costs_check CHECK (cost_5s >= 0 AND cost_8s >= 0),
  CONSTRAINT video_provider_configs_priority_check CHECK (priority >= 1 AND priority <= 1000)
);

ALTER TABLE public.video_provider_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view video provider configs" ON public.video_provider_configs;
CREATE POLICY "Admins can view video provider configs"
ON public.video_provider_configs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage video provider configs" ON public.video_provider_configs;
CREATE POLICY "Admins can manage video provider configs"
ON public.video_provider_configs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_video_provider_configs_updated_at ON public.video_provider_configs;
CREATE TRIGGER update_video_provider_configs_updated_at
BEFORE UPDATE ON public.video_provider_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_video_provider_configs_routing
ON public.video_provider_configs (enabled, public_enabled, priority);

INSERT INTO public.video_provider_configs (
  provider_key, display_name_admin, enabled, public_enabled, supported_qualities,
  priority, cost_5s, cost_8s, supports_9_16, supports_1_1, supports_16_9,
  supports_starting_frame, mode, health_status, metadata
) VALUES
  ('replicate', 'Replicate / Google Veo via Replicate', true, true, ARRAY['fast','quality']::text[], 10, 150, 240, true, true, true, true, 'api', 'active', '{"role":"primary_existing_provider"}'::jsonb),
  ('google_flow_bridge', 'Google Flow Bridge (Manual)', false, false, ARRAY['quality']::text[], 20, 450, 900, true, true, true, true, 'manual', 'manual_required', '{"role":"manual_bridge_placeholder"}'::jsonb),
  ('google_veo_api', 'Google Veo API Official', false, false, ARRAY['fast','quality']::text[], 30, 150, 900, true, true, true, true, 'api', 'inactive', '{"role":"future_api_provider"}'::jsonb),
  ('runway', 'Runway API', false, false, ARRAY['quality']::text[], 40, 450, 900, true, true, true, true, 'api', 'inactive', '{"role":"future_api_provider"}'::jsonb),
  ('luma', 'Luma API', false, false, ARRAY['fast','quality']::text[], 50, 240, 900, true, true, true, true, 'api', 'inactive', '{"role":"future_api_provider"}'::jsonb),
  ('kling', 'Kling API', false, false, ARRAY['quality']::text[], 60, 450, 900, true, true, true, true, 'api', 'inactive', '{"role":"future_api_provider"}'::jsonb)
ON CONFLICT (provider_key) DO UPDATE SET
  display_name_admin = EXCLUDED.display_name_admin,
  supported_qualities = EXCLUDED.supported_qualities,
  priority = EXCLUDED.priority,
  cost_5s = EXCLUDED.cost_5s,
  cost_8s = EXCLUDED.cost_8s,
  supports_9_16 = EXCLUDED.supports_9_16,
  supports_1_1 = EXCLUDED.supports_1_1,
  supports_16_9 = EXCLUDED.supports_16_9,
  supports_starting_frame = EXCLUDED.supports_starting_frame,
  mode = EXCLUDED.mode,
  metadata = public.video_provider_configs.metadata || EXCLUDED.metadata,
  updated_at = now();

-- ==========================================
-- Migration File: 20260426102210_c7fc1b1b-6df7-48e4-8306-d7ac98d59c76.sql
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'video_quality' AND e.enumlabel = 'lite'
  ) THEN
    ALTER TYPE public.video_quality ADD VALUE 'lite';
  END IF;
END $$;

ALTER TABLE public.video_jobs
  ADD COLUMN IF NOT EXISTS speaker_image_url text,
  ADD COLUMN IF NOT EXISTS product_image_url text,
  ADD COLUMN IF NOT EXISTS selected_persona_id text;

ALTER TABLE public.video_provider_configs
  DROP CONSTRAINT IF EXISTS video_provider_configs_supported_qualities_check;

ALTER TABLE public.video_provider_configs
  ADD CONSTRAINT video_provider_configs_supported_qualities_check
  CHECK (supported_qualities <@ ARRAY['fast','lite','balanced','quality']::text[]);

UPDATE public.plan_entitlements
SET
  monthly_credits = CASE plan
    WHEN 'free' THEN 150
    WHEN 'starter' THEN 2000
    WHEN 'growth' THEN 6000
    WHEN 'pro' THEN 14000
    WHEN 'business' THEN 40000
    ELSE monthly_credits
  END,
  video_fast_allowed = true,
  video_quality_allowed = CASE WHEN plan IN ('pro','business') THEN true ELSE false END,
  max_video_duration_seconds = CASE WHEN plan = 'free' THEN 5 ELSE 8 END,
  daily_video_cap = CASE plan
    WHEN 'free' THEN 999
    WHEN 'starter' THEN 999
    WHEN 'growth' THEN 999
    WHEN 'pro' THEN 999
    WHEN 'business' THEN 999
    ELSE daily_video_cap
  END,
  updated_at = now()
WHERE plan IN ('free','starter','growth','pro','business');

UPDATE public.plan_credits
SET
  monthly_credits = CASE plan
    WHEN 'free' THEN 150
    WHEN 'starter' THEN 2000
    WHEN 'growth' THEN 6000
    WHEN 'pro' THEN 14000
    WHEN 'business' THEN 40000
    ELSE monthly_credits
  END,
  updated_at = now()
WHERE plan IN ('free','starter','growth','pro','business');

INSERT INTO public.video_provider_configs (
  provider_key, display_name_admin, enabled, public_enabled, supported_qualities,
  priority, cost_5s, cost_8s, supports_9_16, supports_1_1, supports_16_9,
  supports_starting_frame, mode, health_status, metadata
) VALUES
  ('fal_ai', 'fal.ai / Google Veo primary', true, true, ARRAY['fast','lite','quality']::text[], 1, 150, 1600, true, true, true, true, 'api', 'active', '{"role":"primary_video_provider","supports_two_images":true,"supports_saudi_personas":true,"supports_audio_prompt":true}'::jsonb)
ON CONFLICT (provider_key) DO UPDATE SET
  display_name_admin = EXCLUDED.display_name_admin,
  enabled = EXCLUDED.enabled,
  public_enabled = EXCLUDED.public_enabled,
  supported_qualities = EXCLUDED.supported_qualities,
  priority = EXCLUDED.priority,
  cost_5s = EXCLUDED.cost_5s,
  cost_8s = EXCLUDED.cost_8s,
  supports_starting_frame = EXCLUDED.supports_starting_frame,
  mode = EXCLUDED.mode,
  health_status = CASE WHEN public.video_provider_configs.health_status = 'unhealthy' THEN 'testing' ELSE EXCLUDED.health_status END,
  metadata = public.video_provider_configs.metadata || EXCLUDED.metadata,
  updated_at = now();

UPDATE public.video_provider_configs
SET
  priority = 20,
  supported_qualities = ARRAY['fast','lite','quality']::text[],
  cost_5s = 150,
  cost_8s = 1600,
  metadata = metadata || '{"role":"backup_video_provider","supports_two_images":false}'::jsonb,
  updated_at = now()
WHERE provider_key = 'replicate';

-- ==========================================
-- Migration File: 20260426103449_2f66bf1c-937d-45a7-a9e2-ab37b2bebcf4.sql
-- ==========================================

DROP FUNCTION IF EXISTS public.consume_video_daily_quota(text, integer);
DROP FUNCTION IF EXISTS public.release_video_daily_quota(uuid);
DROP FUNCTION IF EXISTS public.video_daily_cap_for_plan(public.user_plan);

UPDATE public.plan_entitlements
SET daily_video_cap = 0,
    updated_at = now()
WHERE daily_video_cap IS DISTINCT FROM 0;

CREATE OR REPLACE FUNCTION public.get_user_credits_summary()
RETURNS TABLE(
  plan_credits integer,
  topup_credits integer,
  total_credits integer,
  cycle_ends_at timestamp with time zone,
  daily_text_used integer,
  daily_text_cap integer,
  daily_image_used integer,
  daily_image_cap integer,
  daily_video_used integer,
  daily_video_cap integer,
  plan public.user_plan,
  image_pro_allowed boolean,
  video_fast_allowed boolean,
  video_quality_allowed boolean,
  max_video_duration_seconds integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(uc.plan_credits, 0),
    COALESCE(uc.topup_credits, 0),
    COALESCE(uc.plan_credits, 0) + COALESCE(uc.topup_credits, 0),
    uc.cycle_ends_at,
    COALESCE(dtu.text_count, 0),
    COALESCE(pe.daily_text_cap, 10),
    COALESCE(dtu.image_count, 0),
    COALESCE(pe.daily_image_cap, 2),
    0::integer,
    0::integer,
    COALESCE(p.plan, 'free'::public.user_plan),
    COALESCE(pe.image_pro_allowed, false),
    COALESCE(pe.video_fast_allowed, false),
    COALESCE(pe.video_quality_allowed, false),
    COALESCE(pe.max_video_duration_seconds, 5)
  FROM (SELECT _uid AS uid) base
  LEFT JOIN public.user_credits uc ON uc.user_id = base.uid
  LEFT JOIN public.profiles p ON p.id = base.uid
  LEFT JOIN public.plan_entitlements pe ON pe.plan = COALESCE(p.plan, 'free'::public.user_plan) AND pe.active = true
  LEFT JOIN public.daily_text_usage dtu ON dtu.user_id = base.uid AND dtu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date;
END;
$$;

-- ==========================================
-- Migration File: 20260426105201_5e1c7524-4ada-4912-82ac-ab9e70905513.sql
-- ==========================================

DROP FUNCTION IF EXISTS public.get_user_credits_summary();

CREATE OR REPLACE FUNCTION public.get_user_credits_summary()
RETURNS TABLE(
  plan_credits integer,
  topup_credits integer,
  total_credits integer,
  cycle_ends_at timestamp with time zone,
  daily_text_used integer,
  daily_text_cap integer,
  daily_image_used integer,
  daily_image_cap integer,
  plan public.user_plan,
  image_pro_allowed boolean,
  video_fast_allowed boolean,
  video_quality_allowed boolean,
  max_video_duration_seconds integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(uc.plan_credits, 0),
    COALESCE(uc.topup_credits, 0),
    COALESCE(uc.plan_credits, 0) + COALESCE(uc.topup_credits, 0),
    uc.cycle_ends_at,
    COALESCE(dtu.text_count, 0),
    COALESCE(pe.daily_text_cap, 10),
    COALESCE(dtu.image_count, 0),
    COALESCE(pe.daily_image_cap, 2),
    COALESCE(p.plan, 'free'::public.user_plan),
    COALESCE(pe.image_pro_allowed, false),
    COALESCE(pe.video_fast_allowed, false),
    COALESCE(pe.video_quality_allowed, false),
    COALESCE(pe.max_video_duration_seconds, 5)
  FROM (SELECT _uid AS uid) base
  LEFT JOIN public.user_credits uc ON uc.user_id = base.uid
  LEFT JOIN public.profiles p ON p.id = base.uid
  LEFT JOIN public.plan_entitlements pe ON pe.plan = COALESCE(p.plan, 'free'::public.user_plan) AND pe.active = true
  LEFT JOIN public.daily_text_usage dtu ON dtu.user_id = base.uid AND dtu.day = (now() AT TIME ZONE 'Asia/Riyadh')::date;
END;
$$;

DROP TABLE IF EXISTS public.daily_video_usage;

ALTER TABLE public.plan_entitlements
  DROP COLUMN IF EXISTS daily_video_cap;

-- ==========================================
-- Migration File: 20260426211119_5d33d812-05db-4edd-922c-17512002eba4.sql
-- ==========================================

-- Align video provider runtime configuration with the approved PixVerse v6 strategy.
UPDATE public.video_provider_configs
SET
  enabled = true,
  public_enabled = true,
  mode = 'api',
  health_status = CASE WHEN health_status = 'unhealthy' THEN 'testing' ELSE health_status END,
  priority = 1,
  metadata = COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'role', 'primary_video_provider',
      'model_family', 'pixverse_v6',
      'legacy_cleaned_at', now(),
      'supports_product_reference', true,
      'supports_saudi_personas', true,
      'supports_audio_prompt', true
    ),
  updated_at = now()
WHERE provider_key = 'fal_ai';

UPDATE public.video_provider_configs
SET
  enabled = false,
  public_enabled = false,
  health_status = 'inactive',
  priority = CASE provider_key
    WHEN 'replicate' THEN 90
    WHEN 'google_flow_bridge' THEN 91
    WHEN 'google_veo_api' THEN 92
    ELSE priority
  END,
  metadata = COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'role', 'retired_legacy_provider',
      'retired_at', now(),
      'retired_reason', 'V2.1 standardizes production video generation on PixVerse v6 via fal.ai'
    ),
  updated_at = now()
WHERE provider_key IN ('replicate', 'google_flow_bridge', 'google_veo_api');

ALTER TABLE public.video_jobs
ALTER COLUMN provider SET DEFAULT 'router';

-- ==========================================
-- Migration File: 20260427102516_d4e909c3-5b9b-4004-977c-0f102aa65272.sql
-- ==========================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-videos',
  'generated-videos',
  false,
  104857600,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime'];

CREATE POLICY "Users can read own generated videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can read generated videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-videos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Service role manages generated videos"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'generated-videos')
WITH CHECK (bucket_id = 'generated-videos');

-- ==========================================
-- Migration File: 20260427103440_6c406a57-3043-4bd0-92c3-ca329769f7f3.sql
-- ==========================================

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION public.get_founding_status() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_app_settings() TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_topup_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_usage(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(integer, public.credit_txn_type, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_image_quota(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_text_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_credits_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.operational_switch_enabled(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_entitlement_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_usage_logs(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_generation(public.generation_type, text, text, text, text, integer, integer, integer, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_image_daily_quota(uuid) TO authenticated;

-- ==========================================
-- Migration File: 20260427163451_5971f934-822c-472e-b3d0-8976ccd27ccc.sql
-- ==========================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_protect_profile_plan_change ON public.profiles;
CREATE TRIGGER trg_protect_profile_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_plan_change();

DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
CREATE TRIGGER update_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_reset_credits_on_plan_change ON public.subscription_requests;
CREATE TRIGGER trg_reset_credits_on_plan_change
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.reset_credits_on_plan_change();

DROP TRIGGER IF EXISTS trg_sync_profile_plan_on_activation ON public.subscription_requests;
CREATE TRIGGER trg_sync_profile_plan_on_activation
AFTER UPDATE ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_on_activation();

DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;
CREATE TRIGGER trg_notify_admin_on_subscription_request
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();

DROP TRIGGER IF EXISTS update_contact_submissions_updated_at ON public.contact_submissions;
CREATE TRIGGER update_contact_submissions_updated_at
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;
CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_plan_credits_updated_at ON public.plan_credits;
CREATE TRIGGER update_plan_credits_updated_at
BEFORE UPDATE ON public.plan_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_settings_updated_at ON public.payment_settings;
CREATE TRIGGER update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_topup_packages_updated_at ON public.topup_packages;
CREATE TRIGGER update_topup_packages_updated_at
BEFORE UPDATE ON public.topup_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_topup_purchases_updated_at ON public.topup_purchases;
CREATE TRIGGER update_topup_purchases_updated_at
BEFORE UPDATE ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_lock_topup_from_package ON public.topup_purchases;
CREATE TRIGGER trg_lock_topup_from_package
BEFORE INSERT ON public.topup_purchases
FOR EACH ROW
EXECUTE FUNCTION public.lock_topup_from_package();

DROP TRIGGER IF EXISTS update_campaign_packs_updated_at ON public.campaign_packs;
CREATE TRIGGER update_campaign_packs_updated_at
BEFORE UPDATE ON public.campaign_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_video_jobs_updated_at ON public.video_jobs;
CREATE TRIGGER update_video_jobs_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_enforce_video_processing_limit ON public.video_jobs;
CREATE TRIGGER trg_enforce_video_processing_limit
BEFORE INSERT OR UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_video_processing_limit();

DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
CREATE TRIGGER trg_enforce_generation_integrity
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

DROP TRIGGER IF EXISTS update_email_send_state_updated_at ON public.email_send_state;
CREATE TRIGGER update_email_send_state_updated_at
BEFORE UPDATE ON public.email_send_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_dlq_alert_state_updated_at ON public.dlq_alert_state;
CREATE TRIGGER update_dlq_alert_state_updated_at
BEFORE UPDATE ON public.dlq_alert_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_stale_subs_alert_state_updated_at ON public.stale_subs_alert_state;
CREATE TRIGGER update_stale_subs_alert_state_updated_at
BEFORE UPDATE ON public.stale_subs_alert_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_video_provider_configs_updated_at ON public.video_provider_configs;
CREATE TRIGGER update_video_provider_configs_updated_at
BEFORE UPDATE ON public.video_provider_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- Migration File: 20260427163525_a307779c-4987-40c3-9690-5f8f62c2bdf6.sql
-- ==========================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_subscription_requests_updated_at ON public.subscription_requests;
DROP TRIGGER IF EXISTS update_contact_submissions_updated_at ON public.contact_submissions;
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;
DROP TRIGGER IF EXISTS update_plan_credits_updated_at ON public.plan_credits;
DROP TRIGGER IF EXISTS update_payment_settings_updated_at ON public.payment_settings;
DROP TRIGGER IF EXISTS update_topup_packages_updated_at ON public.topup_packages;
DROP TRIGGER IF EXISTS update_topup_purchases_updated_at ON public.topup_purchases;
DROP TRIGGER IF EXISTS update_campaign_packs_updated_at ON public.campaign_packs;
DROP TRIGGER IF EXISTS update_video_jobs_updated_at ON public.video_jobs;
DROP TRIGGER IF EXISTS update_email_send_state_updated_at ON public.email_send_state;
DROP TRIGGER IF EXISTS update_dlq_alert_state_updated_at ON public.dlq_alert_state;
DROP TRIGGER IF EXISTS update_stale_subs_alert_state_updated_at ON public.stale_subs_alert_state;

-- ==========================================
-- Migration File: 20260427163604_a5fd74bb-ee55-48b9-915c-8ed42d0463fc.sql
-- ==========================================

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_plan_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_credits_on_plan_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_plan_on_activation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_on_subscription_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_topup_from_package() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_video_processing_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_generation_integrity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ==========================================
-- Migration File: 20260427164314_321a2021-30b2-4575-983f-c342c8e9eb4c.sql
-- ==========================================

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_founding_status() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_app_settings() TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_credits_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_entitlement_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.operational_switch_enabled(text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.consume_text_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_image_quota(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_image_daily_quota(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(integer, public.credit_txn_type, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_generation(public.generation_type, text, text, text, text, integer, integer, integer, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_usage(text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.activate_topup_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_usage_logs(text) TO authenticated;

GRANT EXECUTE ON FUNCTION public._ensure_user_credits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_demo_token(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_email_dlq_health() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_stale_subscription_requests() TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_monthly_credits(uuid, public.user_plan) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.operational_switch_enabled(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.plan_entitlement_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_plan_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_credits_on_plan_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_profile_plan_on_activation() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_admin_on_subscription_request() TO service_role;
GRANT EXECUTE ON FUNCTION public.lock_topup_from_package() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_video_processing_limit() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_generation_integrity() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_generation_quota() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_initial_credits() TO service_role;

-- ==========================================
-- Migration File: 20260428163132_1eca145e-6841-4366-ab31-273fd80336b4.sql
-- ==========================================

-- Normalize existing WhatsApp numbers to a single canonical format where possible
UPDATE public.profiles
SET whatsapp = CASE
  WHEN whatsapp IS NULL OR btrim(whatsapp) = '' THEN NULL
  ELSE regexp_replace(whatsapp, '[^0-9]', '', 'g')
END;

UPDATE public.profiles
SET whatsapp = CASE
  WHEN whatsapp LIKE '00966%' THEN '966' || substring(whatsapp from 6)
  WHEN whatsapp LIKE '05%' THEN '966' || substring(whatsapp from 2)
  WHEN whatsapp LIKE '5%' AND length(whatsapp) = 9 THEN '966' || whatsapp
  ELSE whatsapp
END
WHERE whatsapp IS NOT NULL;

-- Remove invalid Saudi mobile numbers before enforcing the rule
UPDATE public.profiles
SET whatsapp = NULL
WHERE whatsapp IS NOT NULL
  AND whatsapp !~ '^9665[0-9]{8}$';

-- Existing duplicate cleanup: keep the first profile record and clear the later duplicates
WITH ranked AS (
  SELECT
    id,
    whatsapp,
    row_number() OVER (PARTITION BY whatsapp ORDER BY created_at ASC, id ASC) AS duplicate_rank
  FROM public.profiles
  WHERE whatsapp IS NOT NULL
)
UPDATE public.profiles AS p
SET whatsapp = NULL
FROM ranked AS r
WHERE p.id = r.id
  AND r.duplicate_rank > 1;

-- Canonicalize and validate WhatsApp before every profile save
CREATE OR REPLACE FUNCTION public.normalize_profile_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF NEW.whatsapp IS NULL OR btrim(NEW.whatsapp) = '' THEN
    NEW.whatsapp := NULL;
    RETURN NEW;
  END IF;

  digits := regexp_replace(NEW.whatsapp, '[^0-9]', '', 'g');

  IF digits LIKE '00966%' THEN
    digits := '966' || substring(digits from 6);
  ELSIF digits LIKE '05%' THEN
    digits := '966' || substring(digits from 2);
  ELSIF digits LIKE '5%' AND length(digits) = 9 THEN
    digits := '966' || digits;
  END IF;

  IF digits !~ '^9665[0-9]{8}$' THEN
    RAISE EXCEPTION 'INVALID_SAUDI_WHATSAPP';
  END IF;

  NEW.whatsapp := digits;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_profile_whatsapp_before_save ON public.profiles;
CREATE TRIGGER normalize_profile_whatsapp_before_save
BEFORE INSERT OR UPDATE OF whatsapp ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.normalize_profile_whatsapp();

-- Enforce one WhatsApp number per account after cleanup
CREATE UNIQUE INDEX IF NOT EXISTS profiles_whatsapp_unique_idx
ON public.profiles (whatsapp)
WHERE whatsapp IS NOT NULL;

-- ==========================================
-- Migration File: 20260429094423_10c92655-db8d-4ff4-a086-1979c870156e.sql
-- ==========================================

ALTER TABLE public.campaign_packs
ADD COLUMN IF NOT EXISTS product_image_path text;

DROP POLICY IF EXISTS "Users can create own campaign packs" ON public.campaign_packs;
DROP POLICY IF EXISTS "Users can update own campaign packs" ON public.campaign_packs;

CREATE POLICY "Users can create own campaign packs"
ON public.campaign_packs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = ANY (ARRAY['draft'::text, 'generated'::text, 'archived'::text])
  AND goal = ANY (ARRAY['launch'::text, 'clearance'::text, 'upsell'::text, 'leads'::text, 'competitive'::text, 'winback'::text])
  AND channel = ANY (ARRAY['instagram'::text, 'snapchat'::text, 'tiktok'::text, 'whatsapp'::text])
  AND char_length(product) <= 500
  AND char_length(audience) <= 500
  AND char_length(offer) <= 500
  AND char_length(brief) <= 5000
  AND char_length(text_prompt) <= 5000
  AND char_length(image_prompt) <= 3000
  AND char_length(video_prompt) <= 3000
  AND (product_image_path IS NULL OR char_length(product_image_path) <= 1000)
);

CREATE POLICY "Users can update own campaign packs"
ON public.campaign_packs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status = ANY (ARRAY['draft'::text, 'generated'::text, 'archived'::text])
  AND goal = ANY (ARRAY['launch'::text, 'clearance'::text, 'upsell'::text, 'leads'::text, 'competitive'::text, 'winback'::text])
  AND channel = ANY (ARRAY['instagram'::text, 'snapchat'::text, 'tiktok'::text, 'whatsapp'::text])
  AND char_length(product) <= 500
  AND char_length(audience) <= 500
  AND char_length(offer) <= 500
  AND char_length(brief) <= 5000
  AND char_length(text_prompt) <= 5000
  AND char_length(image_prompt) <= 3000
  AND char_length(video_prompt) <= 3000
  AND (product_image_path IS NULL OR char_length(product_image_path) <= 1000)
);

-- ==========================================
-- Migration File: 20260429094811_cfc86545-b2c0-4bc3-b5e5-a55eb1b4620d.sql
-- ==========================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-product-images', 'campaign-product-images', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can view own campaign product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own campaign product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own campaign product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own campaign product images" ON storage.objects;

CREATE POLICY "Users can view own campaign product images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'campaign-product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload own campaign product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'campaign-product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own campaign product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'campaign-product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'campaign-product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own campaign product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'campaign-product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ==========================================
-- Migration File: 20260429114957_f09b1d57-5eab-4891-a0f6-bc6e105cc569.sql
-- ==========================================

ALTER TABLE public.campaign_packs
ADD COLUMN IF NOT EXISTS ab_variants jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS publishing_calendar jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP POLICY IF EXISTS "Users can create own campaign packs" ON public.campaign_packs;
DROP POLICY IF EXISTS "Users can update own campaign packs" ON public.campaign_packs;

CREATE POLICY "Users can create own campaign packs"
ON public.campaign_packs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = ANY (ARRAY['draft'::text, 'generated'::text, 'archived'::text])
  AND goal = ANY (ARRAY['launch'::text, 'clearance'::text, 'upsell'::text, 'leads'::text, 'competitive'::text, 'winback'::text])
  AND channel = ANY (ARRAY['instagram'::text, 'snapchat'::text, 'tiktok'::text, 'whatsapp'::text])
  AND char_length(product) <= 500
  AND char_length(audience) <= 500
  AND char_length(offer) <= 500
  AND char_length(brief) <= 5000
  AND char_length(text_prompt) <= 5000
  AND char_length(image_prompt) <= 3000
  AND char_length(video_prompt) <= 3000
  AND (product_image_path IS NULL OR char_length(product_image_path) <= 1000)
  AND jsonb_typeof(ab_variants) = 'array'
  AND jsonb_array_length(ab_variants) <= 3
  AND jsonb_typeof(publishing_calendar) = 'array'
  AND jsonb_array_length(publishing_calendar) <= 7
  AND pg_column_size(ab_variants) <= 12000
  AND pg_column_size(publishing_calendar) <= 24000
);

CREATE POLICY "Users can update own campaign packs"
ON public.campaign_packs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status = ANY (ARRAY['draft'::text, 'generated'::text, 'archived'::text])
  AND goal = ANY (ARRAY['launch'::text, 'clearance'::text, 'upsell'::text, 'leads'::text, 'competitive'::text, 'winback'::text])
  AND channel = ANY (ARRAY['instagram'::text, 'snapchat'::text, 'tiktok'::text, 'whatsapp'::text])
  AND char_length(product) <= 500
  AND char_length(audience) <= 500
  AND char_length(offer) <= 500
  AND char_length(brief) <= 5000
  AND char_length(text_prompt) <= 5000
  AND char_length(image_prompt) <= 3000
  AND char_length(video_prompt) <= 3000
  AND (product_image_path IS NULL OR char_length(product_image_path) <= 1000)
  AND jsonb_typeof(ab_variants) = 'array'
  AND jsonb_array_length(ab_variants) <= 3
  AND jsonb_typeof(publishing_calendar) = 'array'
  AND jsonb_array_length(publishing_calendar) <= 7
  AND pg_column_size(ab_variants) <= 12000
  AND pg_column_size(publishing_calendar) <= 24000
);

-- ==========================================
-- Migration File: 20260430220327_dd4bd465-b5cb-45ce-bfac-35e2c0fb620e.sql
-- ==========================================

-- =========================================
-- 1) ENUM لأنواع الموافقات
-- =========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consent_type') THEN
    CREATE TYPE public.consent_type AS ENUM (
      'marketing_email',
      'marketing_whatsapp',
      'marketing_telegram',
      'marketing_sms',
      'product_updates',
      'newsletter'
    );
  END IF;
END
$$;

-- =========================================
-- 2) ENUM لمصادر الموافقة
-- =========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consent_source') THEN
    CREATE TYPE public.consent_source AS ENUM (
      'onboarding',
      'settings',
      'subscription_form',
      'telegram_bot',
      'whatsapp_form',
      'admin_action',
      'api'
    );
  END IF;
END
$$;

-- =========================================
-- 3) جدول consent_records
-- =========================================
CREATE TABLE IF NOT EXISTS public.consent_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type    public.consent_type NOT NULL,
  consent_given   boolean NOT NULL,
  consent_text    text NOT NULL,
  consent_version text NOT NULL DEFAULT 'v1',
  source          public.consent_source NOT NULL,
  ip_address      inet,
  user_agent      text,
  withdrawn_at    timestamptz,
  withdrawn_reason text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_records_text_length CHECK (
    char_length(consent_text) >= 10 AND char_length(consent_text) <= 5000
  ),
  CONSTRAINT consent_records_version_format CHECK (
    consent_version ~ '^v[0-9]+(\.[0-9]+)?$'
  ),
  CONSTRAINT consent_records_user_agent_length CHECK (
    user_agent IS NULL OR char_length(user_agent) <= 1000
  ),
  CONSTRAINT consent_records_withdrawn_consistency CHECK (
    (withdrawn_at IS NULL) OR (consent_given = true)
  ),
  CONSTRAINT consent_records_metadata_size CHECK (
    pg_column_size(metadata) <= 4000
  )
);

-- =========================================
-- 4) Indexes
-- =========================================
CREATE INDEX IF NOT EXISTS idx_consent_records_user_type 
  ON public.consent_records(user_id, consent_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consent_records_user_active 
  ON public.consent_records(user_id, consent_type) 
  WHERE consent_given = true AND withdrawn_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_consent_records_created 
  ON public.consent_records(created_at DESC);

-- =========================================
-- 5) RLS Policies
-- =========================================
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own consents" ON public.consent_records;
CREATE POLICY "Users can view own consents"
  ON public.consent_records FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all consents" ON public.consent_records;
CREATE POLICY "Admins can view all consents"
  ON public.consent_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Service role can insert consents" ON public.consent_records;
CREATE POLICY "Service role can insert consents"
  ON public.consent_records FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

-- =========================================
-- 6) أعمدة جديدة في profiles
-- =========================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_email_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_telegram_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS product_updates_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_last_updated_at timestamptz;

-- =========================================
-- 7) record_consent
-- =========================================
CREATE OR REPLACE FUNCTION public.record_consent(
  _consent_type    public.consent_type,
  _consent_given   boolean,
  _consent_text    text,
  _consent_version text DEFAULT 'v1',
  _source          public.consent_source DEFAULT 'settings',
  _user_agent      text DEFAULT NULL,
  _metadata        jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _record_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: user must be authenticated';
  END IF;
  INSERT INTO public.consent_records (
    user_id, consent_type, consent_given, consent_text, 
    consent_version, source, user_agent, metadata
  )
  VALUES (
    _user_id, _consent_type, _consent_given, _consent_text,
    _consent_version, _source, _user_agent, _metadata
  )
  RETURNING id INTO _record_id;
  RETURN _record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_consent FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_consent TO authenticated;

-- =========================================
-- 8) withdraw_consent
-- =========================================
CREATE OR REPLACE FUNCTION public.withdraw_consent(
  _consent_type public.consent_type,
  _reason       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _record_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: user must be authenticated';
  END IF;
  INSERT INTO public.consent_records (
    user_id, consent_type, consent_given, consent_text,
    consent_version, source, withdrawn_at, withdrawn_reason, metadata
  )
  VALUES (
    _user_id, _consent_type, false,
    'سحب موافقة من قبل المستخدم', 'v1', 'settings',
    now(), _reason, jsonb_build_object('action', 'withdrawal')
  )
  RETURNING id INTO _record_id;
  RETURN _record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_consent FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_consent TO authenticated;

-- =========================================
-- 9) get_user_consent_status
-- =========================================
CREATE OR REPLACE FUNCTION public.get_user_consent_status(
  _consent_type public.consent_type DEFAULT NULL
)
RETURNS TABLE (
  consent_type   public.consent_type,
  consent_given  boolean,
  last_updated   timestamptz,
  source         public.consent_source,
  consent_version text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: user must be authenticated';
  END IF;
  RETURN QUERY
  WITH latest_consents AS (
    SELECT DISTINCT ON (cr.consent_type)
      cr.consent_type, cr.consent_given, cr.created_at AS last_updated,
      cr.source, cr.consent_version, cr.withdrawn_at
    FROM public.consent_records cr
    WHERE cr.user_id = _user_id
      AND (_consent_type IS NULL OR cr.consent_type = _consent_type)
    ORDER BY cr.consent_type, cr.created_at DESC
  )
  SELECT lc.consent_type,
    (lc.consent_given AND lc.withdrawn_at IS NULL) AS consent_given,
    lc.last_updated, lc.source, lc.consent_version
  FROM latest_consents lc;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_consent_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_consent_status TO authenticated;

-- =========================================
-- 10) sync_profile_consent_status + trigger
-- =========================================
CREATE OR REPLACE FUNCTION public.sync_profile_consent_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_active boolean;
BEGIN
  _is_active := NEW.consent_given AND NEW.withdrawn_at IS NULL;
  IF NEW.consent_type = 'marketing_email' THEN
    UPDATE public.profiles 
       SET marketing_email_opt_in = _is_active,
           consent_last_updated_at = NEW.created_at
     WHERE id = NEW.user_id;
  ELSIF NEW.consent_type = 'marketing_whatsapp' THEN
    UPDATE public.profiles 
       SET marketing_whatsapp_opt_in = _is_active,
           consent_last_updated_at = NEW.created_at
     WHERE id = NEW.user_id;
  ELSIF NEW.consent_type = 'marketing_telegram' THEN
    UPDATE public.profiles 
       SET marketing_telegram_opt_in = _is_active,
           consent_last_updated_at = NEW.created_at
     WHERE id = NEW.user_id;
  ELSIF NEW.consent_type = 'product_updates' THEN
    UPDATE public.profiles 
       SET product_updates_opt_in = _is_active,
           consent_last_updated_at = NEW.created_at
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_consent_status ON public.consent_records;
CREATE TRIGGER trg_sync_profile_consent_status
AFTER INSERT ON public.consent_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_consent_status();

-- =========================================
-- 11) has_marketing_consent
-- =========================================
CREATE OR REPLACE FUNCTION public.has_marketing_consent(
  _user_id      uuid,
  _consent_type public.consent_type
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _has_consent boolean;
BEGIN
  SELECT (cr.consent_given AND cr.withdrawn_at IS NULL)
    INTO _has_consent
    FROM public.consent_records cr
   WHERE cr.user_id = _user_id
     AND cr.consent_type = _consent_type
   ORDER BY cr.created_at DESC
   LIMIT 1;
  RETURN COALESCE(_has_consent, false);
END;
$$;

REVOKE ALL ON FUNCTION public.has_marketing_consent FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_marketing_consent TO service_role;
GRANT EXECUTE ON FUNCTION public.has_marketing_consent TO authenticated;

-- =========================================
-- 12) admin_consent_stats view
-- =========================================
CREATE OR REPLACE VIEW public.admin_consent_stats AS
SELECT 
  consent_type,
  COUNT(DISTINCT user_id) AS total_users_decided,
  COUNT(DISTINCT user_id) FILTER (WHERE consent_given AND withdrawn_at IS NULL) AS active_consents,
  COUNT(DISTINCT user_id) FILTER (WHERE NOT consent_given) AS denied_consents,
  COUNT(DISTINCT user_id) FILTER (WHERE withdrawn_at IS NOT NULL) AS withdrawn_consents,
  MIN(created_at) AS first_consent_at,
  MAX(created_at) AS last_consent_at
FROM public.consent_records
GROUP BY consent_type;

-- =========================================
-- 13) COMMENTS
-- =========================================
COMMENT ON TABLE public.consent_records IS 
  'Immutable audit log for user consent under PDPL (Saudi Arabia). Records cannot be updated or deleted. Use withdraw_consent function to add a new withdrawal record.';

COMMENT ON FUNCTION public.record_consent IS 
  'Records a new consent. Inserts a new immutable row in consent_records. Use this from client-side after showing the user a clear consent dialog.';

COMMENT ON FUNCTION public.withdraw_consent IS 
  'Withdraws a previously given consent. Inserts a new row marking withdrawal (does not modify old record).';

COMMENT ON FUNCTION public.has_marketing_consent IS 
  'Server-side check before sending any marketing message. Returns true only if user has given AND not withdrawn the specified consent type.';

-- ==========================================
-- Migration File: 20260501075930_aab34f39-6458-4980-ad69-e2912bddb041.sql
-- ==========================================

-- حذف جميع المستخدمين ما عدا الأدمن. سيتم حذف كل البيانات المرتبطة عبر ON DELETE CASCADE
-- على المفاتيح الخارجية المرتبطة بـ auth.users.

DO $$
DECLARE
  admin_id uuid := 'c974babd-e099-45e2-89ef-73fecc6a88e2';
BEGIN
  -- حذف بيانات الجداول التي قد لا ترتبط بـ cascade مع auth.users
  DELETE FROM public.subscription_requests WHERE user_id <> admin_id;
  DELETE FROM public.topup_purchases WHERE user_id <> admin_id;
  DELETE FROM public.credit_ledger WHERE user_id <> admin_id;
  DELETE FROM public.user_credits WHERE user_id <> admin_id;
  DELETE FROM public.usage_logs WHERE user_id <> admin_id;
  DELETE FROM public.daily_text_usage WHERE user_id <> admin_id;
  DELETE FROM public.consent_records WHERE user_id <> admin_id;
  DELETE FROM public.generations WHERE user_id <> admin_id;
  DELETE FROM public.campaign_packs WHERE user_id <> admin_id;
  DELETE FROM public.video_jobs WHERE user_id <> admin_id;
  DELETE FROM public.user_roles WHERE user_id <> admin_id;
  DELETE FROM public.profiles WHERE id <> admin_id;

  -- حذف المستخدمين من auth.users (يستخدم service-level داخل migration)
  DELETE FROM auth.users WHERE id <> admin_id;
END $$;

-- ==========================================
-- Migration File: 20260501082445_c37805db-3576-441e-ada1-8e79994aee17.sql
-- ==========================================

-- إكمال سياسة UPDATE على profiles بإضافة WITH CHECK لتفادي أي سلوك غامض في PostgREST
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ==========================================
-- Migration File: 20260501091550_1f79f206-11f9-4acf-ac08-8bef18662d7c.sql
-- ==========================================

DO $$
DECLARE
  _uid uuid;
  _email text := 'claude-audit@rifd.site';
  _password text := 'Audit-Claude-2026-Full-Access-X9k';
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = _email;

  IF _uid IS NULL THEN
    _uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _uid, 'authenticated', 'authenticated', _email,
      crypt(_password, gen_salt('bf')), now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('full_name','Claude Audit Reviewer'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), _uid, _uid::text,
      jsonb_build_object('sub', _uid::text, 'email', _email, 'email_verified', true),
      'email', now(), now(), now()
    );
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt(_password, gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = _uid;
  END IF;

  -- تجاوز الـ trigger الحامي للخطة (نحن في سياق migration موثوق)
  ALTER TABLE public.profiles DISABLE TRIGGER USER;

  INSERT INTO public.profiles (
    id, email, full_name, plan, onboarded,
    store_name, audience, product_type, tone, brand_color,
    brand_personality, unique_selling_point, cta_style, whatsapp
  ) VALUES (
    _uid, _email, 'Claude Audit Reviewer', 'pro'::user_plan, true,
    'متجر المراجعة التجريبي', 'تجار سعوديون 25-45',
    'منتجات استهلاكية متنوعة', 'ودود ومحترف', '#1a5d3e',
    'موثوق وسريع', 'جودة عالية وتوصيل سريع', 'اطلب الآن',
    '966500000099'
  )
  ON CONFLICT (id) DO UPDATE SET
    plan = 'pro'::user_plan,
    onboarded = true,
    full_name = EXCLUDED.full_name,
    store_name = EXCLUDED.store_name,
    audience = EXCLUDED.audience,
    product_type = EXCLUDED.product_type,
    tone = EXCLUDED.tone,
    updated_at = now();

  ALTER TABLE public.profiles ENABLE TRIGGER USER;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'admin'::app_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_credits (user_id, plan_credits, topup_credits, cycle_started_at, cycle_ends_at)
  VALUES (_uid, 5000, 5000, now(), now() + interval '365 days')
  ON CONFLICT (user_id) DO UPDATE SET
    plan_credits = 5000,
    topup_credits = 5000,
    cycle_ends_at = now() + interval '365 days',
    updated_at = now();

  INSERT INTO public.credit_ledger (user_id, txn_type, amount, source, balance_after_plan, balance_after_topup, metadata)
  VALUES (_uid, 'plan_grant', 10000, 'plan', 5000, 5000,
          jsonb_build_object('reason','claude_audit_account','grant_type','full_access'));

  RAISE NOTICE 'Claude audit account ready: %', _uid;
END $$;

-- ==========================================
-- Migration File: 20260502070453_aa873871-88de-4462-8cca-98eee735bbb2.sql
-- ==========================================

-- ============================================================
-- WAVE 1: Pre-migration backups
-- ============================================================
CREATE TABLE IF NOT EXISTS public.backup_video_provider_configs_20260502 AS
  SELECT * FROM public.video_provider_configs;

CREATE TABLE IF NOT EXISTS public.backup_video_jobs_20260502 AS
  SELECT * FROM public.video_jobs;

-- ============================================================
-- 1) Update video_provider_configs: Replicate primary, fal_ai fallback
-- ============================================================
UPDATE public.video_provider_configs
SET enabled = true,
    public_enabled = true,
    priority = 100,
    health_status = 'testing',
    last_error_message = NULL,
    updated_at = now()
WHERE provider_key = 'replicate';

UPDATE public.video_provider_configs
SET enabled = true,
    public_enabled = true,
    priority = 50,
    health_status = 'active',
    updated_at = now()
WHERE provider_key = 'fal_ai';

-- ============================================================
-- 2) error_category enum + column on video_jobs
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.video_error_category AS ENUM (
    'provider_error',
    'user_error',
    'content_error',
    'timeout',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.video_jobs
  ADD COLUMN IF NOT EXISTS error_category public.video_error_category;

CREATE INDEX IF NOT EXISTS idx_video_jobs_error_category
  ON public.video_jobs (error_category)
  WHERE error_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_video_jobs_provider_status_completed
  ON public.video_jobs (provider, status, completed_at DESC);

-- ============================================================
-- 3) provider_health_window — rolling 24h success/fail counts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.provider_health_window (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  success_count integer NOT NULL DEFAULT 0,
  fail_count integer NOT NULL DEFAULT 0,
  total_count integer GENERATED ALWAYS AS (success_count + fail_count) STORED,
  fail_rate numeric(5,4) GENERATED ALWAYS AS (
    CASE WHEN (success_count + fail_count) = 0 THEN 0
         ELSE fail_count::numeric / (success_count + fail_count) END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_provider_health_window_provider_recent
  ON public.provider_health_window (provider_key, window_start DESC);

ALTER TABLE public.provider_health_window ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view provider_health_window" ON public.provider_health_window;
CREATE POLICY "Admins can view provider_health_window"
  ON public.provider_health_window FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- 4) provider_kill_switch_events — audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.provider_kill_switch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  fail_rate numeric(5,4) NOT NULL,
  fail_count integer NOT NULL,
  success_count integer NOT NULL,
  window_minutes integer NOT NULL DEFAULT 1440,
  restored_at timestamptz,
  restored_by uuid,
  restore_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kill_switch_events_provider_recent
  ON public.provider_kill_switch_events (provider_key, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_kill_switch_events_active
  ON public.provider_kill_switch_events (provider_key)
  WHERE restored_at IS NULL;

ALTER TABLE public.provider_kill_switch_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view kill_switch_events" ON public.provider_kill_switch_events;
CREATE POLICY "Admins can view kill_switch_events"
  ON public.provider_kill_switch_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- 5) Trigger: update health window after video_jobs status change
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_provider_health_after_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bucket timestamptz := date_trunc('hour', now());
  _is_success boolean;
  _is_failure boolean;
  _window_success integer;
  _window_fail integer;
  _window_total integer;
  _window_fail_rate numeric;
  _kill_switch_threshold numeric := 0.20;
  _min_attempts integer := 10;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.provider IS NULL OR NEW.provider = '' THEN RETURN NEW; END IF;

  _is_success := (NEW.status::text = 'succeeded');
  _is_failure := (NEW.status::text = 'failed' AND COALESCE(NEW.error_category, 'unknown')::text IN ('provider_error','timeout','unknown'));

  IF NOT _is_success AND NOT _is_failure THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.provider_health_window (provider_key, window_start, success_count, fail_count)
  VALUES (
    NEW.provider, _bucket,
    CASE WHEN _is_success THEN 1 ELSE 0 END,
    CASE WHEN _is_failure THEN 1 ELSE 0 END
  )
  ON CONFLICT (provider_key, window_start) DO UPDATE
    SET success_count = public.provider_health_window.success_count + EXCLUDED.success_count,
        fail_count    = public.provider_health_window.fail_count    + EXCLUDED.fail_count,
        updated_at    = now();

  SELECT COALESCE(SUM(success_count), 0), COALESCE(SUM(fail_count), 0)
    INTO _window_success, _window_fail
  FROM public.provider_health_window
  WHERE provider_key = NEW.provider
    AND window_start >= now() - interval '24 hours';

  _window_total := _window_success + _window_fail;
  _window_fail_rate := CASE WHEN _window_total = 0 THEN 0
                            ELSE _window_fail::numeric / _window_total END;

  IF _window_fail_rate >= _kill_switch_threshold AND _window_total >= _min_attempts THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.provider_kill_switch_events
      WHERE provider_key = NEW.provider AND restored_at IS NULL
    ) THEN
      UPDATE public.video_provider_configs
      SET enabled = false,
          health_status = 'unhealthy',
          last_error_at = now(),
          last_error_message = format('Auto-disabled by kill-switch: fail_rate=%.2f%% over %s attempts in 24h',
                                       _window_fail_rate * 100, _window_total),
          updated_at = now()
      WHERE provider_key = NEW.provider;

      INSERT INTO public.provider_kill_switch_events (
        provider_key, fail_rate, fail_count, success_count, window_minutes, metadata
      ) VALUES (
        NEW.provider, _window_fail_rate, _window_fail, _window_success, 1440,
        jsonb_build_object('triggered_by_job_id', NEW.id, 'threshold', _kill_switch_threshold)
      );

      BEGIN
        PERFORM net.http_post(
          url := (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_url'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
          ),
          body := jsonb_build_object(
            'event', 'provider_kill_switch',
            'provider_key', NEW.provider,
            'fail_rate', _window_fail_rate,
            'fail_count', _window_fail,
            'success_count', _window_success,
            'admin_chat_id', (SELECT value FROM public.internal_config WHERE key = 'telegram_admin_chat_id')
          ),
          timeout_milliseconds := 5000
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'kill-switch notify failed: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_provider_health_after_job ON public.video_jobs;
CREATE TRIGGER trg_update_provider_health_after_job
AFTER UPDATE OF status ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_provider_health_after_job();

-- ============================================================
-- 6) Admin RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.restore_provider(_provider_key text, _reason text DEFAULT 'manual_admin_restore')
RETURNS public.video_provider_configs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.video_provider_configs;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  UPDATE public.video_provider_configs
  SET enabled = true,
      health_status = 'testing',
      last_error_message = NULL,
      updated_at = now()
  WHERE provider_key = _provider_key
  RETURNING * INTO _row;

  IF NOT FOUND THEN RAISE EXCEPTION 'provider_not_found: %', _provider_key; END IF;

  UPDATE public.provider_kill_switch_events
  SET restored_at = now(),
      restored_by = auth.uid(),
      restore_reason = _reason
  WHERE provider_key = _provider_key AND restored_at IS NULL;

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_provider_health_summary()
RETURNS TABLE(
  provider_key text,
  enabled boolean,
  priority integer,
  health_status text,
  success_24h integer,
  fail_24h integer,
  total_24h integer,
  fail_rate_24h numeric,
  active_kill_switch boolean,
  last_kill_switch_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  RETURN QUERY
  SELECT
    vpc.provider_key,
    vpc.enabled,
    vpc.priority,
    vpc.health_status,
    COALESCE(h.s, 0)::int AS success_24h,
    COALESCE(h.f, 0)::int AS fail_24h,
    COALESCE(h.s + h.f, 0)::int AS total_24h,
    CASE WHEN COALESCE(h.s + h.f, 0) = 0 THEN 0::numeric
         ELSE (h.f::numeric / (h.s + h.f)) END AS fail_rate_24h,
    EXISTS (
      SELECT 1 FROM public.provider_kill_switch_events ev
      WHERE ev.provider_key = vpc.provider_key AND ev.restored_at IS NULL
    ) AS active_kill_switch,
    (SELECT MAX(triggered_at) FROM public.provider_kill_switch_events
     WHERE provider_key = vpc.provider_key) AS last_kill_switch_at
  FROM public.video_provider_configs vpc
  LEFT JOIN LATERAL (
    SELECT SUM(success_count) AS s, SUM(fail_count) AS f
    FROM public.provider_health_window
    WHERE provider_key = vpc.provider_key
      AND window_start >= now() - interval '24 hours'
  ) h ON true
  ORDER BY vpc.priority DESC NULLS LAST;
END;
$$;

-- ==========================================
-- Migration File: 20260502070516_5dfff895-2296-4b64-b6f8-268503737977.sql
-- ==========================================

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

-- ==========================================
-- Migration File: 20260502070615_a8f29cc1-65c4-4be0-96d2-c86a83e38445.sql
-- ==========================================

CREATE OR REPLACE FUNCTION public.grant_compensation_credits(
  _user_id uuid,
  _amount integer,
  _reason text,
  _reference_id uuid DEFAULT NULL,
  _reference_type text DEFAULT 'video_job'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.user_credits;
  _ledger_id uuid;
BEGIN
  -- service_role only (called from server code)
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'service_role_only';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 500 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  -- Idempotency: skip if compensation already granted for this reference
  IF _reference_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.credit_ledger
      WHERE reference_id = _reference_id
        AND txn_type = 'plan_grant'
        AND metadata->>'compensation_for' IS NOT NULL
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  PERFORM public._ensure_user_credits(_user_id);

  UPDATE public.user_credits
  SET plan_credits = plan_credits + _amount,
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING * INTO _row;

  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _user_id, 'plan_grant', _amount, 'plan',
    _row.plan_credits, _row.topup_credits,
    _reference_id, _reference_type,
    jsonb_build_object(
      'compensation_for', _reason,
      'granted_by', 'system_auto_compensation',
      'granted_at', now()
    )
  ) RETURNING id INTO _ledger_id;

  RETURN _ledger_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_compensation_credits(uuid, integer, text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_compensation_credits(uuid, integer, text, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_compensation_credits(uuid, integer, text, uuid, text) TO service_role;

-- ==========================================
-- Migration File: 20260502071559_c9de1a36-ca2e-400a-b188-a042ca9a7d5d.sql
-- ==========================================

-- ============================================================
-- Wave 2A — Free Monthly Trial + Video Cap
-- ============================================================

-- (1) نسخ احتياطية
CREATE TABLE IF NOT EXISTS public.backup_plan_entitlements_20260502 AS
  SELECT * FROM public.plan_entitlements;
ALTER TABLE public.backup_plan_entitlements_20260502 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only - backup_plan_entitlements"
  ON public.backup_plan_entitlements_20260502 FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.backup_user_credits_20260502 AS
  SELECT * FROM public.user_credits;
ALTER TABLE public.backup_user_credits_20260502 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only - backup_user_credits"
  ON public.backup_user_credits_20260502 FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- (2) أعمدة جديدة في plan_entitlements (للـ Free فقط — NULL للمدفوعة)
ALTER TABLE public.plan_entitlements
  ADD COLUMN IF NOT EXISTS monthly_text_cap INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_image_cap INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_video_count_cap INTEGER;

-- تعيين القيم الشهرية للـ Free فقط
UPDATE public.plan_entitlements
  SET monthly_text_cap = 5,
      monthly_image_cap = 3,
      monthly_video_count_cap = 1
  WHERE plan = 'free';

-- (3) جدول monthly_usage للاستهلاك الشهري
CREATE TABLE IF NOT EXISTS public.monthly_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  cycle_end TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  text_used INTEGER NOT NULL DEFAULT 0,
  image_used INTEGER NOT NULL DEFAULT 0,
  video_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cycle_start)
);

CREATE INDEX IF NOT EXISTS idx_monthly_usage_cycle_end ON public.monthly_usage (cycle_end);

ALTER TABLE public.monthly_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own monthly usage"
  ON public.monthly_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all monthly usage"
  ON public.monthly_usage FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- (4) دالة مساعدة: جلب أو إنشاء دورة الاستهلاك الشهرية الحالية
CREATE OR REPLACE FUNCTION public.get_or_create_current_monthly_cycle(_user_id UUID)
RETURNS public.monthly_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.monthly_usage;
BEGIN
  -- ابحث عن دورة فعّالة (now بين cycle_start و cycle_end)
  SELECT * INTO _row FROM public.monthly_usage
    WHERE user_id = _user_id AND now() >= cycle_start AND now() < cycle_end
    ORDER BY cycle_start DESC LIMIT 1;
  
  IF FOUND THEN
    RETURN _row;
  END IF;
  
  -- لا توجد دورة فعّالة → ابدأ دورة جديدة 30 يوم
  INSERT INTO public.monthly_usage (user_id, cycle_start, cycle_end)
    VALUES (_user_id, now(), now() + INTERVAL '30 days')
    ON CONFLICT (user_id, cycle_start) DO NOTHING
    RETURNING * INTO _row;
  
  IF _row IS NULL THEN
    SELECT * INTO _row FROM public.monthly_usage
      WHERE user_id = _user_id AND now() >= cycle_start AND now() < cycle_end
      ORDER BY cycle_start DESC LIMIT 1;
  END IF;
  
  RETURN _row;
END;
$$;

-- (5) تحديث consume_text_quota: Free → شهري، المدفوع → يومي كما هو
CREATE OR REPLACE FUNCTION public.consume_text_quota()
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
  _cycle public.monthly_usage;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);

  -- Free: استخدم الحصة الشهرية
  IF _ent.plan = 'free' AND _ent.monthly_text_cap IS NOT NULL THEN
    _cap := _ent.monthly_text_cap;
    _cycle := public.get_or_create_current_monthly_cycle(_uid);
    
    UPDATE public.monthly_usage
      SET text_used = text_used + 1, updated_at = now()
      WHERE user_id = _uid AND cycle_start = _cycle.cycle_start
      RETURNING text_used INTO _new_count;
    
    IF _new_count > _cap THEN
      UPDATE public.monthly_usage
        SET text_used = GREATEST(text_used - 1, 0), updated_at = now()
        WHERE user_id = _uid AND cycle_start = _cycle.cycle_start;
      RETURN QUERY SELECT false, _new_count - 1, _cap;
    ELSE
      RETURN QUERY SELECT true, _new_count, _cap;
    END IF;
    RETURN;
  END IF;

  -- المدفوعة: نفس المنطق اليومي السابق
  _cap := COALESCE(_ent.daily_text_cap, 10);

  INSERT INTO public.daily_text_usage (user_id, day, text_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET text_count = public.daily_text_usage.text_count + 1,
        updated_at = now()
  RETURNING text_count INTO _new_count;

  IF _new_count > _cap THEN
    UPDATE public.daily_text_usage SET text_count = GREATEST(text_count - 1, 0), updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

-- (6) تحديث consume_image_quota: Free → شهري، المدفوع → يومي
CREATE OR REPLACE FUNCTION public.consume_image_quota(_quality text DEFAULT 'flash'::text)
RETURNS TABLE(allowed boolean, used integer, daily_cap integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cap integer;
  _today date := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  _new_count integer;
  _cycle public.monthly_usage;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _quality NOT IN ('flash', 'pro') THEN RAISE EXCEPTION 'invalid_image_quality'; END IF;

  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);
  IF _quality = 'pro' AND COALESCE(_ent.image_pro_allowed, false) = false THEN
    RAISE EXCEPTION 'image_pro_not_allowed';
  END IF;

  -- Free: شهري
  IF _ent.plan = 'free' AND _ent.monthly_image_cap IS NOT NULL THEN
    _cap := _ent.monthly_image_cap;
    _cycle := public.get_or_create_current_monthly_cycle(_uid);
    
    UPDATE public.monthly_usage
      SET image_used = image_used + 1, updated_at = now()
      WHERE user_id = _uid AND cycle_start = _cycle.cycle_start
      RETURNING image_used INTO _new_count;
    
    IF _new_count > _cap THEN
      UPDATE public.monthly_usage
        SET image_used = GREATEST(image_used - 1, 0), updated_at = now()
        WHERE user_id = _uid AND cycle_start = _cycle.cycle_start;
      RETURN QUERY SELECT false, _new_count - 1, _cap;
    ELSE
      RETURN QUERY SELECT true, _new_count, _cap;
    END IF;
    RETURN;
  END IF;

  -- المدفوعة: يومي كما هو
  _cap := COALESCE(_ent.daily_image_cap, 2);

  INSERT INTO public.daily_text_usage (user_id, day, image_count)
  VALUES (_uid, _today, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET image_count = public.daily_text_usage.image_count + 1,
        updated_at = now()
  RETURNING image_count INTO _new_count;

  IF _new_count > _cap THEN
    UPDATE public.daily_text_usage SET image_count = GREATEST(image_count - 1, 0), updated_at = now()
    WHERE user_id = _uid AND day = _today;
    RETURN QUERY SELECT false, _new_count - 1, _cap;
  ELSE
    RETURN QUERY SELECT true, _new_count, _cap;
  END IF;
END;
$$;

-- (7) دالة جديدة: التحقق من سقف الفيديو الشهري للـ Free فقط (تستدعى قبل خصم النقاط)
CREATE OR REPLACE FUNCTION public.check_free_monthly_video_quota()
RETURNS TABLE(allowed boolean, used integer, monthly_cap integer, next_reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cycle public.monthly_usage;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);

  -- المدفوعة: لا يوجد سقف عددي للفيديو (يخضع للنقاط فقط)
  IF _ent.plan <> 'free' OR _ent.monthly_video_count_cap IS NULL THEN
    RETURN QUERY SELECT true, 0, 999999, (now() + INTERVAL '30 days');
    RETURN;
  END IF;

  _cycle := public.get_or_create_current_monthly_cycle(_uid);
  
  IF _cycle.video_used >= _ent.monthly_video_count_cap THEN
    RETURN QUERY SELECT false, _cycle.video_used, _ent.monthly_video_count_cap, _cycle.cycle_end;
  ELSE
    RETURN QUERY SELECT true, _cycle.video_used, _ent.monthly_video_count_cap, _cycle.cycle_end;
  END IF;
END;
$$;

-- (8) دالة لتسجيل استهلاك فيديو في الدورة الشهرية (تستدعى عند نجاح الإنشاء)
CREATE OR REPLACE FUNCTION public.record_free_monthly_video_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ent public.plan_entitlements;
  _cycle public.monthly_usage;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _ent FROM public.plan_entitlement_for_user(_uid);
  
  -- فقط للـ free
  IF _ent.plan <> 'free' OR _ent.monthly_video_count_cap IS NULL THEN
    RETURN;
  END IF;
  
  _cycle := public.get_or_create_current_monthly_cycle(_uid);
  
  UPDATE public.monthly_usage
    SET video_used = video_used + 1, updated_at = now()
    WHERE user_id = _uid AND cycle_start = _cycle.cycle_start;
END;
$$;

-- (9) GRANT execute للأدوار المناسبة
GRANT EXECUTE ON FUNCTION public.get_or_create_current_monthly_cycle(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_free_monthly_video_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_free_monthly_video_usage() TO authenticated, service_role;

-- ==========================================
-- Migration File: 20260502071617_ccf22482-a509-4c27-a5cc-80c45c5327b2.sql
-- ==========================================

REVOKE EXECUTE ON FUNCTION public.get_or_create_current_monthly_cycle(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_free_monthly_video_quota() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_free_monthly_video_usage() FROM anon, public;

-- ==========================================
-- Migration File: 20260502074210_35f3414b-bedc-457d-8cdd-9e01f276123d.sql
-- ==========================================

-- ============================================================================
-- Wave 3: Launch Bonus Program (50pt for first 100 paid subscribers)
-- ============================================================================

-- 1) Add is_founding_member flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_founding_member BOOLEAN NOT NULL DEFAULT false;

-- 2) launch_bonus_recipients table
CREATE TABLE IF NOT EXISTS public.launch_bonus_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_request_id UUID REFERENCES public.subscription_requests(id) ON DELETE SET NULL,
  ledger_id UUID REFERENCES public.credit_ledger(id) ON DELETE SET NULL,
  credits_granted INTEGER NOT NULL DEFAULT 50,
  recipient_number INTEGER NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_launch_bonus_recipients_granted
  ON public.launch_bonus_recipients (granted_at DESC);

ALTER TABLE public.launch_bonus_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_launch_bonus" ON public.launch_bonus_recipients;
CREATE POLICY "users_view_own_launch_bonus"
  ON public.launch_bonus_recipients
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 3) grant_launch_bonus_if_eligible
CREATE OR REPLACE FUNCTION public.grant_launch_bonus_if_eligible(
  _user_id UUID,
  _subscription_request_id UUID DEFAULT NULL
)
RETURNS TABLE(granted BOOLEAN, recipient_number INTEGER, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_count INTEGER;
  _already_granted BOOLEAN;
  _new_number INTEGER;
  _new_ledger_id UUID;
  _topup_balance INTEGER;
  _plan_balance INTEGER;
BEGIN
  -- already received?
  SELECT EXISTS (
    SELECT 1 FROM public.launch_bonus_recipients WHERE user_id = _user_id
  ) INTO _already_granted;

  IF _already_granted THEN
    RETURN QUERY SELECT false, NULL::INTEGER, 'already_granted'::TEXT;
    RETURN;
  END IF;

  -- lock to prevent race past 100
  PERFORM 1 FROM public.launch_bonus_recipients FOR UPDATE;
  SELECT COUNT(*) INTO _existing_count FROM public.launch_bonus_recipients;

  IF _existing_count >= 100 THEN
    RETURN QUERY SELECT false, NULL::INTEGER, 'cap_reached'::TEXT;
    RETURN;
  END IF;

  _new_number := _existing_count + 1;

  -- read current balances (user_credits row)
  SELECT COALESCE(plan_credits, 0), COALESCE(topup_credits, 0)
    INTO _plan_balance, _topup_balance
  FROM public.user_credits WHERE user_id = _user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_credits (user_id, plan_credits, topup_credits)
    VALUES (_user_id, 0, 50)
    RETURNING plan_credits, topup_credits INTO _plan_balance, _topup_balance;
  ELSE
    UPDATE public.user_credits
      SET topup_credits = topup_credits + 50,
          updated_at = now()
      WHERE user_id = _user_id
    RETURNING plan_credits, topup_credits INTO _plan_balance, _topup_balance;
  END IF;

  -- ledger row
  INSERT INTO public.credit_ledger (
    user_id, txn_type, amount, source,
    balance_after_plan, balance_after_topup,
    reference_id, reference_type, metadata
  ) VALUES (
    _user_id, 'grant', 50, 'topup',
    _plan_balance, _topup_balance,
    _subscription_request_id, 'launch_bonus',
    jsonb_build_object('reason', 'launch_bonus', 'recipient_number', _new_number)
  )
  RETURNING id INTO _new_ledger_id;

  INSERT INTO public.launch_bonus_recipients (
    user_id, subscription_request_id, ledger_id, credits_granted, recipient_number
  ) VALUES (
    _user_id, _subscription_request_id, _new_ledger_id, 50, _new_number
  );

  UPDATE public.profiles SET is_founding_member = true, updated_at = now()
    WHERE id = _user_id;

  RETURN QUERY SELECT true, _new_number, 'granted'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_launch_bonus_if_eligible(UUID, UUID) FROM PUBLIC;

-- 4) Trigger on subscription_requests activation
CREATE OR REPLACE FUNCTION public.trg_launch_bonus_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'activated' AND (OLD.status IS DISTINCT FROM 'activated') THEN
    BEGIN
      PERFORM public.grant_launch_bonus_if_eligible(NEW.user_id, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'launch_bonus grant failed for user %: %', NEW.user_id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_requests_launch_bonus ON public.subscription_requests;
CREATE TRIGGER subscription_requests_launch_bonus
  AFTER UPDATE OF status ON public.subscription_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_launch_bonus_on_activation();

-- 5) Read function: stats
CREATE OR REPLACE FUNCTION public.get_launch_bonus_stats()
RETURNS TABLE(total_granted INTEGER, remaining INTEGER, cap INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::INTEGER AS total_granted,
    GREATEST(0, 100 - COUNT(*)::INTEGER) AS remaining,
    100 AS cap
  FROM public.launch_bonus_recipients
$$;

GRANT EXECUTE ON FUNCTION public.get_launch_bonus_stats() TO authenticated, anon;


-- ==========================================
-- Migration File: 20260502074509_0bbdad2c-f363-436f-94e4-bf592403ff4b.sql
-- ==========================================

-- Schedule daily Phase 1 report (08:00 Riyadh = 05:00 UTC)
SELECT cron.unschedule('phase1-daily-report')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'phase1-daily-report');

SELECT cron.schedule(
  'phase1-daily-report',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rifd.site/api/public/hooks/phase1-daily-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  ) AS request_id;
  $$
);


-- ==========================================
-- Migration File: 20260502075148_bdf6abfe-1c4a-45d3-aceb-886bba65fd37.sql
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_subscribers_count()
RETURNS TABLE(total INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base INTEGER;
  _taken INTEGER;
BEGIN
  SELECT COALESCE(founding_base_count, 564) INTO _base
  FROM public.app_settings WHERE id = 1;

  SELECT COUNT(*)::INTEGER INTO _taken
  FROM public.subscription_requests
  WHERE status IN ('activated', 'contacted', 'pending');

  RETURN QUERY SELECT COALESCE(_base, 564) + COALESCE(_taken, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscribers_count() TO authenticated, anon;


-- ==========================================
-- Migration File: 20260502080834_1198cf85-2760-48f7-ae66-f837f47743f5.sql
-- ==========================================


CREATE OR REPLACE FUNCTION public.fn_video_jobs_after_update_health()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bucket timestamptz := date_trunc('hour', now());
  _is_success boolean;
  _is_failure boolean;
  _window_success integer;
  _window_fail integer;
  _window_total integer;
  _window_fail_rate numeric;
  _kill_switch_threshold numeric := 0.20;
  _min_attempts integer := 10;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.provider IS NULL OR NEW.provider = '' THEN RETURN NEW; END IF;

  _is_success := (NEW.status::text = 'completed');
  _is_failure := (NEW.status::text = 'failed' AND COALESCE(NEW.error_category, 'unknown')::text IN ('provider_error','timeout','unknown'));

  IF NOT _is_success AND NOT _is_failure THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.provider_health_window (provider_key, window_start, success_count, fail_count)
  VALUES (
    NEW.provider, _bucket,
    CASE WHEN _is_success THEN 1 ELSE 0 END,
    CASE WHEN _is_failure THEN 1 ELSE 0 END
  )
  ON CONFLICT (provider_key, window_start) DO UPDATE
    SET success_count = public.provider_health_window.success_count + EXCLUDED.success_count,
        fail_count    = public.provider_health_window.fail_count    + EXCLUDED.fail_count,
        updated_at    = now();

  SELECT COALESCE(SUM(success_count), 0), COALESCE(SUM(fail_count), 0)
    INTO _window_success, _window_fail
  FROM public.provider_health_window
  WHERE provider_key = NEW.provider
    AND window_start >= now() - interval '24 hours';

  _window_total := _window_success + _window_fail;
  _window_fail_rate := CASE WHEN _window_total = 0 THEN 0
                            ELSE _window_fail::numeric / _window_total END;

  IF _window_fail_rate >= _kill_switch_threshold AND _window_total >= _min_attempts THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.provider_kill_switch_events
      WHERE provider_key = NEW.provider AND restored_at IS NULL
    ) THEN
      UPDATE public.video_provider_configs
      SET enabled = false,
          health_status = 'unhealthy',
          last_error_at = now(),
          last_error_message = format('Auto-disabled by kill-switch: fail_rate=%.2f%% over %s attempts in 24h',
                                       _window_fail_rate * 100, _window_total),
          updated_at = now()
      WHERE provider_key = NEW.provider;

      INSERT INTO public.provider_kill_switch_events (
        provider_key, fail_rate, fail_count, success_count, window_minutes, metadata
      ) VALUES (
        NEW.provider, _window_fail_rate, _window_fail, _window_success, 1440,
        jsonb_build_object('triggered_by_job_id', NEW.id, 'threshold', _kill_switch_threshold)
      );

      BEGIN
        PERFORM net.http_post(
          url := (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_url'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', (SELECT value FROM public.internal_config WHERE key = 'notify_webhook_secret')
          ),
          body := jsonb_build_object(
            'event', 'provider_kill_switch',
            'provider_key', NEW.provider,
            'fail_rate', _window_fail_rate,
            'fail_count', _window_fail,
            'success_count', _window_success,
            'admin_chat_id', (SELECT value FROM public.internal_config WHERE key = 'telegram_admin_chat_id')
          )
        );
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- BACKFILL آخر 24 ساعة
DELETE FROM public.provider_health_window
WHERE window_start >= date_trunc('hour', now() - interval '24 hours');

INSERT INTO public.provider_health_window (provider_key, window_start, success_count, fail_count)
SELECT
  provider AS provider_key,
  date_trunc('hour', COALESCE(completed_at, updated_at)) AS window_start,
  COUNT(*) FILTER (WHERE status::text = 'completed') AS success_count,
  COUNT(*) FILTER (WHERE status::text = 'failed' AND COALESCE(error_category, 'unknown')::text IN ('provider_error','timeout','unknown')) AS fail_count
FROM public.video_jobs
WHERE provider IS NOT NULL AND provider <> ''
  AND COALESCE(completed_at, updated_at) >= now() - interval '24 hours'
  AND status::text IN ('completed','failed')
GROUP BY provider, date_trunc('hour', COALESCE(completed_at, updated_at))
ON CONFLICT (provider_key, window_start) DO UPDATE
  SET success_count = EXCLUDED.success_count,
      fail_count    = EXCLUDED.fail_count,
      updated_at    = now();

-- RESTORE: إغلاق kill-switch events المفتوحة وإعادة تفعيل المزودين الناشطين فقط
UPDATE public.provider_kill_switch_events
SET restored_at = now(),
    restore_reason = 'hotfix_succeeded_to_completed_v6'
WHERE restored_at IS NULL;

-- نُعيد تفعيل فقط المزودين الذين أُوقفوا بسبب kill-switch (last_error_message يحوي 'kill-switch')
-- ونتجنب المزودين المتقاعدين أو المعطّلين يدوياً (metadata.role='retired_legacy_provider')
UPDATE public.video_provider_configs
SET enabled = true,
    health_status = 'active',
    last_error_message = NULL,
    updated_at = now()
WHERE health_status = 'unhealthy'
  AND COALESCE(last_error_message, '') ILIKE '%kill-switch%'
  AND COALESCE((metadata ->> 'role'), '') <> 'retired_legacy_provider';


-- ==========================================
-- Migration File: 20260502080935_25b0e708-6693-4f65-b79a-7ea1ef9838ff.sql
-- ==========================================


-- ============================================================
-- profiles: onboarding tracking
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- ============================================================
-- onboarding_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  step integer NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('started','step_completed','wizard_completed','wizard_abandoned','autogen_started','autogen_succeeded','autogen_failed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_user ON public.onboarding_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_type ON public.onboarding_events(event_type, created_at DESC);

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_onboarding_events"
  ON public.onboarding_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "users_insert_own_onboarding_events"
  ON public.onboarding_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND step BETWEEN 0 AND 3 AND char_length(event_type) <= 32 AND pg_column_size(metadata) <= 4000);

-- ============================================================
-- badge_type enum + user_badges
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.badge_type AS ENUM ('first_text','first_image','first_video','active_store');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_type public.badge_type NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(user_id, badge_type)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id, awarded_at DESC);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_badges"
  ON public.user_badges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- لا insert/update/delete من المستخدم — فقط من triggers (SECURITY DEFINER)

-- ============================================================
-- Award helper + trigger logic
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_award_badge_if_new(
  _user_id uuid,
  _badge public.badge_type,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted boolean := false;
  _all_three integer;
BEGIN
  INSERT INTO public.user_badges (user_id, badge_type, metadata)
  VALUES (_user_id, _badge, COALESCE(_metadata, '{}'::jsonb))
  ON CONFLICT (user_id, badge_type) DO NOTHING
  RETURNING true INTO _inserted;

  -- بعد منح أي شارة من الثلاث الأساسية، نتحقق من active_store (الثلاث خلال 24 ساعة)
  IF _inserted AND _badge IN ('first_text','first_image','first_video') THEN
    SELECT COUNT(*) INTO _all_three
    FROM public.user_badges
    WHERE user_id = _user_id
      AND badge_type IN ('first_text','first_image','first_video')
      AND awarded_at >= now() - interval '24 hours';

    IF _all_three >= 3 THEN
      INSERT INTO public.user_badges (user_id, badge_type, metadata)
      VALUES (_user_id, 'active_store', jsonb_build_object('triggered_by', _badge))
      ON CONFLICT (user_id, badge_type) DO NOTHING;
    END IF;
  END IF;

  RETURN _inserted;
END;
$$;

-- Trigger على generations (نص/صورة)
CREATE OR REPLACE FUNCTION public.fn_generations_award_first_win()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL OR NEW.result IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.type::text = 'text' THEN
    PERFORM public.fn_award_badge_if_new(NEW.user_id, 'first_text', jsonb_build_object('generation_id', NEW.id));
  ELSIF NEW.type::text = 'image' THEN
    PERFORM public.fn_award_badge_if_new(NEW.user_id, 'first_image', jsonb_build_object('generation_id', NEW.id));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generations_award_first_win ON public.generations;
CREATE TRIGGER generations_award_first_win
  AFTER INSERT ON public.generations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_generations_award_first_win();

-- Trigger على video_jobs (status='completed')
CREATE OR REPLACE FUNCTION public.fn_video_jobs_award_first_video()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status::text = 'completed' THEN
    PERFORM public.fn_award_badge_if_new(NEW.user_id, 'first_video', jsonb_build_object('video_job_id', NEW.id));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS video_jobs_award_first_video ON public.video_jobs;
CREATE TRIGGER video_jobs_award_first_video
  AFTER INSERT OR UPDATE OF status ON public.video_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_video_jobs_award_first_video();

-- ============================================================
-- RPC: get_user_badges
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_badges(_user_id uuid DEFAULT NULL)
RETURNS TABLE (badge_type public.badge_type, awarded_at timestamptz, metadata jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.badge_type, b.awarded_at, b.metadata
  FROM public.user_badges b
  WHERE b.user_id = COALESCE(_user_id, auth.uid())
    AND (b.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ORDER BY b.awarded_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_user_badges(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_badges(uuid) TO authenticated;

-- ============================================================
-- Realtime publication for user_badges (لـ toast realtime)
-- ============================================================
ALTER TABLE public.user_badges REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_badges;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- RPC: get_onboarding_funnel (للأدمن فقط)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_onboarding_funnel(_days integer DEFAULT 7)
RETURNS TABLE (
  total_started bigint,
  step1_completed bigint,
  step2_completed bigint,
  step3_completed bigint,
  wizard_completed bigint,
  autogen_succeeded bigint,
  autogen_failed bigint,
  active_store_badges bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='started' AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='step_completed' AND step=1 AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='step_completed' AND step=2 AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='step_completed' AND step=3 AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='wizard_completed' AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='autogen_succeeded' AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(DISTINCT user_id) FROM public.onboarding_events WHERE event_type='autogen_failed' AND created_at >= now() - (_days || ' days')::interval),
    (SELECT COUNT(*) FROM public.user_badges WHERE badge_type='active_store' AND awarded_at >= now() - (_days || ' days')::interval);
$$;

REVOKE ALL ON FUNCTION public.get_onboarding_funnel(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_onboarding_funnel(integer) TO authenticated;


-- ==========================================
-- Migration File: 20260502084120_b7d2483c-79f0-45a0-a99a-f087c5963fb9.sql
-- ==========================================

-- ============= Pricing Funnel Tracking =============

-- 1. enum أنواع الأحداث
do $$ begin
  if not exists (select 1 from pg_type where typname = 'pricing_event_type') then
    create type public.pricing_event_type as enum (
      'page_view',
      'annual_toggled',
      'plan_clicked',
      'cta_clicked',
      'converted'
    );
  end if;
end $$;

-- 2. جدول الأحداث
create table if not exists public.pricing_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id text,
  event_type public.pricing_event_type not null,
  plan_id text,
  billing_cycle text check (billing_cycle in ('monthly', 'yearly')),
  variant text default 'control',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pricing_experiments_created on public.pricing_experiments (created_at desc);
create index if not exists idx_pricing_experiments_event on public.pricing_experiments (event_type, created_at desc);
create index if not exists idx_pricing_experiments_user on public.pricing_experiments (user_id) where user_id is not null;

alter table public.pricing_experiments enable row level security;

-- أي زائر يقدر يُدخل (مجهول أو مسجّل)
drop policy if exists "anyone can insert pricing event" on public.pricing_experiments;
create policy "anyone can insert pricing event"
on public.pricing_experiments
for insert
to anon, authenticated
with check (
  -- لو user_id موجود لازم يطابق المستخدم الحالي
  (user_id is null) or (auth.uid() = user_id)
);

-- الأدمن فقط يقرأ
drop policy if exists "admin can read pricing events" on public.pricing_experiments;
create policy "admin can read pricing events"
on public.pricing_experiments
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- 3. دالة الـ funnel للأدمن
create or replace function public.get_pricing_funnel(_days int default 7)
returns table (
  total_views bigint,
  annual_toggles bigint,
  plan_clicks bigint,
  cta_clicks bigint,
  conversions bigint,
  cta_click_rate_pct numeric,
  annual_share_pct numeric,
  top_plan text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _since timestamptz := now() - make_interval(days => _days);
  _views bigint;
  _annual bigint;
  _plan_clicks bigint;
  _cta bigint;
  _conv bigint;
  _top text;
begin
  -- صلاحية الأدمن فقط
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;

  select count(*) into _views
    from public.pricing_experiments
    where event_type = 'page_view' and created_at >= _since;

  select count(*) into _annual
    from public.pricing_experiments
    where event_type = 'annual_toggled'
      and (metadata->>'yearly')::boolean = true
      and created_at >= _since;

  select count(*) into _plan_clicks
    from public.pricing_experiments
    where event_type = 'plan_clicked' and created_at >= _since;

  select count(*) into _cta
    from public.pricing_experiments
    where event_type = 'cta_clicked' and created_at >= _since;

  select count(*) into _conv
    from public.pricing_experiments
    where event_type = 'converted' and created_at >= _since;

  select plan_id into _top
    from public.pricing_experiments
    where event_type in ('plan_clicked', 'cta_clicked')
      and created_at >= _since
      and plan_id is not null
    group by plan_id
    order by count(*) desc
    limit 1;

  return query select
    _views,
    _annual,
    _plan_clicks,
    _cta,
    _conv,
    case when _views > 0 then round((_cta::numeric / _views) * 100, 1) else 0 end,
    case when _views > 0 then round((_annual::numeric / _views) * 100, 1) else 0 end,
    coalesce(_top, '—');
end;
$$;

grant execute on function public.get_pricing_funnel(int) to authenticated;

-- ==========================================
-- Migration File: 20260502084934_3125bd67-cc48-40a5-8fef-58c8dcdb66a9.sql
-- ==========================================

-- Wave C2: Activation Email Sequence
-- جدول تتبع إيميلات التفعيل + RPC للأدمن + pg_cron يومي

-- 1) جدول السجل
CREATE TABLE IF NOT EXISTS public.activation_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_marker smallint NOT NULL CHECK (day_marker IN (0,1,3,7,14)),
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  skipped boolean NOT NULL DEFAULT false,
  skip_reason text,
  opened_at timestamptz,
  clicked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, day_marker)
);

CREATE INDEX IF NOT EXISTS idx_activation_email_log_user ON public.activation_email_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activation_email_log_sent ON public.activation_email_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_activation_email_log_day ON public.activation_email_log(day_marker);

ALTER TABLE public.activation_email_log ENABLE ROW LEVEL SECURITY;

-- المستخدم يرى سجلّه فقط
CREATE POLICY "users_view_own_activation_log"
  ON public.activation_email_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- الإدراج/التحديث محصور بالـ service role (cron + edge function)
CREATE POLICY "service_role_writes_activation_log"
  ON public.activation_email_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 2) RPC تحليلات قمع التفعيل
CREATE OR REPLACE FUNCTION public.get_email_activation_funnel(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  WITH per_day AS (
    SELECT
      day_marker,
      COUNT(*) FILTER (WHERE NOT skipped)                           AS sent,
      COUNT(*) FILTER (WHERE skipped)                               AS skipped,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL)                 AS opened,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)                AS clicked
    FROM public.activation_email_log
    WHERE sent_at >= now() - (_days || ' days')::interval
    GROUP BY day_marker
  )
  SELECT jsonb_build_object(
    'window_days', _days,
    'per_day', COALESCE(jsonb_agg(jsonb_build_object(
      'day', day_marker,
      'sent', sent,
      'skipped', skipped,
      'opened', opened,
      'clicked', clicked,
      'open_rate', CASE WHEN sent > 0 THEN ROUND(opened::numeric * 100 / sent, 1) ELSE 0 END,
      'click_rate', CASE WHEN sent > 0 THEN ROUND(clicked::numeric * 100 / sent, 1) ELSE 0 END
    ) ORDER BY day_marker), '[]'::jsonb),
    'totals', jsonb_build_object(
      'sent', COALESCE(SUM(sent),0),
      'opened', COALESCE(SUM(opened),0),
      'clicked', COALESCE(SUM(clicked),0)
    )
  ) INTO v_result FROM per_day;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_activation_funnel(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_activation_funnel(integer) TO authenticated;

-- 3) pg_cron — يستدعي edge function يومياً 09:00 Riyadh (06:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rifd-activation-emails-daily') THEN
    BEGIN PERFORM cron.unschedule('rifd-activation-emails-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;

SELECT cron.schedule(
  'rifd-activation-emails-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wubcgjuodozhrrigtngs.supabase.co/functions/v1/dispatch-activation-emails',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('triggered_by','pg_cron')
  );
  $$
);

-- ==========================================
-- Migration File: 20260502085154_4960ef61-89b8-4c45-a92c-0903486354b6.sql
-- ==========================================

-- تحديث pg_cron ليستدعي المسار الصحيح في تطبيق رِفد
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rifd-activation-emails-daily') THEN
    BEGIN PERFORM cron.unschedule('rifd-activation-emails-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;

SELECT cron.schedule(
  'rifd-activation-emails-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--694f48b8-26d0-46e8-9443-b81b61c8f1f6.lovable.app/api/public/hooks/activation-sequence',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('triggered_by','pg_cron')
  );
  $$
);

-- ==========================================
-- Migration File: 20260502085654_cb5ebd38-9c25-4a9a-9e7b-4447b36be1e2.sql
-- ==========================================

-- Wave C3: Referrals + Annual Upgrade Loop

-- 1) جدول أكواد الإحالة (واحد لكل مستخدم)
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  uses_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_referral_code"
  ON public.referral_codes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "service_role_writes_referral_codes"
  ON public.referral_codes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2) جدول الإحالات
CREATE TYPE public.referral_status AS ENUM ('pending', 'qualified', 'rewarded');

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code_used text NOT NULL,
  status public.referral_status NOT NULL DEFAULT 'pending',
  reward_points integer NOT NULL DEFAULT 0,
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_user_id <> referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (
    auth.uid() = referrer_user_id
    OR auth.uid() = referred_user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "service_role_writes_referrals"
  ON public.referrals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3) جدول عروض الترقية السنوية
CREATE TABLE IF NOT EXISTS public.annual_upgrade_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shown_at timestamptz NOT NULL DEFAULT now(),
  clicked_at timestamptz,
  upgraded_at timestamptz,
  discount_pct integer NOT NULL DEFAULT 20,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id)
);
ALTER TABLE public.annual_upgrade_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_upgrade_offer"
  ON public.annual_upgrade_offers FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "users_insert_own_upgrade_offer"
  ON public.annual_upgrade_offers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_upgrade_offer"
  ON public.annual_upgrade_offers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) دالة توليد كود إحالة (8 أحرف، فريد، حسّاس بحالة الأحرف)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing text;
  v_code text;
  v_attempts integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT code INTO v_existing FROM public.referral_codes WHERE user_id = v_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    -- 8 chars: A-Z + 0-9 (بدون أحرف ملتبسة O/0/I/1)
    v_code := upper(translate(
      substring(encode(gen_random_bytes(8), 'base64') FROM 1 FOR 8),
      '0OIl1+/=', 'XYZAB'
    ));
    BEGIN
      INSERT INTO public.referral_codes (user_id, code) VALUES (v_user_id, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts > 5 THEN
        RAISE EXCEPTION 'failed to generate unique code';
      END IF;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO authenticated;

-- 5) دالة تسجيل إحالة (يستدعيها المُحال بعد التسجيل)
CREATE OR REPLACE FUNCTION public.claim_referral_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_referrer_id uuid;
  v_existing uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- المستخدم لم يُحَل من قبل
  SELECT id INTO v_existing FROM public.referrals WHERE referred_user_id = v_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  SELECT user_id INTO v_referrer_id FROM public.referral_codes
    WHERE code = upper(_code);
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  INSERT INTO public.referrals (referrer_user_id, referred_user_id, code_used)
  VALUES (v_referrer_id, v_user_id, upper(_code));

  UPDATE public.referral_codes SET uses_count = uses_count + 1
    WHERE user_id = v_referrer_id;

  RETURN jsonb_build_object('ok', true, 'referrer_id', v_referrer_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral_code(text) TO authenticated;

-- 6) Trigger: عند ترقية المُحال لباقة مدفوعة → تأهّل + مكافأة 50pt للمُحيل
CREATE OR REPLACE FUNCTION public.qualify_referral_on_paid_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
BEGIN
  -- فقط عند تغيّر الخطة من free إلى مدفوعة
  IF NEW.plan = 'free' OR (OLD.plan IS NOT NULL AND OLD.plan = NEW.plan) THEN
    RETURN NEW;
  END IF;
  IF OLD.plan IS NOT NULL AND OLD.plan <> 'free' THEN
    RETURN NEW; -- ترقية بين باقات مدفوعة، ليست تأهّل أول
  END IF;

  SELECT referrer_user_id INTO v_referrer_id
    FROM public.referrals
    WHERE referred_user_id = NEW.id AND status = 'pending';
  IF v_referrer_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.referrals
    SET status = 'qualified',
        qualified_at = now(),
        reward_points = 50
    WHERE referred_user_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qualify_referral_on_paid_plan ON public.profiles;
CREATE TRIGGER trg_qualify_referral_on_paid_plan
  AFTER UPDATE OF plan ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.qualify_referral_on_paid_plan();

-- 7) RPC إحصائيات للأدمن
CREATE OR REPLACE FUNCTION public.get_referral_stats(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  WITH r AS (
    SELECT * FROM public.referrals
    WHERE created_at >= now() - (_days || ' days')::interval
  ),
  codes AS (
    SELECT COUNT(*) AS active_codes,
           COALESCE(SUM(uses_count), 0) AS total_uses
    FROM public.referral_codes
  ),
  upgrades AS (
    SELECT
      COUNT(*) AS shown,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
      COUNT(*) FILTER (WHERE upgraded_at IS NOT NULL) AS upgraded
    FROM public.annual_upgrade_offers
    WHERE shown_at >= now() - (_days || ' days')::interval
  ),
  active_referrers AS (
    SELECT COUNT(DISTINCT referrer_user_id) AS n FROM r
  ),
  total_users AS (
    SELECT COUNT(*) AS n FROM auth.users WHERE created_at >= now() - (_days || ' days')::interval
  )
  SELECT jsonb_build_object(
    'window_days', _days,
    'referrals_total', (SELECT COUNT(*) FROM r),
    'referrals_pending', (SELECT COUNT(*) FROM r WHERE status = 'pending'),
    'referrals_qualified', (SELECT COUNT(*) FROM r WHERE status = 'qualified'),
    'referrals_rewarded', (SELECT COUNT(*) FROM r WHERE status = 'rewarded'),
    'active_codes', (SELECT active_codes FROM codes),
    'total_uses', (SELECT total_uses FROM codes),
    'k_factor',
      CASE WHEN (SELECT n FROM total_users) > 0
        THEN ROUND((SELECT COUNT(*) FROM r)::numeric / (SELECT n FROM total_users), 2)
        ELSE 0 END,
    'annual_upgrade', jsonb_build_object(
      'shown', (SELECT shown FROM upgrades),
      'clicked', (SELECT clicked FROM upgrades),
      'upgraded', (SELECT upgraded FROM upgrades),
      'click_rate_pct',
        CASE WHEN (SELECT shown FROM upgrades) > 0
          THEN ROUND((SELECT clicked FROM upgrades)::numeric * 100 / (SELECT shown FROM upgrades), 1)
          ELSE 0 END,
      'upgrade_rate_pct',
        CASE WHEN (SELECT shown FROM upgrades) > 0
          THEN ROUND((SELECT upgraded FROM upgrades)::numeric * 100 / (SELECT shown FROM upgrades), 1)
          ELSE 0 END
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_referral_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(integer) TO authenticated;

