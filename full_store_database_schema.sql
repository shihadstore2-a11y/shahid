-- Consolidated Supabase Schema Migration Script
-- Generated for fresh Supabase database initialization

-- ==========================================
-- Migration File: 20260508171900_a2defb4a-f81f-4b44-8a70-898321c5ecb6.sql
-- ==========================================


-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name_ar TEXT NOT NULL,
  description TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  compatibility JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'SAR',
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  rating NUMERIC(2,1) NOT NULL DEFAULT 5.0,
  sales_count INT NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_bestseller BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product Durations
CREATE TABLE public.product_durations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label_ar TEXT NOT NULL,
  months INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  sale_price NUMERIC(10,2),
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coupons
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_percent INT NOT NULL DEFAULT 0,
  valid_until TIMESTAMPTZ,
  applies_to_duration_min INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_durations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "products_public_read" ON public.products FOR SELECT USING (true);
CREATE POLICY "product_durations_public_read" ON public.product_durations FOR SELECT USING (true);
CREATE POLICY "coupons_public_read_active" ON public.coupons FOR SELECT USING (is_active = true);

-- Indexes
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_bestseller ON public.products(is_bestseller) WHERE is_bestseller = true;
CREATE INDEX idx_durations_product ON public.product_durations(product_id);

-- Seed categories
INSERT INTO public.categories (slug, name_ar, description, sort_order) VALUES
  ('falcon', 'فالكون Falcon', 'باقات فالكون الأقوى في عالم البث الرقمي بجودة 4K واستقرار عالي.', 1),
  ('hulk', 'هولك Hulk', 'باقات هولك بسيرفرات قوية وأسعار منافسة لجميع الأجهزة.', 2),
  ('smarters', 'سمارترز برو Smarters Pro', 'تطبيق سمارترز برو الرسمي مع دعم كل الأجهزة الذكية.', 3),
  ('vulture', 'فولتشر Vulture', 'باقات فولتشر بمحتوى ضخم ودعم فني متواصل.', 4),
  ('annual-offers', 'العروض السنوية', 'أفضل العروض السنوية بأسعار خاصة وتوفير حتى 40%.', 5);

-- Seed products (placeholder data — to be replaced with real list)
INSERT INTO public.products (slug, category_id, name_ar, description, features, compatibility, base_price, sale_price, image_urls, rating, sales_count, is_bestseller, is_featured, sort_order) VALUES
  (
    'falcon-12m',
    (SELECT id FROM public.categories WHERE slug = 'falcon'),
    'اشتراك فالكون 12 شهر',
    'باقة فالكون السنوية بجودة عالية واستقرار ممتاز يدعم جميع الأجهزة.',
    '["+25,000 قناة عالمية","+150,000 فيلم ومسلسل","جودة 4K UHD","سيرفرات قوية مستقرة","تفعيل فوري خلال دقائق","دعم فني 24/7"]'::jsonb,
    '["Smart TV","Android TV","iOS / Apple TV","Windows / Mac","MAG / Formuler"]'::jsonb,
    320, 249, ARRAY['/placeholder.svg']::text[], 4.9, 1240, true, true, 1
  ),
  (
    'falcon-6m',
    (SELECT id FROM public.categories WHERE slug = 'falcon'),
    'اشتراك فالكون 6 أشهر',
    'باقة فالكون النصف سنوية بسعر مميز.',
    '["+25,000 قناة","+150,000 فيلم ومسلسل","جودة 4K","تفعيل فوري"]'::jsonb,
    '["Smart TV","Android TV","iOS","Windows"]'::jsonb,
    180, 149, ARRAY['/placeholder.svg']::text[], 4.8, 540, false, false, 2
  ),
  (
    'hulk-12m',
    (SELECT id FROM public.categories WHERE slug = 'hulk'),
    'اشتراك هولك 12 شهر',
    'باقة هولك السنوية بأفضل سعر في السوق.',
    '["+22,000 قناة","+120,000 فيلم ومسلسل","جودة Full HD","سيرفرات مستقرة","تفعيل فوري"]'::jsonb,
    '["Smart TV","Android","iOS","Windows"]'::jsonb,
    280, 199, ARRAY['/placeholder.svg']::text[], 4.8, 980, true, true, 1
  ),
  (
    'hulk-6m',
    (SELECT id FROM public.categories WHERE slug = 'hulk'),
    'اشتراك هولك 6 أشهر',
    'باقة هولك النصف سنوية.',
    '["+22,000 قناة","+120,000 فيلم","جودة Full HD"]'::jsonb,
    '["Smart TV","Android","iOS"]'::jsonb,
    150, 119, ARRAY['/placeholder.svg']::text[], 4.7, 410, false, false, 2
  ),
  (
    'smarters-12m',
    (SELECT id FROM public.categories WHERE slug = 'smarters'),
    'اشتراك سمارترز برو 12 شهر',
    'تطبيق سمارترز برو الرسمي مع كود تفعيل سنوي.',
    '["تطبيق رسمي مدفوع","يعمل على كل الأجهزة","واجهة عربية","تحديثات مستمرة"]'::jsonb,
    '["iOS","Android","Smart TV","Firestick"]'::jsonb,
    250, 189, ARRAY['/placeholder.svg']::text[], 4.9, 760, true, true, 1
  ),
  (
    'vulture-12m',
    (SELECT id FROM public.categories WHERE slug = 'vulture'),
    'اشتراك فولتشر 12 شهر',
    'باقة فولتشر السنوية بمحتوى متنوع وضخم.',
    '["+20,000 قناة","+100,000 فيلم","جودة 4K","دعم فني"]'::jsonb,
    '["Smart TV","Android","iOS","Windows"]'::jsonb,
    270, 209, ARRAY['/placeholder.svg']::text[], 4.7, 320, false, true, 1
  ),
  (
    'annual-mega-pack',
    (SELECT id FROM public.categories WHERE slug = 'annual-offers'),
    'الباقة السنوية الكبرى',
    'مزيج من أفضل الباقات بسعر خاص لمدة 12 شهر + 3 أشهر هدية.',
    '["3 باقات سنوية مجمعة","3 أشهر مجاناً","تفعيل فوري","ضمان استبدال 24 ساعة"]'::jsonb,
    '["كل الأجهزة"]'::jsonb,
    650, 449, ARRAY['/placeholder.svg']::text[], 5.0, 215, true, true, 1
  );

-- Seed durations
INSERT INTO public.product_durations (product_id, label_ar, months, price, sale_price, is_default, sort_order)
SELECT id, '3 أشهر', 3, ROUND(base_price * 0.4, 0), ROUND(COALESCE(sale_price, base_price) * 0.4, 0), false, 1 FROM public.products WHERE slug LIKE '%-12m';
INSERT INTO public.product_durations (product_id, label_ar, months, price, sale_price, is_default, sort_order)
SELECT id, '6 أشهر', 6, ROUND(base_price * 0.7, 0), ROUND(COALESCE(sale_price, base_price) * 0.7, 0), false, 2 FROM public.products WHERE slug LIKE '%-12m';
INSERT INTO public.product_durations (product_id, label_ar, months, price, sale_price, is_default, sort_order)
SELECT id, '12 شهر', 12, base_price, sale_price, true, 3 FROM public.products WHERE slug LIKE '%-12m';
INSERT INTO public.product_durations (product_id, label_ar, months, price, sale_price, is_default, sort_order)
SELECT id, '12 + 3 شهر هدية', 15, ROUND(base_price * 1.15, 0), ROUND(COALESCE(sale_price, base_price) * 1.10, 0), false, 4 FROM public.products WHERE slug LIKE '%-12m';

-- Seed coupon
INSERT INTO public.coupons (code, discount_percent, valid_until, applies_to_duration_min, is_active) VALUES
  ('SUMMER25', 15, '2026-07-19 23:59:59+03', 12, true);


-- ==========================================
-- Migration File: 20260508174250_d88a37e3-0ffc-47e4-abee-d96694ba0aad.sql
-- ==========================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS icon_key text,
  ADD COLUMN IF NOT EXISTS gradient_key text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS icon_key text,
  ADD COLUMN IF NOT EXISTS gradient_key text;

DELETE FROM public.product_durations;
DELETE FROM public.products;
DELETE FROM public.categories;

-- ==========================================
-- Migration File: 20260508181552_3fc49225-2b77-44dd-9793-8f1aa2dc27a7.sql
-- ==========================================


-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  city TEXT,
  notes TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  vat NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  coupon_code TEXT,
  payment_method TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_phone ON public.orders(customer_phone);
CREATE INDEX idx_orders_number ON public.orders(order_number);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Anyone can create an order (guest checkout supported)
CREATE POLICY "orders_public_insert" ON public.orders
  FOR INSERT TO public WITH CHECK (true);

-- Anyone can read their own order by id (used on success page right after creation)
-- Plus authenticated users can read orders linked to their user_id
CREATE POLICY "orders_owner_read" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Function to claim guest orders by phone after login
CREATE OR REPLACE FUNCTION public.claim_orders_by_phone(_phone TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE public.orders
    SET user_id = auth.uid()
    WHERE user_id IS NULL AND customer_phone = _phone;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Function to fetch a single order by number (public — returns minimal info for tracking)
-- Already protected by knowledge of order number
CREATE OR REPLACE FUNCTION public.get_order_by_number(_order_number TEXT)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  customer_name TEXT,
  total NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id, order_number, customer_name, total, status, created_at
  FROM public.orders
  WHERE order_number = _order_number
  LIMIT 1;
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_touch
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_owner_select" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "profiles_owner_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_owner_update" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_profiles_touch
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==========================================
-- Migration File: 20260508181611_a6faab4b-5381-481c-99a6-046da5c6dd78.sql
-- ==========================================


ALTER FUNCTION public.touch_updated_at() SET search_path = public;

-- Revoke broad execute on security definer functions
REVOKE EXECUTE ON FUNCTION public.claim_orders_by_phone(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_orders_by_phone(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_order_by_number(TEXT) FROM PUBLIC;
-- Keep anon access for order tracking page (only by knowledge of order number)
GRANT EXECUTE ON FUNCTION public.get_order_by_number(TEXT) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- ==========================================
-- Migration File: 20260508184427_3e960132-dd03-412b-a43e-501f350af07b.sql
-- ==========================================


-- Enum للأدوار
CREATE TYPE public.admin_role AS ENUM ('super_admin', 'admin', 'staff', 'developer');

-- جدول admin_users
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.admin_role NOT NULL DEFAULT 'staff',
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX idx_admin_users_role ON public.admin_users(role);

-- جدول admin_audit_logs
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_admin_user ON public.admin_audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.admin_audit_logs(entity_type, entity_id);

-- Helper functions (SECURITY DEFINER لتجنّب RLS recursion)
CREATE OR REPLACE FUNCTION public.get_admin_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.admin_users
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id AND is_active = true AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _changes jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs (admin_user_id, action, entity_type, entity_id, changes)
  SELECT id, _action, _entity_type, _entity_id, _changes
  FROM public.admin_users
  WHERE user_id = auth.uid() AND is_active = true;
END;
$$;

-- Trigger updated_at
CREATE TRIGGER trg_admin_users_touch
BEFORE UPDATE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- admin_users policies
CREATE POLICY "admin_users_self_read"
ON public.admin_users FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "admin_users_super_read_all"
ON public.admin_users FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "admin_users_super_insert"
ON public.admin_users FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "admin_users_super_update"
ON public.admin_users FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "admin_users_super_delete"
ON public.admin_users FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- admin_audit_logs policies
CREATE POLICY "audit_logs_admin_read"
ON public.admin_audit_logs FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- لا policies للـ INSERT/UPDATE/DELETE — يتم فقط عبر log_admin_action() (SECURITY DEFINER)


-- ==========================================
-- Migration File: 20260508192821_a9221847-af6f-494e-9bac-620d0c4cc4c0.sql
-- ==========================================


UPDATE auth.users SET email_confirmed_at = now()
WHERE email = 'thamer585899@gmail.com' AND email_confirmed_at IS NULL;

INSERT INTO public.admin_users (user_id, role, full_name, email, is_active)
SELECT id, 'super_admin'::admin_role, COALESCE(raw_user_meta_data->>'full_name','ثامر'), email, true
FROM auth.users WHERE email = 'thamer585899@gmail.com'
ON CONFLICT DO NOTHING;


-- ==========================================
-- Migration File: 20260512075659_2b09dc7b-4280-4869-853b-daf8d7ce0131.sql
-- ==========================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS duration_months integer;

CREATE INDEX IF NOT EXISTS idx_products_active_category
  ON public.products (category_id, is_active);

-- ==========================================
-- Migration File: 20260513141601_c988f7ed-0871-4e15-a361-6f897c00a528.sql
-- ==========================================

-- 1) Replace INSERT policy with explicit constraints
DROP POLICY IF EXISTS orders_public_insert ON public.orders;
DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;

CREATE POLICY orders_anon_insert ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    customer_name IS NOT NULL
    AND length(btrim(customer_name)) >= 2
    AND length(customer_name) <= 120
    AND customer_phone IS NOT NULL
    AND customer_phone ~ '^05[0-9]{8}$'
    AND total > 0
    AND total <= 10000
    AND jsonb_typeof(items) = 'array'
    AND jsonb_array_length(items) > 0
    AND jsonb_array_length(items) <= 20
    AND status = 'pending'
  );

-- 2) Ensure RLS is on
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3) Rate limit table
CREATE TABLE IF NOT EXISTS public.order_rate_limits (
  phone TEXT PRIMARY KEY,
  last_order_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count_24h INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.order_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only the SECURITY DEFINER trigger touches it.

-- 4) Trigger function: rate-limit by phone (5-minute window)
CREATE OR REPLACE FUNCTION public.check_order_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.order_rate_limits
    WHERE phone = NEW.customer_phone
      AND last_order_at > NOW() - INTERVAL '5 minutes'
  ) THEN
    RAISE EXCEPTION 'rate_limited: too many orders, wait 5 minutes'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.order_rate_limits (phone, last_order_at, count_24h)
  VALUES (NEW.customer_phone, NOW(), 1)
  ON CONFLICT (phone) DO UPDATE
    SET last_order_at = NOW(),
        count_24h = public.order_rate_limits.count_24h + 1;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_order_rate_limit ON public.orders;
CREATE TRIGGER enforce_order_rate_limit
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.check_order_rate_limit();

-- 5) Safe read function for the success page (guests get limited fields by id)
CREATE OR REPLACE FUNCTION public.get_order_by_id(_id uuid)
RETURNS TABLE (
  id uuid,
  order_number text,
  customer_name text,
  customer_phone text,
  total numeric,
  status text,
  created_at timestamptz,
  items jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, order_number, customer_name, customer_phone, total, status, created_at, items
  FROM public.orders
  WHERE id = _id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_id(uuid) TO anon, authenticated;

-- ==========================================
-- Migration File: 20260514111944_cce3d130-d61f-4051-b87d-2a13e43f2510.sql
-- ==========================================


-- 1) Insert hulk-1m
INSERT INTO public.products (
  slug, category_id, name_ar, description, features, compatibility,
  base_price, sale_price, currency, image_urls, rating, sales_count,
  is_featured, is_bestseller, is_active, duration_months, sort_order,
  icon_key, gradient_key
)
SELECT
  'hulk-1m',
  c.id,
  'هولك بلاير — شهر واحد',
  'اشتراك هولك بلاير لمدة شهر واحد — تفعيل سريع وبث رياضي شامل بجودة عالية.',
  '["بث رياضي شامل","جودة HD/4K","تفعيل سريع","دعم فني سريع"]'::jsonb,
  '["Smart TV","Android","iOS","Windows","MAG"]'::jsonb,
  60, 40, 'SAR', '{}', 5.0, 820,
  false, true, true, 1, 1,
  'Mountain', 'hulk'
FROM public.categories c WHERE c.slug = 'hulk'
ON CONFLICT (slug) DO NOTHING;

-- 2) Unify titles + sales_count + bestseller + sort_order
UPDATE public.products SET name_ar = 'هولك بلاير — شهر واحد',     sales_count = 820, is_bestseller = true,  sort_order = 1 WHERE slug = 'hulk-1m';
UPDATE public.products SET name_ar = 'هولك بلاير — 3 أشهر',        sales_count = 510, is_bestseller = false, sort_order = 2 WHERE slug = 'hulk-3m';
UPDATE public.products SET name_ar = 'هولك بلاير — 6 أشهر',        sales_count = 320, is_bestseller = false, sort_order = 3 WHERE slug = 'hulk-6m';
UPDATE public.products SET name_ar = 'هولك بلاير — سنة كاملة',     sales_count = 210, is_bestseller = false, sort_order = 4 WHERE slug = 'hulk-1y';
UPDATE public.products SET name_ar = 'هولك بلاير — سنة | جهازان', sales_count = 135, is_bestseller = false, sort_order = 5 WHERE slug = 'hulk-1y-2dev';


-- ==========================================
-- Migration File: 20260514123452_e3ce3c0b-e4e4-4a21-a838-defbb704d5a2.sql
-- ==========================================

UPDATE public.products SET
  features = '["آلاف القنوات والأفلام والمسلسلات في باقة واحدة","جودة بث تصل إلى 4K Ultra HD","قنوات رياضية ومباريات كأس العالم للمنتخبات","قنوات أفلام، مسلسلات، وثائقية، وأطفال","قوائم EPG ودليل برامج محدّث","تفعيل سريع خلال دقائق بعد الدفع","دعم فني عربي طوال فترة الاشتراك","تجربة مثالية لتجربة الخدمة قبل الالتزام السنوي"]'::jsonb,
  compatibility = '["Smart TV","Android","iOS","Windows","Mac","Fire Stick","Apple TV","MAG"]'::jsonb,
  description = 'اشتراك فالكون برو IPTV لمدة شهر كامل — آلاف القنوات الرياضية والترفيهية والأفلام بدقة تصل إلى 4K. تفعيل سريع، ثبات عالي في البث، ودعم فني عربي. مثالي لتجربة الخدمة.'
WHERE slug = 'falcon-1m';

UPDATE public.products SET
  features = '["3 أشهر اشتراك متواصل بسعر مخفّض","توفير يصل إلى 50 ر.س مقارنة بالاشتراك الشهري","آلاف القنوات الرياضية والترفيهية بجودة 4K","تغطية كاملة لمباريات كأس العالم للمنتخبات","قنوات أفلام ومسلسلات وأطفال ووثائقية","قوائم EPG محدّثة باستمرار","تفعيل سريع خلال دقائق","دعم فني عربي طوال 90 يوماً"]'::jsonb,
  compatibility = '["Smart TV","Android","iOS","Windows","Mac","Fire Stick","Apple TV","MAG"]'::jsonb,
  description = 'اشتراك فالكون برو IPTV لمدة 3 أشهر مع توفير ملموس مقارنة بالشهري. تغطية رياضية شاملة، ثبات في البث، وجودة عالية على جميع الأجهزة الذكية.'
WHERE slug = 'falcon-3m';

UPDATE public.products SET
  features = '["6 أشهر تغطية متواصلة","توفير يصل إلى 120 ر.س مقارنة بالشهري","تغطية موسم رياضي كامل بجودة 4K","قنوات الدوريات الكبرى وكأس العالم للمنتخبات","مكتبة أفلام ومسلسلات حديثة ومتجددة","قنوات وثائقية وأطفال متنوّعة","قوائم EPG ودليل برامج تفاعلي","دعم فني عربي مخصص طوال 6 أشهر"]'::jsonb,
  compatibility = '["Smart TV","Android","iOS","Windows","Mac","Fire Stick","Apple TV","MAG"]'::jsonb,
  description = 'اشتراك فالكون برو IPTV لمدة 6 أشهر — تغطية موسم رياضي كامل مع آلاف القنوات والأفلام بدقة 4K. الخيار المتوازن بين السعر والمدة.'
WHERE slug = 'falcon-6m';

UPDATE public.products SET
  features = '["12 شهر اشتراك متواصل","توفير يصل إلى 240 ر.س مقارنة بالشهري","ثبات تجربة المشاهدة طوال السنة","قنوات رياضية وكأس العالم للمنتخبات بجودة 4K","مكتبة أفلام ومسلسلات متجددة أسبوعياً","قنوات وثائقية، أخبار، أطفال، وتعليمية","قوائم EPG محدّثة ودليل برامج كامل","أولوية في الدعم الفني العربي طوال السنة"]'::jsonb,
  compatibility = '["Smart TV","Android","iOS","Windows","Mac","Fire Stick","Apple TV","MAG"]'::jsonb,
  description = 'اشتراك فالكون برو IPTV لسنة كاملة — تغطية شاملة لجميع المواسم الرياضية وأحدث الأفلام والمسلسلات بدقة 4K. أوفر قيمة سنوية مع ثبات في البث.'
WHERE slug = 'falcon-1y';

UPDATE public.products SET
  features = '["12 شهر اشتراك على جهازين متزامنين","مشاهدة مستقلة لكل فرد في العائلة","توفير مقارنة باشتراكين منفصلين","ثبات تجربة المشاهدة على كلا الجهازين","قنوات رياضية وكأس العالم للمنتخبات بجودة 4K","مكتبة أفلام ومسلسلات متجددة","قنوات أطفال ووثائقية وتعليمية","أولوية في الدعم الفني العربي طوال السنة"]'::jsonb,
  compatibility = '["Smart TV","Android","iOS","Windows","Mac","Fire Stick","Apple TV","MAG"]'::jsonb,
  description = 'اشتراك فالكون برو IPTV لسنة كاملة على جهازين متزامنين — مثالي للعائلات مع مشاهدة مستقلة لكل فرد. تغطية رياضية وترفيهية شاملة بجودة 4K.'
WHERE slug = 'falcon-1y-2dev';

UPDATE public.products SET
  features = '["اشتراك فالكون سنة كاملة","اشتراك هولك سنة كاملة","تغطية محتوى مضاعفة بسعر واحد","توفير يصل إلى 150 ر.س مقارنة بشراء كل اشتراك منفرداً","قنوات رياضية وكأس العالم للمنتخبات بجودة 4K","مكتبتا أفلام ومسلسلات منفصلتان","تنويع كامل بين منصتين مختلفتين","دعم فني عربي طوال السنة لكلا الاشتراكين"]'::jsonb,
  compatibility = '["Smart TV","Android","iOS","Windows","Mac","Fire Stick","Apple TV","MAG"]'::jsonb,
  description = 'حزمة سنوية ذهبية تجمع اشتراك فالكون واشتراك هولك لمدة سنة كاملة. تغطية محتوى مضاعفة بسعر استثنائي مع تنويع بين منصتين مختلفتين.'
WHERE slug = 'bundle-falcon-hulk-1y';

UPDATE public.products SET
  features = '["اشتراك فالكون سنة كاملة على جهازين","اشتراك فولتشر سنة كاملة شامل","تغطية محتوى مضاعفة بسعر واحد","قنوات رياضية وكأس العالم للمنتخبات بجودة 4K","مكتبة أفلام ومسلسلات وقنوات وثائقية","دعم فني عربي طوال السنة لكلا الاشتراكين"]'::jsonb,
  compatibility = '["Smart TV","Android","iOS","Windows","Mac","Fire Stick","Apple TV","MAG"]'::jsonb
WHERE slug = 'bundle-falcon-vulture-1y';

-- ==========================================
-- Migration File: 20260514134155_33422c93-4701-43b5-b4a5-fb6bf4e040c4.sql
-- ==========================================

DELETE FROM public.products WHERE slug IN ('vulture-3m','vulture-6m','vulture-1y','vulture-1y-2dev','bundle-falcon-vulture-1y');
DELETE FROM public.categories WHERE slug = 'vulture';

-- ==========================================
-- Migration File: 20260517060226_6b72ea57-9889-4a47-a7f6-ca7c0aeead9a.sql
-- ==========================================

CREATE POLICY "admin_can_update_orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "admin_can_read_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- ==========================================
-- Migration File: 20260517062437_f1df5251-8ca9-47dd-b915-d0989578dbc7.sql
-- ==========================================

CREATE POLICY "admin_can_update_products"
ON public.products
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ==========================================
-- Migration File: 20260517064229_d765f879-567f-4f91-997c-0fdb7ac1d375.sql
-- ==========================================

CREATE POLICY "admin_can_read_coupons" ON public.coupons FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "admin_can_insert_coupons" ON public.coupons FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "admin_can_update_coupons" ON public.coupons FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "admin_can_delete_coupons" ON public.coupons FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- ==========================================
-- Migration File: 20260517094929_f039d328-cff2-4aa8-8894-696919d5e47d.sql
-- ==========================================

DELETE FROM public.orders WHERE order_number LIKE 'TEST-CUST-%';
DELETE FROM public.order_rate_limits WHERE phone IN ('0512345678','0598765432');

-- ==========================================
-- Migration File: 20260518055544_00e88b30-9405-4667-ba2a-2688722b3105.sql
-- ==========================================

UPDATE public.products
SET features = COALESCE(
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(features) AS elem
    WHERE elem::text NOT ILIKE '%توفير%'
      AND elem::text NOT ILIKE '%وفّر%'
      AND elem::text NOT ILIKE '%وفر %'
  ),
  '[]'::jsonb
)
WHERE features IS NOT NULL
  AND (
    features::text ILIKE '%توفير%'
    OR features::text ILIKE '%وفّر%'
    OR features::text ILIKE '%وفر %'
  );

-- ==========================================
-- Migration File: 20260518081803_b75cb681-0fa1-4f26-b5a6-aef33086d309.sql
-- ==========================================

UPDATE public.products SET sales_count = 1720 WHERE slug = 'falcon-1y';

-- ==========================================
-- Migration File: 20260518091007_73606449-ef7e-4d0c-a248-a17224f7c521.sql
-- ==========================================


-- ============================================================
-- store_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.store_settings (
  key text PRIMARY KEY,
  value text,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_settings_public_read" ON public.store_settings;
CREATE POLICY "store_settings_public_read"
  ON public.store_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "store_settings_admin_insert" ON public.store_settings;
CREATE POLICY "store_settings_admin_insert"
  ON public.store_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "store_settings_admin_update" ON public.store_settings;
CREATE POLICY "store_settings_admin_update"
  ON public.store_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS store_settings_touch ON public.store_settings;
CREATE TRIGGER store_settings_touch
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.store_settings (key, value, description) VALUES
  ('store_name', 'شاهد ستور', 'اسم المتجر يظهر في الـ Header'),
  ('whatsapp_number', '966507305518', 'رقم الواتساب الرسمي'),
  ('contact_email', NULL, 'إيميل التواصل الرسمي'),
  ('telegram_channel', NULL, 'رابط قناة تيليجرام'),
  ('subscriber_count_base', '0', 'الرقم الأساسي لعداد المشتركين'),
  ('telegram_bot_token', NULL, 'Token لـ Telegram Bot'),
  ('telegram_admin_chat_id', NULL, 'Chat ID للأدمن لاستقبال الإشعارات')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- activation_steps
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_type text NOT NULL,
  step_order integer NOT NULL,
  title_ar text NOT NULL,
  description_ar text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_type, step_order)
);

ALTER TABLE public.activation_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activation_steps_public_read_active" ON public.activation_steps;
CREATE POLICY "activation_steps_public_read_active"
  ON public.activation_steps FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "activation_steps_admin_read_all" ON public.activation_steps;
CREATE POLICY "activation_steps_admin_read_all"
  ON public.activation_steps FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "activation_steps_admin_insert" ON public.activation_steps;
CREATE POLICY "activation_steps_admin_insert"
  ON public.activation_steps FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "activation_steps_admin_update" ON public.activation_steps;
CREATE POLICY "activation_steps_admin_update"
  ON public.activation_steps FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "activation_steps_admin_delete" ON public.activation_steps;
CREATE POLICY "activation_steps_admin_delete"
  ON public.activation_steps FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS activation_steps_touch ON public.activation_steps;
CREATE TRIGGER activation_steps_touch
  BEFORE UPDATE ON public.activation_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed 24 steps (نقل حرفي من src/routes/activation-guide.tsx)
INSERT INTO public.activation_steps (device_type, step_order, title_ar, description_ar) VALUES
  ('ios', 1, 'الخطوة 1', 'افتح App Store وابحث عن التطبيق المتفق عليه مع الدعم.'),
  ('ios', 2, 'الخطوة 2', 'ثبّت التطبيق وافتحه.'),
  ('ios', 3, 'الخطوة 3', 'أدخل بيانات التفعيل التي ستصلك من فريق الدعم.'),
  ('ios', 4, 'الخطوة 4', 'اختر الباقة المفضلة وابدأ المشاهدة.'),
  ('android', 1, 'الخطوة 1', 'حمّل التطبيق من Google Play أو من الرابط الذي يرسله الدعم.'),
  ('android', 2, 'الخطوة 2', 'افتح التطبيق وامنحه الصلاحيات الأساسية.'),
  ('android', 3, 'الخطوة 3', 'أدخل بيانات التفعيل المرسلة لك.'),
  ('android', 4, 'الخطوة 4', 'اختر الباقة وابدأ التشغيل.'),
  ('samsung-tv', 1, 'الخطوة 1', 'افتح متجر Samsung Apps في تلفزيونك.'),
  ('samsung-tv', 2, 'الخطوة 2', 'ابحث عن تطبيق المشغّل المتوافق وثبّته.'),
  ('samsung-tv', 3, 'الخطوة 3', 'افتح التطبيق وأدخل بيانات التفعيل المرسلة من الدعم.'),
  ('samsung-tv', 4, 'الخطوة 4', 'اضبط جودة الفيديو حسب سرعة الإنترنت لديك.'),
  ('lg-tv', 1, 'الخطوة 1', 'افتح متجر LG Content Store في تلفزيون LG.'),
  ('lg-tv', 2, 'الخطوة 2', 'ابحث عن تطبيق المشغّل المتوافق وثبّته.'),
  ('lg-tv', 3, 'الخطوة 3', 'افتح التطبيق وأدخل بيانات التفعيل التي ستصلك.'),
  ('lg-tv', 4, 'الخطوة 4', 'اضبط جودة الفيديو حسب سرعة الإنترنت لديك.'),
  ('windows', 1, 'الخطوة 1', 'حمّل المشغّل من الرابط الذي يرسله الدعم.'),
  ('windows', 2, 'الخطوة 2', 'ثبّت البرنامج وشغّله بصلاحيات المستخدم.'),
  ('windows', 3, 'الخطوة 3', 'أدخل رابط التفعيل أو بيانات الدخول.'),
  ('windows', 4, 'الخطوة 4', 'ابدأ التشغيل من قائمة الباقات.'),
  ('mac', 1, 'الخطوة 1', 'حمّل المشغّل المتوافق مع نظام macOS.'),
  ('mac', 2, 'الخطوة 2', 'اسحب التطبيق إلى مجلد Applications وافتحه.'),
  ('mac', 3, 'الخطوة 3', 'أدخل بيانات التفعيل المرسلة لك.'),
  ('mac', 4, 'الخطوة 4', 'ابدأ المشاهدة واضبط الإعدادات حسب رغبتك.')
ON CONFLICT (device_type, step_order) DO NOTHING;

-- ============================================================
-- admin_users: read-all policy + last-super-admin trigger
-- ============================================================
DROP POLICY IF EXISTS "admin_users_admin_read_all" ON public.admin_users;
CREATE POLICY "admin_users_admin_read_all"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_last_super_admin_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_super_count INTEGER;
BEGIN
  -- نسمح إذا لم يكن هناك تغيير في الحالة/الدور
  IF OLD.role = NEW.role AND OLD.is_active = NEW.is_active THEN
    RETURN NEW;
  END IF;

  -- إذا كان OLD super_admin نشط، و NEW لم يعد كذلك
  IF OLD.role = 'super_admin' AND OLD.is_active = true
     AND (NEW.role <> 'super_admin' OR NEW.is_active = false) THEN

    SELECT count(*) INTO active_super_count
    FROM public.admin_users
    WHERE role = 'super_admin' AND is_active = true AND id <> OLD.id;

    IF active_super_count = 0 THEN
      RAISE EXCEPTION 'لا يمكن تعطيل أو تنزيل آخر مشرف عام نشط في النظام'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_super_admin_trigger ON public.admin_users;
CREATE TRIGGER prevent_last_super_admin_trigger
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_super_admin_change();


-- ==========================================
-- Migration File: 20260518092743_e65f5d2f-04b3-4998-aa2a-43d46be4316d.sql
-- ==========================================

UPDATE public.store_settings SET value = '966500451602', updated_at = now() WHERE key = 'whatsapp_number';

-- ==========================================
-- Migration File: 20260519053106_274be571-02da-456e-8414-2f650df5e3e3.sql
-- ==========================================

-- 1) جدول معاملات الدفع (EdfaPay)
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_number TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'edfapay',
  provider_order_id TEXT,        -- معرّف EdfaPay للمعاملة (id من الـ response)
  provider_trans_id TEXT,        -- trans_id من callback
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'initiated',
    -- initiated | redirected | success | failed | cancelled | refunded
  checkout_url TEXT,
  callback_payload JSONB,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_order_number ON public.payment_transactions(order_number);
CREATE INDEX idx_payment_transactions_provider_order_id ON public.payment_transactions(provider_order_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- المشرفون يقرؤون كل المعاملات
CREATE POLICY "payment_transactions_admin_read"
  ON public.payment_transactions FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- المالك يقرأ معاملات طلباته فقط
CREATE POLICY "payment_transactions_owner_read"
  ON public.payment_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payment_transactions.order_id AND o.user_id = auth.uid()
    )
  );

-- لا INSERT/UPDATE/DELETE من المستخدمين (الـ webhook يستخدم service role)

-- trigger لتحديث updated_at
CREATE TRIGGER trg_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- 2) تحديث سياسة orders_anon_insert لتسمح بـ payment_method = 'card' بجانب 'whatsapp'
DROP POLICY IF EXISTS orders_anon_insert ON public.orders;

CREATE POLICY orders_anon_insert
  ON public.orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (customer_name IS NOT NULL)
    AND (length(btrim(customer_name)) >= 2)
    AND (length(customer_name) <= 120)
    AND (customer_phone IS NOT NULL)
    AND (customer_phone ~ '^05[0-9]{8}$'::text)
    AND (total > (0)::numeric)
    AND (total <= (10000)::numeric)
    AND (jsonb_typeof(items) = 'array'::text)
    AND (jsonb_array_length(items) > 0)
    AND (jsonb_array_length(items) <= 20)
    AND (status = 'pending'::text)
    AND (payment_method = ANY (ARRAY['whatsapp'::text, 'card'::text]))
  );

-- 3) دالة آمنة لجلب حالة دفعة عبر order_id (للعرض في صفحة نجاح/فشل)
CREATE OR REPLACE FUNCTION public.get_payment_status(_order_id UUID)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  status TEXT,
  amount NUMERIC,
  provider TEXT,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT order_id, order_number, status, amount, provider, updated_at
  FROM public.payment_transactions
  WHERE order_id = _order_id
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- ==========================================
-- Migration File: 20260519065312_96974e80-8f08-48ee-97ab-19786806dd5c.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS public.store_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_city text,
  product_label text,
  rating integer NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  review_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_reviews_active_order
  ON public.store_reviews(is_active, display_order) WHERE is_active = true;

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_reviews_public_read_active"
ON public.store_reviews FOR SELECT TO anon, authenticated
USING (is_active = true);

CREATE POLICY "store_reviews_admin_all"
ON public.store_reviews FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS store_reviews_touch_updated_at ON public.store_reviews;
CREATE TRIGGER store_reviews_touch_updated_at
BEFORE UPDATE ON public.store_reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.store_reviews (customer_name, customer_city, product_label, rating, review_text, display_order) VALUES
  ('أحمد ع.', 'الرياض', 'فالكون سنة', 5, 'تجربة ممتازة، التفعيل كان سريع جداً والقنوات شغّالة بدون أي مشاكل.', 10),
  ('محمد ف.', 'جدة', 'سمارترز سنة + 3', 5, 'أسعار منافسة ودعم متجاوب في نفس اللحظة، أنصح فيه.', 20),
  ('فهد ن.', 'الدمام', 'هولك 6 شهور', 5, 'جودة عالية واستقرار ممتاز حتى في أوقات المباريات الكبيرة.', 30),
  ('عبدالله', 'مكة', 'فالكون سنة جهازين', 5, 'العرض ممتاز وفّر علي شراء اشتراكين منفصلين، التجديد سهل وسريع.', 40);

-- ==========================================
-- Migration File: 20260519070245_64469797-7323-4a92-9c3c-a0e909a466eb.sql
-- ==========================================


CREATE TABLE IF NOT EXISTS public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_ar text NOT NULL,
  excerpt text,
  content_md text NOT NULL,
  cover_image_url text,
  author text NOT NULL DEFAULT 'فريق شاهد ستور',
  category text,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_published 
  ON public.articles(is_published, published_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "articles_public_read_published"
ON public.articles FOR SELECT TO anon, authenticated
USING (is_published = true);

CREATE POLICY "articles_admin_all"
ON public.articles FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS articles_updated_at ON public.articles;
CREATE TRIGGER articles_updated_at
BEFORE UPDATE ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.increment_article_views(article_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.articles
  SET view_count = view_count + 1
  WHERE slug = article_slug AND is_published = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_article_views(text) TO anon, authenticated;

INSERT INTO public.articles (slug, title_ar, excerpt, content_md, category, is_published, published_at) VALUES
(
  'how-to-activate-iptv',
  'كيف تفعّل اشتراك IPTV على جهازك في 3 خطوات',
  'دليل سريع لتفعيل اشتراكك على أي جهاز — Android، iOS، Smart TV.',
  E'## مقدمة\n\nبعد شراء اشتراكك من شاهد ستور، التفعيل لا يتعدى 3 خطوات بسيطة.\n\n## الخطوة 1: تحميل التطبيق\n\nحمّل التطبيق الموصى به لجهازك:\n\n- **Android:** IPTV Smarters Pro من Play Store\n- **iOS:** GSE Smart IPTV\n- **Smart TV (Samsung/LG):** SmartOne IPTV\n\n## الخطوة 2: استلام البيانات\n\nسنرسل لك بياناتك عبر WhatsApp بعد إكمال الدفع:\n\n- URL الخادم\n- اسم المستخدم\n- كلمة المرور\n\n## الخطوة 3: إدخال البيانات\n\nافتح التطبيق، اضغط Add User، الصق البيانات، وابدأ المشاهدة.\n\n---\n\nأي مشكلة؟ تواصل معنا واتساب على مدار الساعة.',
  'دروس',
  true,
  now() - interval '2 days'
),
(
  'world-cup-2026-channels',
  'كل قنوات كأس العالم على شاهد ستور',
  'قائمة شاملة بقنوات البث المباشر لمباريات كأس العالم للمنتخبات.',
  E'## كأس العالم على شاهد ستور\n\nاستمتع بمتابعة كل المباريات بجودة عالية على باقات شاهد ستور.\n\n## القنوات المتاحة\n\n- **beIN Sports** القنوات الرياضية الكاملة\n- **Saudi Sports** البث المحلي\n- **Sky Sports** للتعليق الإنجليزي\n- **ESPN** تحليلات احترافية\n\n## الباقات الموصى بها\n\nلتجربة كأس العالم الكاملة:\n\n- فالكون سنة كاملة\n- سمارترز سنة + 3 شاشات للعائلة\n- هولك 6 شهور للمدى القصير\n\nاطلب الآن واستمتع بكأس العالم بأفضل تجربة.',
  'أخبار',
  true,
  now() - interval '5 days'
)
ON CONFLICT (slug) DO NOTHING;


-- ==========================================
-- Migration File: 20260519074446_d62cc421-c951-4704-a577-2f18d9efde8a.sql
-- ==========================================

UPDATE public.activation_steps SET title_ar = 'استلم بيانات الاشتراك', description_ar = 'بعد إتمام الدفع في شاهد ستور، تصلك بيانات التفعيل (اسم المستخدم وكلمة المرور أو ملف M3U) مباشرةً عبر البريد الإلكتروني والواتساب. احتفظ بها في مكان آمن قبل البدء في خطوات التثبيت.' WHERE id = 'cfd89d9b-fa94-49d7-96e1-76b1f861db6c';

UPDATE public.activation_steps SET title_ar = 'ثبّت تطبيق Downloader', description_ar = 'افتح متجر التطبيقات على جهازك (Google Play على شاشات الأندرويد / Mi Store على أجهزة شاومي / Amazon Appstore على Fire TV) ثم ابحث عن تطبيق ''Downloader'' من المطور AFTVnews وقم بتثبيته. يُستخدم هذا التطبيق لتحميل المشغّل بشكل آمن على الأجهزة التي لا يتوفّر فيها المشغّل مباشرةً في المتجر.' WHERE id = '1914ce04-407b-4d2f-9dc2-ffc23ef41e91';

UPDATE public.activation_steps SET title_ar = 'حمّل تطبيق المشغّل المناسب لاشتراكك', description_ar = 'افتح Downloader ثم أدخل الكود أو الرابط الذي أرسله لك فريق الدعم في خانة البحث (يختلف الكود حسب الباقة: فالكون / هولك / سمارترز). انتظر اكتمال التحميل ثم اضغط Install لتثبيت التطبيق على جهازك.' WHERE id = 'be67117c-1c84-4c54-a441-e5f916564c53';

UPDATE public.activation_steps SET title_ar = 'سجّل الدخول وفعّل اشتراكك', description_ar = 'افتح المشغّل بعد التثبيت — ستظهر لك صفحة تسجيل الدخول. أدخل اسم المستخدم وكلمة المرور (أو رابط M3U) كما وردت لك من شاهد ستور ثم اضغط Login. يتم تفعيل اشتراكك تلقائياً خلال ثوانٍ.' WHERE id = '8c2809c8-7723-4602-8722-f2d590d763dd';

INSERT INTO public.activation_steps (device_type, step_order, title_ar, description_ar, is_active) VALUES ('android', 5, 'اضبط الجودة وابدأ المشاهدة', 'بعد التفعيل تظهر لك مكتبة القنوات المباشرة والأفلام والمسلسلات وقنوات الرياضة. من إعدادات المشغّل اضبط جودة الفيديو (HD / FHD / 4K) بما يتناسب مع سرعة الإنترنت لديك (يُفضّل 25Mbps فأعلى لجودة 4K). لأي مشكلة في التشغيل تواصل مع الدعم عبر الواتساب.', true);

-- ==========================================
-- Migration File: 20260519074942_827c280b-486e-4b0c-bbce-cbd6f9ac7e7b.sql
-- ==========================================

ALTER TABLE public.activation_steps ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE public.activation_steps SET image_url = '/activation/android/step-1.jpg' WHERE id = 'cfd89d9b-fa94-49d7-96e1-76b1f861db6c';
UPDATE public.activation_steps SET image_url = '/activation/android/step-2.png' WHERE id = '1914ce04-407b-4d2f-9dc2-ffc23ef41e91';
UPDATE public.activation_steps SET image_url = '/activation/android/step-4.jpg' WHERE id = '8c2809c8-7723-4602-8722-f2d590d763dd';
UPDATE public.activation_steps SET image_url = '/activation/android/step-5.jpg' WHERE device_type = 'android' AND step_order = 5;

-- ==========================================
-- Migration File: 20260519081102_be46d619-11b6-4cb0-afed-d63a135bdbd5.sql
-- ==========================================


-- مسح كل خطوات التفعيل القديمة وإعادة بنائها بدليل سعودي موحّد (6 أجهزة × 5 خطوات)
DELETE FROM public.activation_steps;

INSERT INTO public.activation_steps (device_type, step_order, title_ar, description_ar, image_url, is_active) VALUES
-- iOS
('ios', 1, 'استلم بياناتك',
 'بعد إتمام طلبك من شاهد ستور، تصلك بيانات التفعيل (اسم المستخدم وكلمة المرور ورمز الخادم) عبر البريد الإلكتروني والواتساب خلال دقائق. احتفظ بها أمامك للخطوة التالية.',
 '/activation/ios/step-1.jpg', true),
('ios', 2, 'افتح App Store على جهازك',
 'من شاشة جهاز الآيفون أو الآيباد، افتح متجر التطبيقات App Store، ثم اكتب في خانة البحث اسم تطبيق المشغّل الذي يصلك ضمن بياناتك.',
 '/activation/ios/step-2.jpg', true),
('ios', 3, 'ثبّت تطبيق المشغّل',
 'اضغط على زر "Get" أو "تنزيل" لتثبيت التطبيق. انتظر حتى تنتهي عملية التثبيت ثم افتح التطبيق من الشاشة الرئيسية.',
 '/activation/ios/step-3.jpg', true),
('ios', 4, 'سجّل دخولك بالبيانات',
 'في شاشة تسجيل الدخول أدخل: اسم المستخدم (Username)، كلمة المرور (Password)، ورمز الخادم (Server) كما أُرسلت لك. ثم اضغط زر تسجيل الدخول.',
 '/activation/ios/step-4.jpg', true),
('ios', 5, 'ابدأ المشاهدة',
 'بعد تسجيل الدخول، تظهر مكتبتك الكاملة: قنوات مباشرة، أفلام، مسلسلات، وقنوات رياضة. اختر ما تريد وابدأ المشاهدة فوراً.',
 '/activation/ios/step-5.jpg', true),

-- Android
('android', 1, 'استلم بياناتك',
 'بعد إتمام طلبك من شاهد ستور، تصلك بيانات التفعيل (اسم المستخدم وكلمة المرور ورابط التحميل) عبر البريد الإلكتروني والواتساب خلال دقائق. احتفظ بها أمامك.',
 '/activation/android/step-1.jpg', true),
('android', 2, 'افتح متجر التطبيقات على جهازك',
 'من شاشة الأندرويد أو جهاز شاومي، افتح متجر التطبيقات (Google Play أو Mi Store) وابحث عن تطبيق "Downloader" ثم ثبّته.',
 '/activation/android/step-2.png', true),
('android', 3, 'ثبّت تطبيق المشغّل عبر Downloader',
 'افتح Downloader، أدخل الرابط أو الكود الذي يصلك مع بياناتك، ثم اضغط GO. سيُنزَّل تطبيق المشغّل تلقائياً ويُثبَّت على جهازك.',
 '/activation/android/step-3.jpg', true),
('android', 4, 'سجّل دخولك بالبيانات',
 'افتح تطبيق المشغّل بعد التثبيت. أدخل اسم المستخدم وكلمة المرور كما أُرسلت لك، ثم اضغط زر تسجيل الدخول.',
 '/activation/android/step-4-v2.jpg', true),
('android', 5, 'ابدأ المشاهدة',
 'بعد تسجيل الدخول، تظهر مكتبتك الكاملة: قنوات مباشرة، أفلام، مسلسلات، وقنوات رياضة. اختر ما تريد وابدأ المشاهدة.',
 '/activation/android/step-5-v2.jpg', true),

-- Samsung TV
('samsung-tv', 1, 'استلم بياناتك',
 'بعد إتمام طلبك من شاهد ستور، تصلك تعليمات التفعيل لشاشة سامسونج (اسم التطبيق وطريقة الربط) عبر البريد الإلكتروني والواتساب خلال دقائق.',
 '/activation/samsung-tv/step-1.jpg', true),
('samsung-tv', 2, 'افتح متجر Samsung Apps',
 'من الشاشة الرئيسية لتلفزيون سامسونج، افتح متجر التطبيقات Samsung Apps وابحث عن اسم تطبيق المشغّل المرسل لك.',
 '/activation/samsung-tv/step-2.jpg', true),
('samsung-tv', 3, 'ثبّت التطبيق وافتحه',
 'اضغط على تثبيت وانتظر حتى ينتهي التحميل. بعدها افتح التطبيق من قائمة تطبيقاتك على التلفزيون.',
 '/activation/samsung-tv/step-3.jpg', true),
('samsung-tv', 4, 'أرسل بيانات الجهاز للدعم',
 'عند فتح التطبيق لأول مرة، تظهر شاشة تحتوي على Device ID ومفتاح الجهاز Device Key. صوّر الشاشة بجوّالك وأرسل الصورة للدعم عبر الواتساب.',
 '/activation/samsung-tv/step-4.jpg', true),
('samsung-tv', 5, 'يُفعَّل اشتراكك ويبدأ البث',
 'يقوم فريق الدعم بربط اشتراكك بشاشتك خلال دقائق دون أي إعدادات إضافية منك. أعد فتح التطبيق وستظهر لك المكتبة كاملة جاهزة للمشاهدة.',
 '/activation/samsung-tv/step-5.jpg', true),

-- LG TV
('lg-tv', 1, 'استلم بياناتك',
 'بعد إتمام طلبك من شاهد ستور، تصلك تعليمات التفعيل لشاشة LG (اسم التطبيق وطريقة الربط) عبر البريد الإلكتروني والواتساب خلال دقائق.',
 '/activation/lg-tv/step-1.jpg', true),
('lg-tv', 2, 'افتح متجر LG Content Store',
 'من الشاشة الرئيسية لتلفزيون LG، افتح متجر التطبيقات LG Content Store وابحث عن اسم تطبيق المشغّل المرسل لك.',
 '/activation/lg-tv/step-2.jpg', true),
('lg-tv', 3, 'ثبّت التطبيق وافتحه',
 'اضغط على تثبيت وانتظر حتى ينتهي التحميل. بعدها افتح التطبيق من قائمة تطبيقاتك على التلفزيون.',
 '/activation/lg-tv/step-3.jpg', true),
('lg-tv', 4, 'أرسل بيانات الجهاز للدعم',
 'عند فتح التطبيق لأول مرة، تظهر شاشة تحتوي على Device ID ومفتاح الجهاز Device Key. صوّر الشاشة بجوّالك وأرسل الصورة للدعم عبر الواتساب.',
 '/activation/lg-tv/step-4.jpg', true),
('lg-tv', 5, 'يُفعَّل اشتراكك ويبدأ البث',
 'يقوم فريق الدعم بربط اشتراكك بشاشتك خلال دقائق دون أي إعدادات إضافية منك. أعد فتح التطبيق وستظهر لك المكتبة كاملة جاهزة للمشاهدة.',
 '/activation/lg-tv/step-5.jpg', true),

-- Windows
('windows', 1, 'استلم بياناتك',
 'بعد إتمام طلبك من شاهد ستور، تصلك بيانات التفعيل (اسم المستخدم وكلمة المرور ورابط تحميل المشغّل) عبر البريد الإلكتروني والواتساب خلال دقائق.',
 '/activation/windows/step-1.jpg', true),
('windows', 2, 'حمّل المشغّل من الرابط المرسل',
 'افتح الرابط المرسل لك من المتصفح. سيبدأ تحميل ملف التثبيت تلقائياً. انتظر حتى ينتهي التحميل.',
 '/activation/windows/step-2.jpg', true),
('windows', 3, 'ثبّت البرنامج وافتحه',
 'افتح ملف التثبيت الذي حمّلته، واتبع خطوات المُثبِّت حتى تظهر شاشة المشغّل.',
 '/activation/windows/step-3.jpg', true),
('windows', 4, 'سجّل دخولك بالبيانات',
 'أدخل اسم المستخدم وكلمة المرور كما أُرسلت لك، ثم اضغط زر تسجيل الدخول.',
 '/activation/windows/step-4.jpg', true),
('windows', 5, 'ابدأ المشاهدة',
 'بعد تسجيل الدخول، تظهر مكتبتك الكاملة: قنوات مباشرة، أفلام، مسلسلات، وقنوات رياضة. اختر ما تريد وابدأ المشاهدة.',
 '/activation/windows/step-5.jpg', true),

-- Mac
('mac', 1, 'استلم بياناتك',
 'بعد إتمام طلبك من شاهد ستور، تصلك بيانات التفعيل (اسم المستخدم وكلمة المرور ورابط تحميل المشغّل) عبر البريد الإلكتروني والواتساب خلال دقائق.',
 '/activation/mac/step-1.jpg', true),
('mac', 2, 'حمّل المشغّل المتوافق مع macOS',
 'افتح الرابط المرسل لك في متصفح Safari أو Chrome. سيبدأ تحميل ملف dmg تلقائياً.',
 '/activation/mac/step-2.jpg', true),
('mac', 3, 'اسحب التطبيق إلى مجلد Applications',
 'افتح ملف dmg الذي حمّلته، ثم اسحب أيقونة التطبيق إلى مجلد Applications. افتح التطبيق من Launchpad.',
 '/activation/mac/step-3.jpg', true),
('mac', 4, 'سجّل دخولك بالبيانات',
 'أدخل اسم المستخدم وكلمة المرور كما أُرسلت لك، ثم اضغط زر تسجيل الدخول.',
 '/activation/mac/step-4.jpg', true),
('mac', 5, 'ابدأ المشاهدة',
 'بعد تسجيل الدخول، تظهر مكتبتك الكاملة: قنوات مباشرة، أفلام، مسلسلات، وقنوات رياضة. اختر ما تريد وابدأ المشاهدة.',
 '/activation/mac/step-5.jpg', true);


-- ==========================================
-- Migration File: 20260519082126_acc667ea-ee1d-428c-8ec1-bdaf7282cb1e.sql
-- ==========================================

UPDATE activation_steps SET image_url = '/activation/android/step-2.jpg' WHERE device_type='android' AND step_order=2;
UPDATE activation_steps SET image_url = '/activation/android/step-4.jpg' WHERE device_type='android' AND step_order=4;
UPDATE activation_steps SET image_url = '/activation/android/step-5.jpg' WHERE device_type='android' AND step_order=5;

-- ==========================================
-- Migration File: 20260519093053_2ec8bdba-3f1a-4c85-8a1e-f6adb6e22cad.sql
-- ==========================================


-- Create public bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for product images
CREATE POLICY "product_images_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Admin write/update/delete only
CREATE POLICY "product_images_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.is_admin(auth.uid()));

CREATE POLICY "product_images_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'product-images' AND public.is_admin(auth.uid()));

CREATE POLICY "product_images_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin(auth.uid()));


-- ==========================================
-- Migration File: 20260520063415_99c08f3b-c52a-4a90-a61d-01e1dfa5e280.sql
-- ==========================================

ALTER TYPE public.admin_role ADD VALUE IF NOT EXISTS 'orders_coupons_viewer';

-- ==========================================
-- Migration File: 20260520064636_ffb948b0-692c-4d3d-b93d-34f9c2b95f07.sql
-- ==========================================

-- إضافة دالة can_modify_data: تستثني دور orders_coupons_viewer من التعديل
CREATE OR REPLACE FUNCTION public.can_modify_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id
      AND is_active = true
      AND role IN ('super_admin','admin','developer','staff')
  );
$$;

-- ── coupons: قراءة للمشاهد، تعديل للدوار المعدِّلة فقط ──
DROP POLICY IF EXISTS admin_can_insert_coupons ON public.coupons;
DROP POLICY IF EXISTS admin_can_update_coupons ON public.coupons;
DROP POLICY IF EXISTS admin_can_delete_coupons ON public.coupons;

CREATE POLICY admin_can_insert_coupons ON public.coupons
  FOR INSERT TO authenticated
  WITH CHECK (public.can_modify_data(auth.uid()));

CREATE POLICY admin_can_update_coupons ON public.coupons
  FOR UPDATE TO authenticated
  USING (public.can_modify_data(auth.uid()))
  WITH CHECK (public.can_modify_data(auth.uid()));

CREATE POLICY admin_can_delete_coupons ON public.coupons
  FOR DELETE TO authenticated
  USING (public.can_modify_data(auth.uid()));

-- ── orders: التعديل للدوار المعدِّلة فقط ──
DROP POLICY IF EXISTS admin_can_update_orders ON public.orders;

CREATE POLICY admin_can_update_orders ON public.orders
  FOR UPDATE TO authenticated
  USING (public.can_modify_data(auth.uid()))
  WITH CHECK (public.can_modify_data(auth.uid()));

-- ── products: تعديل المنتجات للدوار المعدِّلة فقط ──
DROP POLICY IF EXISTS admin_can_update_products ON public.products;

CREATE POLICY admin_can_update_products ON public.products
  FOR UPDATE TO authenticated
  USING (public.can_modify_data(auth.uid()))
  WITH CHECK (public.can_modify_data(auth.uid()));

-- ==========================================
-- Migration File: 20260520172338_0bd9480d-f07f-4b44-8816-6ce3afccbded.sql
-- ==========================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('activation-step-images', 'activation-step-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "activation_images_public_read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'activation-step-images');

CREATE POLICY "activation_images_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'activation-step-images'
  AND public.is_admin(auth.uid())
);

CREATE POLICY "activation_images_admin_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'activation-step-images'
  AND public.is_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'activation-step-images'
  AND public.is_admin(auth.uid())
);

CREATE POLICY "activation_images_admin_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'activation-step-images'
  AND public.is_admin(auth.uid())
);

-- ==========================================
-- Migration File: 20260522083254_237525cd-8358-4288-a592-a57c27e7a606.sql
-- ==========================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS whatsapp_messages_sent JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.orders.whatsapp_messages_sent IS
  'Array of {template, sent_at, sent_by} entries logged when admin opens wa.me link from admin panel';

-- ==========================================
-- Migration File: 20260522155823_c9e528a3-b440-44bd-adba-62fc76727f33.sql
-- ==========================================

DELETE FROM coupons WHERE code = 'EDFA_TEST_95';

-- ==========================================
-- Migration File: 20260522162326_aea49b44-1c3b-46f3-bb9a-bb6b5f6a784f.sql
-- ==========================================

-- Step 2.1: CHECK constraint on orders.status
ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check
CHECK (status IN ('pending', 'initiated', 'paid', 'payment_failed', 'cancelled', 'failed', 'refunded', 'fulfilled'));

-- Step 2.2: Partial UNIQUE index on payment_transactions.provider_trans_id
CREATE UNIQUE INDEX idx_payment_transactions_provider_trans_id_unique
ON public.payment_transactions (provider_trans_id)
WHERE provider_trans_id IS NOT NULL;

-- ==========================================
-- Migration File: 20260523065928_40ee2687-51c7-458a-970a-9c0c1e300323.sql
-- ==========================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subscription_username TEXT NULL,
  ADD COLUMN IF NOT EXISTS subscription_password TEXT NULL,
  ADD COLUMN IF NOT EXISTS subscription_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS subscription_extra_info JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS fulfilled_by UUID NULL REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credentials_sent_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_orders_fulfilled
  ON public.orders(fulfilled_at DESC)
  WHERE fulfilled_at IS NOT NULL;

-- ==========================================
-- Migration File: 20260523094827_4bd7a174-b07c-4678-ad9f-8fb5dcc7b891.sql
-- ==========================================

DELETE FROM admin_audit_logs WHERE action LIKE 'debug_td27%';

-- ==========================================
-- Migration File: 20260523112206_9deeb778-a99b-4632-ae51-db8f6cf27388.sql
-- ==========================================

UPDATE public.orders SET user_id = NULL, status = 'pending' WHERE id IN ('264d8e73-396e-4fea-ab81-bf8f9aac3eb1','00b912d8-4502-4b4f-a21c-0595d5857731');

-- ==========================================
-- Migration File: 20260524085524_8e1742a4-7a12-46a1-b9bb-8f1576d96d81.sql
-- ==========================================

-- ════════════════════════════════════════════════════════════════
-- 🗑️ A.4 Pre-Cleanup — 23 May 2026
-- ════════════════════════════════════════════════════════════════
-- Author: PM Ahmed (via Lovable agent)
-- Deletes: 16 test orders + 16 payment_transactions
-- Protected (NOT deleted): LG-260522-9296 (production EdfaPay, 5 SAR),
--                          LG-260522-7901 (ثامر, 70 SAR),
--                          admin_audit_logs, SUMMER25 coupon
-- Restore snapshot (16 orders + 16 tx, full row values):
--   docs/snapshots/a4-pre-cleanup-2026-05-23.sql
-- Atomicity: Supabase wraps every migration in a single transaction;
--            any failure (including the safety assertions below) rolls
--            back the entire DELETE.
-- ════════════════════════════════════════════════════════════════

DELETE FROM public.payment_transactions
WHERE order_id IN (
  '8cb3d4ef-7d0c-40ed-9908-8cdd40248349','264d8e73-396e-4fea-ab81-bf8f9aac3eb1',
  '5c33cc17-7cdf-4ecc-a6b3-e3b1a1054bf9','f7b234d1-4680-44c9-a2b7-64ed672be3be',
  'e37b59e0-8ef6-4581-a082-9a5f19d9f834','00b912d8-4502-4b4f-a21c-0595d5857731',
  '7288a1de-e5b5-4928-9994-e4c9276efa32','697a8f6c-0552-4218-96e0-96806cc868be',
  'c1765ac2-f0dc-48a5-8f5a-d3be554b8764','4bd567ad-abb5-493e-b9fc-d552062802d0',
  'c21ba9e6-4fa5-47f4-bf35-483b3998a4ef','e80598ff-7a89-4b77-8080-d4a4417dc8b2',
  'd5302229-fd0d-4a07-a5dc-08753bc01142','c44eab18-1588-4613-8e65-b016cf168eac',
  '06e70464-dc59-449c-b390-4f66cb1c6509','9225b9dc-895a-4237-a9b0-39eb7263cbde'
);

DELETE FROM public.orders
WHERE id IN (
  '8cb3d4ef-7d0c-40ed-9908-8cdd40248349','264d8e73-396e-4fea-ab81-bf8f9aac3eb1',
  '5c33cc17-7cdf-4ecc-a6b3-e3b1a1054bf9','f7b234d1-4680-44c9-a2b7-64ed672be3be',
  'e37b59e0-8ef6-4581-a082-9a5f19d9f834','00b912d8-4502-4b4f-a21c-0595d5857731',
  '7288a1de-e5b5-4928-9994-e4c9276efa32','697a8f6c-0552-4218-96e0-96806cc868be',
  'c1765ac2-f0dc-48a5-8f5a-d3be554b8764','4bd567ad-abb5-493e-b9fc-d552062802d0',
  'c21ba9e6-4fa5-47f4-bf35-483b3998a4ef','e80598ff-7a89-4b77-8080-d4a4417dc8b2',
  'd5302229-fd0d-4a07-a5dc-08753bc01142','c44eab18-1588-4613-8e65-b016cf168eac',
  '06e70464-dc59-449c-b390-4f66cb1c6509','9225b9dc-895a-4237-a9b0-39eb7263cbde'
);

-- ════════════════════════════════════════════════════════════════
-- 🛡️ SAFETY ASSERTIONS — any RAISE EXCEPTION rolls back everything
-- ════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_9296 int; v_7901 int; v_remaining int; v_audit int;
BEGIN
  SELECT count(*) INTO v_9296 FROM public.orders WHERE order_number = 'LG-260522-9296';
  IF v_9296 <> 1 THEN RAISE EXCEPTION 'SAFETY FAIL: protected order 9296 missing'; END IF;

  SELECT count(*) INTO v_7901 FROM public.orders WHERE order_number = 'LG-260522-7901';
  IF v_7901 <> 1 THEN RAISE EXCEPTION 'SAFETY FAIL: protected order 7901 missing'; END IF;

  SELECT count(*) INTO v_remaining FROM public.orders WHERE id IN (
    '8cb3d4ef-7d0c-40ed-9908-8cdd40248349','264d8e73-396e-4fea-ab81-bf8f9aac3eb1',
    '5c33cc17-7cdf-4ecc-a6b3-e3b1a1054bf9','f7b234d1-4680-44c9-a2b7-64ed672be3be',
    'e37b59e0-8ef6-4581-a082-9a5f19d9f834','00b912d8-4502-4b4f-a21c-0595d5857731',
    '7288a1de-e5b5-4928-9994-e4c9276efa32','697a8f6c-0552-4218-96e0-96806cc868be',
    'c1765ac2-f0dc-48a5-8f5a-d3be554b8764','4bd567ad-abb5-493e-b9fc-d552062802d0',
    'c21ba9e6-4fa5-47f4-bf35-483b3998a4ef','e80598ff-7a89-4b77-8080-d4a4417dc8b2',
    'd5302229-fd0d-4a07-a5dc-08753bc01142','c44eab18-1588-4613-8e65-b016cf168eac',
    '06e70464-dc59-449c-b390-4f66cb1c6509','9225b9dc-895a-4237-a9b0-39eb7263cbde'
  );
  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'SAFETY FAIL: % of the 16 target IDs still present after DELETE', v_remaining;
  END IF;

  SELECT count(*) INTO v_audit FROM public.admin_audit_logs;
  RAISE NOTICE 'A.4 OK — 9296 alive, 7901 alive, 16 test orders gone, admin_audit_logs=%', v_audit;
END$$;

-- ==========================================
-- Migration File: 20260524103652_814f425f-a874-4379-86e5-1132639e9d60.sql
-- ==========================================

-- ════════════════════════════════════════════════
-- 📦 Phase B.4 — DROP product_durations (legacy)
-- 🔒 Phase B.3 — REVOKE anon from claim_orders_by_phone
-- ════════════════════════════════════════════════
-- Date: 23 May 2026
-- Pre-conditions verified:
--   ✅ 0 rows in product_durations
--   ✅ Only FK is self-outgoing → products(id) (auto-dropped)
--   ✅ Code references removed (queries.ts + types.ts)
--   ✅ claim_orders_by_phone requires auth.uid() anyway
-- ════════════════════════════════════════════════

-- B.4b: DROP legacy table
DROP TABLE IF EXISTS public.product_durations;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_durations'
  ) THEN
    RAISE EXCEPTION 'B.4 FAILED: table still exists';
  END IF;
  RAISE NOTICE 'B.4 OK — product_durations dropped successfully';
END$$;

-- B.3: REVOKE anon EXECUTE on claim_orders_by_phone
REVOKE EXECUTE ON FUNCTION public.claim_orders_by_phone(text) FROM anon;

DO $$
DECLARE
  v_acl TEXT;
BEGIN
  SELECT COALESCE(array_to_string(proacl, ', '), '<default>') INTO v_acl
  FROM pg_proc
  WHERE proname = 'claim_orders_by_phone'
    AND pronamespace = 'public'::regnamespace;

  IF v_acl LIKE '%anon=%' THEN
    RAISE EXCEPTION 'B.3 FAILED: anon still present in ACL: %', v_acl;
  END IF;

  RAISE NOTICE 'B.3 OK — anon access revoked. Final ACL: %', v_acl;
END$$;

-- ==========================================
-- Migration File: 20260524111219_65610801-995c-46d3-858b-ec884abd91eb.sql
-- ==========================================

-- ════════════════════════════════════════════════
-- Phase F.2 — claim_orders_by_email RPC
-- ════════════════════════════════════════════════

-- Step 1: Function
CREATE OR REPLACE FUNCTION public.claim_orders_by_email(_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
  caller_uid uuid;
BEGIN
  caller_uid := auth.uid();

  IF caller_uid IS NULL THEN
    RETURN 0;
  END IF;

  IF _email IS NULL OR trim(_email) = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.orders
    SET user_id = caller_uid,
        updated_at = NOW()
    WHERE user_id IS NULL
      AND lower(trim(customer_email)) = lower(trim(_email));

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Step 2: Permissions
REVOKE ALL ON FUNCTION public.claim_orders_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_orders_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_orders_by_email(text) TO authenticated;

-- Step 3: Partial functional index
CREATE INDEX IF NOT EXISTS idx_orders_customer_email_lower
  ON public.orders (lower(customer_email))
  WHERE customer_email IS NOT NULL;

-- Step 4: Documentation
COMMENT ON FUNCTION public.claim_orders_by_email(text) IS
'Links orphan orders (user_id IS NULL) to authenticated user via case-insensitive email matching. Returns count of linked orders. Called from useAuth onAuthStateChange (Phase F.5).';

-- Step 5: Safety assertions
DO $$
DECLARE
  v_acl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'claim_orders_by_email'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'F.2 FAILED: function not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_orders_customer_email_lower'
  ) THEN
    RAISE EXCEPTION 'F.2 FAILED: index not created';
  END IF;

  SELECT array_to_string(proacl, ', ') INTO v_acl
  FROM pg_proc
  WHERE proname = 'claim_orders_by_email'
    AND pronamespace = 'public'::regnamespace;

  IF v_acl LIKE '%anon=%' THEN
    RAISE EXCEPTION 'F.2 FAILED: anon still has access (acl=%)', v_acl;
  END IF;

  IF v_acl NOT LIKE '%authenticated=%' THEN
    RAISE EXCEPTION 'F.2 FAILED: authenticated missing EXECUTE (acl=%)', v_acl;
  END IF;

  RAISE NOTICE 'F.2 OK — claim_orders_by_email + index + permissions verified';
END$$;

-- ==========================================
-- Migration File: 20260524112153_dbeeadbe-c5a5-4077-9654-d01569af5cd4.sql
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM authenticated;

COMMENT ON FUNCTION public.get_user_id_by_email(text) IS
'Lookup user_id from auth.users by email (case-insensitive). Called from edfapay-webhook only via service_role. REVOKE from anon+authenticated for security.';

DO $$
DECLARE v_acl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_user_id_by_email'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'F.3 Step 0 FAILED: function not created';
  END IF;

  SELECT array_to_string(proacl, ', ') INTO v_acl
  FROM pg_proc
  WHERE proname = 'get_user_id_by_email'
    AND pronamespace = 'public'::regnamespace;

  IF v_acl LIKE '%anon=%' THEN
    RAISE EXCEPTION 'F.3 Step 0 FAILED: anon has access (acl=%)', v_acl;
  END IF;

  IF v_acl LIKE '%authenticated=%' THEN
    RAISE EXCEPTION 'F.3 Step 0 FAILED: authenticated has access (acl=%)', v_acl;
  END IF;

  RAISE NOTICE 'F.3 Step 0 OK — get_user_id_by_email created (service_role only)';
END$$;

-- ==========================================
-- Migration File: 20260524123316_0bbd6eb3-fe88-4637-ac3c-593a0a20a5a6.sql
-- ==========================================

UPDATE public.orders SET user_id = '0b9b88ef-515c-4555-a48c-14988012afba', customer_email = 'thamer585899@gmail.com', updated_at = NOW() WHERE order_number = 'TEST-F8-C-a6c21cb8';

-- ==========================================
-- Migration File: 20260525091026_f61fcbd4-59b4-4fe8-9191-4d76bf07f3ca.sql
-- ==========================================

-- ════════════════════════════════════════════════════════════
-- H.1 — Profile Infrastructure Foundation
-- Date: 25 May 2026
-- Owner: PM Ahmed
-- ════════════════════════════════════════════════════════════

-- PART 1: Snapshot (audit)
DO $$
DECLARE
  v_users_count int;
  v_profiles_count int;
  v_missing int;
BEGIN
  SELECT COUNT(*) INTO v_users_count FROM auth.users;
  SELECT COUNT(*) INTO v_profiles_count FROM public.profiles;
  SELECT COUNT(*) INTO v_missing
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.user_id IS NULL;
  RAISE NOTICE '[H.1 PRE] auth.users=%, profiles=%, missing=%',
    v_users_count, v_profiles_count, v_missing;
END $$;

-- PART 2: Backfill Existing Users
INSERT INTO public.profiles (user_id, full_name, phone, email)
SELECT
  u.id AS user_id,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    ''
  ) AS full_name,
  COALESCE(u.raw_user_meta_data->>'phone', u.phone, '') AS phone,
  u.email AS email
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- PART 3: Attach Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- PART 4: Admin SELECT Policy on profiles
DROP POLICY IF EXISTS profiles_admin_select ON public.profiles;
CREATE POLICY profiles_admin_select
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- PART 5: Verification + ASSERT
DO $$
DECLARE
  v_users_count int;
  v_profiles_count int;
  v_missing int;
  v_trigger_exists boolean;
  v_admin_policy_exists boolean;
BEGIN
  SELECT COUNT(*) INTO v_users_count FROM auth.users;
  SELECT COUNT(*) INTO v_profiles_count FROM public.profiles;
  SELECT COUNT(*) INTO v_missing
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.user_id IS NULL;

  SELECT EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
  ) INTO v_trigger_exists;

  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_admin_select'
  ) INTO v_admin_policy_exists;

  RAISE NOTICE '[H.1 POST] users=%, profiles=%, missing=%, trigger=%, admin_policy=%',
    v_users_count, v_profiles_count, v_missing,
    v_trigger_exists, v_admin_policy_exists;

  ASSERT v_missing = 0, 'BACKFILL FAILED: still missing profiles';
  ASSERT v_trigger_exists, 'TRIGGER NOT ATTACHED';
  ASSERT v_admin_policy_exists, 'ADMIN POLICY NOT CREATED';
  ASSERT v_users_count = v_profiles_count, 'COUNT MISMATCH: users != profiles';
END $$;

-- ==========================================
-- Migration File: 20260525100224_c3b8b07e-f4d7-456d-8252-ed55f25a0335.sql
-- ==========================================

BEGIN;

DO $$ DECLARE v int; BEGIN
  SELECT COUNT(*) INTO v FROM auth.users WHERE email_confirmed_at IS NULL;
  RAISE NOTICE '[H.1.6 PRE] unconfirmed = %', v;
END $$;

UPDATE auth.users
   SET email_confirmed_at = NOW()
 WHERE email_confirmed_at IS NULL
   AND email IN ('thamer585891@gmail.com', '+h1test@gmail.com');

DO $$ DECLARE v int; BEGIN
  SELECT COUNT(*) INTO v FROM auth.users WHERE email_confirmed_at IS NULL;
  RAISE NOTICE '[H.1.6 POST] unconfirmed = %', v;
  ASSERT v = 0, 'BACKFILL INCOMPLETE';
END $$;

COMMIT;

-- ==========================================
-- Migration File: 20260525103626_46a78709-bea9-4e59-b185-bb2c30332a7c.sql
-- ==========================================

DELETE FROM auth.users WHERE email LIKE '%@mailinator.com';

-- ==========================================
-- Migration File: 20260525134344_email_infra.sql
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
-- Migration File: 20260525134357_email_infra.sql
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
-- Migration File: 20260525134852_email_infra.sql
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
-- Migration File: 20260526071343_d0637387-bc53-4fa1-bcf1-6e80acc947ab.sql
-- ==========================================


DO $$
DECLARE
  test_emails text[] := ARRAY[
    'saalla012@gmail.com',
    'elbhery878@gmail.com',
    'ahmedtest-h4-1@test.com',
    'ahmedtest-h4-2@test.com',
    'ahmedtest-h4-3@test.com',
    '+h1test@gmail.com',
    'iiithamern18@gmail.com'
  ];
  test_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO test_ids FROM auth.users WHERE email = ANY(test_emails);

  DELETE FROM public.payment_transactions WHERE order_id IN (SELECT id FROM public.orders WHERE user_id = ANY(test_ids) OR customer_email = ANY(test_emails));
  DELETE FROM public.orders WHERE user_id = ANY(test_ids) OR customer_email = ANY(test_emails);
  DELETE FROM public.profiles WHERE user_id = ANY(test_ids) OR email = ANY(test_emails);
  DELETE FROM auth.users WHERE id = ANY(test_ids);
END $$;


-- ==========================================
-- Migration File: 20260526125453_a9e8cae8-0df7-4e13-8d3c-e6f429575711.sql
-- ==========================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_orders_is_test ON public.orders(is_test) WHERE is_test = true;

-- ==========================================
-- Migration File: 20260526132407_6a60c48e-94c5-4be7-aee9-99b9a3ffd8ca.sql
-- ==========================================


-- A.3 Security Hardening — Fixes #1 + #2
BEGIN;

-- ═══════════════════════════════════════════════════════════
-- FIX 1: REVOKE get_user_id_by_email FROM anon + authenticated
-- (يمنع email enumeration. service_role يحتفظ بالصلاحية للـ webhooks)
-- ═══════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;

-- ═══════════════════════════════════════════════════════════
-- FIX 2: tighten orders_anon_insert — add user_id IS NULL
-- نُحافظ على كل القيود الموجودة + الدوار {anon, authenticated} كما كانت
-- ═══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS orders_anon_insert ON public.orders;

CREATE POLICY orders_anon_insert
  ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL                                       -- NEW: منع حقن user_id
    AND customer_name IS NOT NULL
    AND length(btrim(customer_name)) >= 2
    AND length(customer_name) <= 120
    AND customer_phone IS NOT NULL
    AND customer_phone ~ '^05[0-9]{8}$'
    AND total > 0
    AND total <= 10000
    AND jsonb_typeof(items) = 'array'
    AND jsonb_array_length(items) > 0
    AND jsonb_array_length(items) <= 20
    AND status = 'pending'
    AND payment_method = ANY (ARRAY['whatsapp'::text, 'card'::text])
  );

COMMIT;


-- ==========================================
-- Migration File: 20260526135645_c3a2a83b-c992-40bd-bb00-b4be758a531a.sql
-- ==========================================

BEGIN;

-- 0. Drop dependent policy (will recreate after ALTER)
DROP POLICY IF EXISTS orders_anon_insert ON public.orders;

-- 1. orders precision standardization
ALTER TABLE public.orders 
  ALTER COLUMN total TYPE numeric(10,2),
  ALTER COLUMN subtotal TYPE numeric(10,2),
  ALTER COLUMN discount TYPE numeric(10,2),
  ALTER COLUMN vat TYPE numeric(10,2);

-- 1b. Recreate orders_anon_insert policy (identical to A.3 hardened version)
CREATE POLICY orders_anon_insert ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL)
    AND (customer_name IS NOT NULL)
    AND (length(btrim(customer_name)) >= 2)
    AND (length(customer_name) <= 120)
    AND (customer_phone IS NOT NULL)
    AND (customer_phone ~ '^05[0-9]{8}$')
    AND (total > 0::numeric)
    AND (total <= 10000::numeric)
    AND (jsonb_typeof(items) = 'array')
    AND (jsonb_array_length(items) > 0)
    AND (jsonb_array_length(items) <= 20)
    AND (status = 'pending')
    AND (payment_method = ANY (ARRAY['whatsapp'::text, 'card'::text]))
  );

-- 2. product_costs
CREATE TABLE public.product_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug text NOT NULL,
  unit_cost numeric(10,2) NOT NULL CHECK (unit_cost >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz NULL,
  note text NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT effective_period_valid CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE UNIQUE INDEX product_costs_active_unique ON public.product_costs(product_slug) WHERE effective_to IS NULL;
CREATE INDEX product_costs_slug_idx ON public.product_costs(product_slug);
CREATE INDEX product_costs_effective_idx ON public.product_costs(effective_from, effective_to);
CREATE TRIGGER set_updated_at_product_costs BEFORE UPDATE ON public.product_costs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE ON public.product_costs TO authenticated;
GRANT ALL ON public.product_costs TO service_role;
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_costs_admin_read ON public.product_costs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY product_costs_admin_modify ON public.product_costs FOR ALL TO authenticated USING (public.can_modify_data(auth.uid())) WITH CHECK (public.can_modify_data(auth.uid()));

-- 3. expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('marketing','tools','salaries','hosting','support','legal','other')),
  description text NOT NULL CHECK (length(description) BETWEEN 3 AND 500),
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  expense_date date NOT NULL,
  receipt_url text NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_date_idx ON public.expenses(expense_date DESC);
CREATE INDEX expenses_category_idx ON public.expenses(category);
CREATE TRIGGER set_updated_at_expenses BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_admin_read ON public.expenses FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY expenses_admin_modify ON public.expenses FOR ALL TO authenticated USING (public.can_modify_data(auth.uid())) WITH CHECK (public.can_modify_data(auth.uid()));

-- 4. refunds
CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  reason text NULL CHECK (reason IS NULL OR length(reason) <= 500),
  refunded_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refunds_order_idx ON public.refunds(order_id);
CREATE INDEX refunds_refunded_at_idx ON public.refunds(refunded_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY refunds_admin_read ON public.refunds FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY refunds_admin_modify ON public.refunds FOR ALL TO authenticated USING (public.can_modify_data(auth.uid())) WITH CHECK (public.can_modify_data(auth.uid()));

-- 5. payment_fees
CREATE TABLE public.payment_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id uuid NULL REFERENCES public.payment_transactions(id),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  fee_amount numeric(10,2) NOT NULL CHECK (fee_amount >= 0),
  fee_percent numeric(5,4) NULL CHECK (fee_percent IS NULL OR (fee_percent >= 0 AND fee_percent <= 1)),
  provider text NOT NULL DEFAULT 'edfapay',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_fees_order_idx ON public.payment_fees(order_id);
CREATE INDEX payment_fees_provider_idx ON public.payment_fees(provider);
GRANT SELECT, INSERT, UPDATE ON public.payment_fees TO authenticated;
GRANT ALL ON public.payment_fees TO service_role;
ALTER TABLE public.payment_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_fees_admin_read ON public.payment_fees FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY payment_fees_admin_modify ON public.payment_fees FOR ALL TO authenticated USING (public.can_modify_data(auth.uid())) WITH CHECK (public.can_modify_data(auth.uid()));

-- 6. financial_periods
CREATE TABLE public.financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL CHECK (year BETWEEN 2024 AND 2100),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','locked')),
  closed_at timestamptz NULL,
  closed_by uuid NULL REFERENCES auth.users(id),
  snapshot jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);
CREATE INDEX financial_periods_status_idx ON public.financial_periods(status);
CREATE TRIGGER set_updated_at_financial_periods BEFORE UPDATE ON public.financial_periods FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE ON public.financial_periods TO authenticated;
GRANT ALL ON public.financial_periods TO service_role;
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_periods_admin_read ON public.financial_periods FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY financial_periods_admin_modify ON public.financial_periods FOR ALL TO authenticated USING (public.can_modify_data(auth.uid())) WITH CHECK (public.can_modify_data(auth.uid()));

-- 7. Locked period protection
CREATE OR REPLACE FUNCTION public.prevent_locked_period_modification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'locked' THEN
    RAISE EXCEPTION 'Cannot modify locked financial period';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_locked_periods BEFORE UPDATE ON public.financial_periods FOR EACH ROW WHEN (OLD.status = 'locked') EXECUTE FUNCTION public.prevent_locked_period_modification();

-- 8. orders_production VIEW (security_invoker honors caller's RLS on orders)
CREATE VIEW public.orders_production WITH (security_invoker = true) AS
  SELECT * FROM public.orders WHERE is_test = false;
COMMENT ON VIEW public.orders_production IS 'Production orders only (excludes is_test=true). Use in admin reports/KPIs.';
GRANT SELECT ON public.orders_production TO authenticated;
GRANT SELECT ON public.orders_production TO service_role;

-- 9. Revoke anon on all financial tables/view
REVOKE ALL ON public.product_costs FROM anon;
REVOKE ALL ON public.expenses FROM anon;
REVOKE ALL ON public.refunds FROM anon;
REVOKE ALL ON public.payment_fees FROM anon;
REVOKE ALL ON public.financial_periods FROM anon;
REVOKE ALL ON public.orders_production FROM anon;

COMMIT;

-- ==========================================
-- Migration File: 20260526140624_0c517ea9-c588-4206-a7bd-e3e2a9be5c50.sql
-- ==========================================


-- ============================================
-- EXECUTE 1: Seed product_costs (12 rows, idempotent)
-- ============================================
INSERT INTO public.product_costs (product_slug, unit_cost, currency, effective_from, note)
SELECT p.slug, 0, 'SAR', now(), 'Initial seed — pending admin update'
FROM public.products p
WHERE p.is_active = true
  AND p.slug != 'edfa-test'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_costs pc
    WHERE pc.product_slug = p.slug AND pc.effective_to IS NULL
  );

-- ============================================
-- EXECUTE 2: 6 Accounting RPCs
-- ============================================

-- RPC 1: get_product_cost_at(slug, at_time)
CREATE OR REPLACE FUNCTION public.get_product_cost_at(_slug text, _at timestamptz DEFAULT now())
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unit_cost
  FROM public.product_costs
  WHERE product_slug = _slug
    AND effective_from <= _at
    AND (effective_to IS NULL OR effective_to > _at)
  ORDER BY effective_from DESC
  LIMIT 1;
$$;

-- RPC 2: set_product_cost(slug, new_cost, note)
CREATE OR REPLACE FUNCTION public.set_product_cost(_slug text, _new_cost numeric, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
  _uid uuid;
BEGIN
  _uid := auth.uid();
  IF NOT public.can_modify_data(_uid) THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;
  IF _new_cost < 0 THEN
    RAISE EXCEPTION 'invalid: unit_cost must be >= 0' USING ERRCODE = '22023';
  END IF;

  -- Close the currently-active cost (if any)
  UPDATE public.product_costs
    SET effective_to = now(), updated_at = now()
    WHERE product_slug = _slug AND effective_to IS NULL;

  -- Insert new active cost
  INSERT INTO public.product_costs (product_slug, unit_cost, currency, effective_from, note, created_by)
  VALUES (_slug, _new_cost, 'SAR', now(), _note, _uid)
  RETURNING id INTO _new_id;

  PERFORM public.log_admin_action(
    'set_product_cost',
    'product_cost',
    _new_id,
    jsonb_build_object('slug', _slug, 'new_cost', _new_cost, 'note', _note)
  );

  RETURN _new_id;
END;
$$;

-- RPC 3: get_monthly_financials(year, month) → jsonb
CREATE OR REPLACE FUNCTION public.get_monthly_financials(_year int, _month int)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _start timestamptz;
  _end timestamptz;
  _revenue numeric := 0;
  _cogs numeric := 0;
  _fees numeric := 0;
  _refunds numeric := 0;
  _expenses numeric := 0;
  _orders_count int := 0;
  _gross_profit numeric;
  _net_profit numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  _start := make_timestamptz(_year, _month, 1, 0, 0, 0, 'UTC');
  _end := _start + interval '1 month';

  -- Revenue & order count (production only, paid/fulfilled)
  SELECT COALESCE(SUM(total), 0), COUNT(*)
    INTO _revenue, _orders_count
    FROM public.orders
    WHERE is_test = false
      AND status IN ('paid', 'fulfilled')
      AND created_at >= _start AND created_at < _end;

  -- COGS: sum across items of qty * cost_at(created_at)
  SELECT COALESCE(SUM(
    COALESCE((item->>'quantity')::numeric, 1) *
    COALESCE(public.get_product_cost_at(item->>'slug', o.created_at), 0)
  ), 0)
  INTO _cogs
  FROM public.orders o, jsonb_array_elements(o.items) AS item
  WHERE o.is_test = false
    AND o.status IN ('paid', 'fulfilled')
    AND o.created_at >= _start AND o.created_at < _end
    AND item ? 'slug';

  -- Payment fees
  SELECT COALESCE(SUM(pf.fee_amount), 0) INTO _fees
    FROM public.payment_fees pf
    JOIN public.orders o ON o.id = pf.order_id
    WHERE o.is_test = false
      AND o.created_at >= _start AND o.created_at < _end;

  -- Refunds
  SELECT COALESCE(SUM(r.amount), 0) INTO _refunds
    FROM public.refunds r
    JOIN public.orders o ON o.id = r.order_id
    WHERE o.is_test = false
      AND r.refunded_at >= _start AND r.refunded_at < _end;

  -- Expenses
  SELECT COALESCE(SUM(amount), 0) INTO _expenses
    FROM public.expenses
    WHERE expense_date >= _start::date AND expense_date < _end::date;

  _gross_profit := _revenue - _cogs;
  _net_profit := _gross_profit - _fees - _refunds - _expenses;

  RETURN jsonb_build_object(
    'year', _year,
    'month', _month,
    'period_start', _start,
    'period_end', _end,
    'orders_count', _orders_count,
    'revenue', _revenue,
    'cogs', _cogs,
    'gross_profit', _gross_profit,
    'fees', _fees,
    'refunds', _refunds,
    'expenses', _expenses,
    'net_profit', _net_profit,
    'gross_margin_pct', CASE WHEN _revenue > 0 THEN round((_gross_profit / _revenue) * 100, 2) ELSE 0 END,
    'net_margin_pct', CASE WHEN _revenue > 0 THEN round((_net_profit / _revenue) * 100, 2) ELSE 0 END
  );
END;
$$;

-- RPC 4: get_kpi_dashboard(from, to) → jsonb (Tier 1+2)
CREATE OR REPLACE FUNCTION public.get_kpi_dashboard(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _revenue numeric := 0;
  _cogs numeric := 0;
  _fees numeric := 0;
  _refunds numeric := 0;
  _expenses numeric := 0;
  _orders_count int := 0;
  _customers_count int := 0;
  _aov numeric := 0;
  _gross_profit numeric;
  _net_profit numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(total), 0), COUNT(*), COUNT(DISTINCT customer_phone)
    INTO _revenue, _orders_count, _customers_count
    FROM public.orders
    WHERE is_test = false
      AND status IN ('paid', 'fulfilled')
      AND created_at >= _from AND created_at < _to;

  SELECT COALESCE(SUM(
    COALESCE((item->>'quantity')::numeric, 1) *
    COALESCE(public.get_product_cost_at(item->>'slug', o.created_at), 0)
  ), 0)
  INTO _cogs
  FROM public.orders o, jsonb_array_elements(o.items) AS item
  WHERE o.is_test = false
    AND o.status IN ('paid', 'fulfilled')
    AND o.created_at >= _from AND o.created_at < _to
    AND item ? 'slug';

  SELECT COALESCE(SUM(pf.fee_amount), 0) INTO _fees
    FROM public.payment_fees pf
    JOIN public.orders o ON o.id = pf.order_id
    WHERE o.is_test = false AND o.created_at >= _from AND o.created_at < _to;

  SELECT COALESCE(SUM(r.amount), 0) INTO _refunds
    FROM public.refunds r
    JOIN public.orders o ON o.id = r.order_id
    WHERE o.is_test = false AND r.refunded_at >= _from AND r.refunded_at < _to;

  SELECT COALESCE(SUM(amount), 0) INTO _expenses
    FROM public.expenses
    WHERE expense_date >= _from::date AND expense_date < _to::date;

  _gross_profit := _revenue - _cogs;
  _net_profit := _gross_profit - _fees - _refunds - _expenses;
  _aov := CASE WHEN _orders_count > 0 THEN _revenue / _orders_count ELSE 0 END;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', _from, 'to', _to),
    'tier1', jsonb_build_object(
      'revenue', _revenue,
      'orders_count', _orders_count,
      'gross_profit', _gross_profit,
      'net_profit', _net_profit,
      'gross_margin_pct', CASE WHEN _revenue > 0 THEN round((_gross_profit / _revenue) * 100, 2) ELSE 0 END
    ),
    'tier2', jsonb_build_object(
      'cogs', _cogs,
      'fees', _fees,
      'refunds', _refunds,
      'expenses', _expenses,
      'customers_count', _customers_count,
      'aov', round(_aov, 2),
      'net_margin_pct', CASE WHEN _revenue > 0 THEN round((_net_profit / _revenue) * 100, 2) ELSE 0 END
    )
  );
END;
$$;

-- RPC 5: get_product_profitability(from, to) → jsonb array
CREATE OR REPLACE FUNCTION public.get_product_profitability(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _result
  FROM (
    SELECT
      item->>'slug' AS slug,
      COALESCE(item->>'name', item->>'slug') AS name,
      SUM(COALESCE((item->>'quantity')::numeric, 1))::int AS units_sold,
      SUM(COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::numeric, 1)) AS revenue,
      SUM(
        COALESCE((item->>'quantity')::numeric, 1) *
        COALESCE(public.get_product_cost_at(item->>'slug', o.created_at), 0)
      ) AS cogs,
      SUM(COALESCE((item->>'price')::numeric, 0) * COALESCE((item->>'quantity')::numeric, 1))
        - SUM(
            COALESCE((item->>'quantity')::numeric, 1) *
            COALESCE(public.get_product_cost_at(item->>'slug', o.created_at), 0)
          ) AS gross_profit
    FROM public.orders o, jsonb_array_elements(o.items) AS item
    WHERE o.is_test = false
      AND o.status IN ('paid', 'fulfilled')
      AND o.created_at >= _from AND o.created_at < _to
      AND item ? 'slug'
    GROUP BY item->>'slug', COALESCE(item->>'name', item->>'slug')
    ORDER BY revenue DESC
  ) t;

  RETURN _result;
END;
$$;

-- RPC 6: close_financial_period(year, month)
CREATE OR REPLACE FUNCTION public.close_financial_period(_year int, _month int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _snapshot jsonb;
  _period_id uuid;
BEGIN
  _uid := auth.uid();
  IF NOT public.is_super_admin(_uid) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;

  -- Prevent re-closing
  IF EXISTS (
    SELECT 1 FROM public.financial_periods
    WHERE year = _year AND month = _month AND status = 'locked'
  ) THEN
    RAISE EXCEPTION 'period already locked' USING ERRCODE = 'P0001';
  END IF;

  -- Build snapshot
  _snapshot := public.get_monthly_financials(_year, _month);

  -- Upsert
  INSERT INTO public.financial_periods (year, month, status, snapshot, closed_by, closed_at)
  VALUES (_year, _month, 'locked', _snapshot, _uid, now())
  ON CONFLICT (year, month) DO UPDATE
    SET status = 'locked',
        snapshot = EXCLUDED.snapshot,
        closed_by = EXCLUDED.closed_by,
        closed_at = EXCLUDED.closed_at,
        updated_at = now()
  RETURNING id INTO _period_id;

  PERFORM public.log_admin_action(
    'close_financial_period',
    'financial_period',
    _period_id,
    jsonb_build_object('year', _year, 'month', _month, 'snapshot', _snapshot)
  );

  RETURN _period_id;
END;
$$;

-- Ensure unique (year, month) for upsert in close_financial_period
CREATE UNIQUE INDEX IF NOT EXISTS financial_periods_year_month_uniq
  ON public.financial_periods (year, month);

-- Grant execute on all 6 RPCs to authenticated (admin check is inside)
GRANT EXECUTE ON FUNCTION public.get_product_cost_at(text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_product_cost(text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_financials(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_kpi_dashboard(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_profitability(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_financial_period(int, int) TO authenticated;


-- ==========================================
-- Migration File: 20260526140649_f856aba6-1cf8-4bc7-93b0-c8941095f2b9.sql
-- ==========================================


REVOKE EXECUTE ON FUNCTION public.get_product_cost_at(text, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_product_cost(text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_monthly_financials(int, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_kpi_dashboard(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_product_profitability(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_financial_period(int, int) FROM PUBLIC, anon;


-- ==========================================
-- Migration File: 20260526162424_2a255469-b5f4-461b-8218-101118041dfe.sql
-- ==========================================

BEGIN;

CREATE TYPE subscription_provider AS ENUM ('falcon', 'smarters', 'hulk');
COMMENT ON TYPE subscription_provider IS 'IPTV subscription provider types. Universal regardless of backup policy.';

CREATE TABLE public.subscription_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider subscription_provider NOT NULL,
  username text NOT NULL CHECK (length(username) BETWEEN 1 AND 200),
  password text NOT NULL CHECK (length(password) BETWEEN 1 AND 200),
  url text CHECK (url IS NULL OR length(url) <= 500),
  extra_info jsonb DEFAULT '{}'::jsonb,
  duration_months int NOT NULL CHECK (duration_months > 0 AND duration_months <= 36),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'claimed', 'expired', 'invalid')),
  claimed_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  claimed_role text CHECK (
    claimed_role IS NULL OR claimed_role IN ('primary', 'backup', 'single')
  ),
  cogs numeric(10,2) CHECK (cogs IS NULL OR cogs >= 0),
  cogs_currency text DEFAULT 'SAR',
  notes text CHECK (notes IS NULL OR length(notes) <= 500),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_inventory_claim_consistency CHECK (
    (status = 'available' AND claimed_order_id IS NULL AND claimed_role IS NULL AND claimed_at IS NULL) OR
    (status = 'reserved' AND claimed_role IS NULL) OR
    (status = 'claimed' AND claimed_order_id IS NOT NULL AND claimed_role IS NOT NULL AND claimed_at IS NOT NULL) OR
    (status IN ('expired', 'invalid'))
  )
);
COMMENT ON TABLE public.subscription_inventory IS 
  'Subscription credentials inventory. Universal schema, works with any backup policy. RPC+webhook deferred until owner backup decisions.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_inventory TO authenticated;
GRANT ALL ON public.subscription_inventory TO service_role;
REVOKE ALL ON public.subscription_inventory FROM anon;

ALTER TABLE public.subscription_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_inventory_admin_read 
  ON public.subscription_inventory FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY subscription_inventory_admin_modify 
  ON public.subscription_inventory FOR ALL
  USING (can_modify_data(auth.uid()))
  WITH CHECK (can_modify_data(auth.uid()));

CREATE INDEX idx_inv_available 
  ON public.subscription_inventory(provider, duration_months, created_at) 
  WHERE status = 'available';

CREATE INDEX idx_inv_claimed_order 
  ON public.subscription_inventory(claimed_order_id) 
  WHERE claimed_order_id IS NOT NULL;

CREATE INDEX idx_inv_provider_status 
  ON public.subscription_inventory(provider, status);

CREATE INDEX idx_inv_expires 
  ON public.subscription_inventory(expires_at) 
  WHERE expires_at IS NOT NULL AND status IN ('available', 'reserved');

CREATE UNIQUE INDEX idx_inv_unique_credentials 
  ON public.subscription_inventory(provider, username);

CREATE TRIGGER set_updated_at_subscription_inventory
  BEFORE UPDATE ON public.subscription_inventory
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'primary_subscription_id'
  ) THEN
    ALTER TABLE public.orders 
      ADD COLUMN primary_subscription_id uuid 
        REFERENCES public.subscription_inventory(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'backup_subscription_id'
  ) THEN
    ALTER TABLE public.orders 
      ADD COLUMN backup_subscription_id uuid 
        REFERENCES public.subscription_inventory(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_primary_sub 
  ON public.orders(primary_subscription_id) 
  WHERE primary_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_backup_sub 
  ON public.orders(backup_subscription_id) 
  WHERE backup_subscription_id IS NOT NULL;

COMMIT;

-- ==========================================
-- Migration File: 20260527083335_b74be6ed-3da5-4a0d-b0b4-02fbb25ba625.sql
-- ==========================================

-- 1) Partial UNIQUE index on profiles.phone (case-insensitive + trim-safe)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles ((lower(btrim(phone))))
  WHERE phone IS NOT NULL AND btrim(phone) <> '';

-- 2) RPC: get_email_by_phone — normalizes input then looks up profiles.phone
CREATE OR REPLACE FUNCTION public.get_email_by_phone(_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _normalized TEXT;
  _email TEXT;
BEGIN
  -- Strip whitespace, dashes, plus, parentheses
  _normalized := regexp_replace(COALESCE(_phone, ''), '[\s\-+()]', '', 'g');

  -- Convert international variants to local 05XXXXXXXX
  IF _normalized ~ '^00966[0-9]{9}$' THEN
    _normalized := '0' || substring(_normalized FROM 6);
  ELSIF _normalized ~ '^966[0-9]{9}$' THEN
    _normalized := '0' || substring(_normalized FROM 4);
  ELSIF _normalized ~ '^5[0-9]{8}$' THEN
    _normalized := '0' || _normalized;
  END IF;

  -- Verify final format: must be 05XXXXXXXX (10 digits)
  IF _normalized !~ '^05[0-9]{8}$' THEN
    RETURN NULL;
  END IF;

  -- Lookup
  SELECT email INTO _email
    FROM public.profiles
    WHERE phone = _normalized
    LIMIT 1;

  RETURN _email;
END;
$$;

-- 3) Permissions: anon + authenticated only (no PUBLIC)
REVOKE ALL ON FUNCTION public.get_email_by_phone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(TEXT) TO anon, authenticated;

-- ==========================================
-- Migration File: 20260527091336_b60dc447-8f38-48da-877b-b1651d6e210e.sql
-- ==========================================


-- J.1: shared normalization helper (single source of truth)
CREATE OR REPLACE FUNCTION public.normalize_phone_to_e164(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cleaned text;
BEGIN
  IF input IS NULL OR btrim(input) = '' THEN
    RETURN NULL;
  END IF;

  cleaned := regexp_replace(input, '[\s\-+()]', '', 'g');

  IF cleaned ~ '^05[0-9]{8}$' THEN
    RETURN '+966' || substring(cleaned FROM 2);
  END IF;

  IF cleaned ~ '^5[0-9]{8}$' THEN
    RETURN '+966' || cleaned;
  END IF;

  IF cleaned ~ '^00[1-9][0-9]{6,14}$' THEN
    RETURN '+' || substring(cleaned FROM 3);
  END IF;

  IF cleaned ~ '^[1-9][0-9]{6,14}$' AND length(cleaned) >= 8 THEN
    RETURN '+' || cleaned;
  END IF;

  IF input ~ '^\+[1-9][0-9]{6,14}$' THEN
    RETURN input;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_phone_to_e164(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_phone_to_e164(text) TO anon, authenticated;

-- J.1: Replace orders insert policy with dual-format regex (backward compatible)
DROP POLICY IF EXISTS orders_anon_insert ON public.orders;
CREATE POLICY orders_anon_insert ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    user_id IS NULL
    AND customer_name IS NOT NULL
    AND length(btrim(customer_name)) >= 2
    AND length(customer_name) <= 120
    AND customer_phone IS NOT NULL
    AND customer_phone ~ '^(\+[1-9][0-9]{6,14}|05[0-9]{8})$'
    AND total > 0 AND total <= 10000
    AND jsonb_typeof(items) = 'array'
    AND jsonb_array_length(items) BETWEEN 1 AND 20
    AND status = 'pending'
    AND payment_method = ANY (ARRAY['whatsapp','card'])
  );

-- J.1: get_email_by_phone — dual-format lookup (E.164 + legacy 05)
CREATE OR REPLACE FUNCTION public.get_email_by_phone(_phone text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH normalized AS (
    SELECT public.normalize_phone_to_e164(_phone) AS e164,
           CASE
             WHEN public.normalize_phone_to_e164(_phone) LIKE '+966%'
               THEN '0' || substring(public.normalize_phone_to_e164(_phone) FROM 5)
             ELSE NULL
           END AS legacy
  )
  SELECT p.email
  FROM public.profiles p, normalized n
  WHERE p.email IS NOT NULL
    AND (p.phone = n.e164 OR (n.legacy IS NOT NULL AND p.phone = n.legacy))
  LIMIT 1;
$$;

-- J.1: claim_orders_by_phone — dual-format match
CREATE OR REPLACE FUNCTION public.claim_orders_by_phone(_phone text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
  _e164 text;
  _legacy text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;

  _e164 := public.normalize_phone_to_e164(_phone);
  IF _e164 IS NULL THEN RETURN 0; END IF;

  _legacy := CASE
    WHEN _e164 LIKE '+966%' THEN '0' || substring(_e164 FROM 5)
    ELSE NULL
  END;

  UPDATE public.orders
    SET user_id = auth.uid()
    WHERE user_id IS NULL
      AND (customer_phone = _e164 OR (_legacy IS NOT NULL AND customer_phone = _legacy));

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- J.1: rate limit trigger — dual-format match, canonical E.164 storage
CREATE OR REPLACE FUNCTION public.check_order_rate_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _e164 text;
  _legacy text;
  _store text;
BEGIN
  _e164 := public.normalize_phone_to_e164(NEW.customer_phone);
  _legacy := CASE
    WHEN _e164 LIKE '+966%' THEN '0' || substring(_e164 FROM 5)
    ELSE NULL
  END;
  _store := COALESCE(_e164, NEW.customer_phone);

  IF EXISTS (
    SELECT 1 FROM public.order_rate_limits
    WHERE (phone = _store OR (_legacy IS NOT NULL AND phone = _legacy) OR (_e164 IS NOT NULL AND phone = _e164))
      AND last_order_at > NOW() - INTERVAL '5 minutes'
  ) THEN
    RAISE EXCEPTION 'rate_limited: too many orders, wait 5 minutes'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.order_rate_limits (phone, last_order_at, count_24h)
  VALUES (_store, NOW(), 1)
  ON CONFLICT (phone) DO UPDATE
    SET last_order_at = NOW(),
        count_24h = public.order_rate_limits.count_24h + 1;

  RETURN NEW;
END;
$$;


-- ==========================================
-- Migration File: 20260527103439_e0cac8aa-bd3d-40e8-b856-81519adbc229.sql
-- ==========================================


CREATE OR REPLACE FUNCTION public.check_inventory_duplicates(
  _provider public.subscription_provider,
  _usernames text[]
)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(username), ARRAY[]::text[])
  FROM public.subscription_inventory
  WHERE provider = _provider
    AND username = ANY(_usernames);
$$;

REVOKE ALL ON FUNCTION public.check_inventory_duplicates(public.subscription_provider, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_inventory_duplicates(public.subscription_provider, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_insert_inventory(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted int := 0;
  _failed int := 0;
  _errors jsonb := '[]'::jsonb;
  _item jsonb;
BEGIN
  IF NOT public.can_modify_data(auth.uid()) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    BEGIN
      INSERT INTO public.subscription_inventory (
        provider, username, password, url, extra_info,
        duration_months, expires_at, cogs, cogs_currency, notes, status
      ) VALUES (
        (_item->>'provider')::public.subscription_provider,
        _item->>'username',
        _item->>'password',
        NULLIF(_item->>'url', ''),
        CASE WHEN _item ? 'extra_info' AND _item->'extra_info' <> 'null'::jsonb THEN _item->'extra_info' ELSE NULL END,
        (_item->>'duration_months')::int,
        NULLIF(_item->>'expires_at', '')::timestamptz,
        NULLIF(_item->>'cogs', '')::numeric,
        COALESCE(NULLIF(_item->>'cogs_currency', ''), 'SAR'),
        NULLIF(_item->>'notes', ''),
        'available'
      );
      _inserted := _inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      _failed := _failed + 1;
      _errors := _errors || jsonb_build_object(
        'username', _item->>'username',
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', _inserted,
    'failed', _failed,
    'errors', _errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_insert_inventory(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_insert_inventory(jsonb) TO authenticated;


-- ==========================================
-- Migration File: 20260527111058_c59b69aa-ca75-40d1-a5f1-caed36f11982.sql
-- ==========================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_management_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.products.stock_management_enabled IS
  'When true (default): D.2 auto-claims from subscription_inventory. When false: skip auto-claim, manual fulfillment + WhatsApp delivery only.';

-- ==========================================
-- Migration File: 20260527112907_2386e686-3d4a-4fb6-bbb4-a527899a5458.sql
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_providers_from_slug(_slug text)
RETURNS subscription_provider[]
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN _slug LIKE 'falcon-%' THEN ARRAY['falcon'::subscription_provider]
    WHEN _slug LIKE 'hulk-%' THEN ARRAY['hulk'::subscription_provider]
    WHEN _slug LIKE 'smarters-%' THEN ARRAY['smarters'::subscription_provider]
    WHEN _slug = 'bundle-falcon-hulk-1y' THEN
      ARRAY['falcon'::subscription_provider, 'hulk'::subscription_provider]
    ELSE ARRAY[]::subscription_provider[]
  END;
$$;

COMMENT ON FUNCTION public.get_providers_from_slug(text) IS
  'D.2 (27 May 2026): Maps product slug to provider array. Bundle returns 2 providers. Unknown/test slugs return empty array (graceful fallback).';

CREATE OR REPLACE FUNCTION public.claim_subscription_for_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _order RECORD;
  _product RECORD;
  _providers subscription_provider[];
  _provider subscription_provider;
  _duration int;
  _slug text;
  _inv_falcon RECORD;
  _inv_hulk RECORD;
  _inv_single RECORD;
  _claimed_ids uuid[] := '{}';
  _is_bundle boolean;
BEGIN
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'order_not_found');
  END IF;
  IF _order.status <> 'paid' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'order_not_paid', 'status', _order.status);
  END IF;
  IF _order.fulfilled_at IS NOT NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'already_fulfilled');
  END IF;

  _slug := _order.items->0->>'product_slug';
  IF _slug IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'no_product_slug');
  END IF;

  SELECT * INTO _product FROM public.products WHERE slug = _slug LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'product_not_found', 'slug', _slug);
  END IF;

  IF NOT _product.stock_management_enabled THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'stock_management_disabled');
  END IF;

  _providers := public.get_providers_from_slug(_slug);
  _duration := _product.duration_months;
  _is_bundle := _slug = 'bundle-falcon-hulk-1y';

  IF array_length(_providers, 1) IS NULL OR array_length(_providers, 1) = 0 THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'unknown_slug_mapping', 'slug', _slug);
  END IF;

  IF _is_bundle THEN
    SELECT * INTO _inv_falcon FROM public.subscription_inventory
      WHERE provider = 'falcon' AND duration_months = _duration AND status = 'available'
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'no_falcon_stock', 'duration', _duration);
    END IF;

    SELECT * INTO _inv_hulk FROM public.subscription_inventory
      WHERE provider = 'hulk' AND duration_months = _duration AND status = 'available'
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'no_hulk_stock', 'duration', _duration);
    END IF;

    UPDATE public.subscription_inventory
      SET status = 'claimed', claimed_order_id = _order_id, claimed_at = NOW(),
          claimed_role = 'primary', updated_at = NOW()
      WHERE id = _inv_falcon.id;

    UPDATE public.subscription_inventory
      SET status = 'claimed', claimed_order_id = _order_id, claimed_at = NOW(),
          claimed_role = 'backup', updated_at = NOW()
      WHERE id = _inv_hulk.id;

    _claimed_ids := ARRAY[_inv_falcon.id, _inv_hulk.id];

    UPDATE public.orders SET
      subscription_extra_info = jsonb_build_object(
        'bundle', true,
        'falcon', jsonb_build_object('username', _inv_falcon.username, 'password', _inv_falcon.password, 'url', _inv_falcon.url),
        'hulk', jsonb_build_object('username', _inv_hulk.username, 'password', _inv_hulk.password, 'url', _inv_hulk.url)
      ),
      fulfilled_at = NOW(), fulfilled_by = NULL, status = 'fulfilled',
      primary_subscription_id = _inv_falcon.id, backup_subscription_id = _inv_hulk.id,
      updated_at = NOW()
    WHERE id = _order_id;
  ELSE
    _provider := _providers[1];
    SELECT * INTO _inv_single FROM public.subscription_inventory
      WHERE provider = _provider AND duration_months = _duration AND status = 'available'
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'no_stock', 'provider', _provider, 'duration', _duration);
    END IF;

    UPDATE public.subscription_inventory
      SET status = 'claimed', claimed_order_id = _order_id, claimed_at = NOW(),
          claimed_role = 'primary', updated_at = NOW()
      WHERE id = _inv_single.id;

    _claimed_ids := ARRAY[_inv_single.id];

    UPDATE public.orders SET
      subscription_username = _inv_single.username,
      subscription_password = _inv_single.password,
      subscription_url = _inv_single.url,
      subscription_extra_info = _inv_single.extra_info,
      fulfilled_at = NOW(), fulfilled_by = NULL, status = 'fulfilled',
      primary_subscription_id = _inv_single.id, updated_at = NOW()
    WHERE id = _order_id;
  END IF;

  INSERT INTO public.admin_audit_logs (action, entity_type, entity_id, admin_user_id, changes)
  VALUES ('auto_claim_subscription', 'order', _order_id, NULL,
    jsonb_build_object(
      'inventory_ids', to_jsonb(_claimed_ids),
      'is_bundle', _is_bundle,
      'providers', to_jsonb(_providers),
      'source', 'd2_auto_claim',
      'slug', _slug,
      'duration', _duration
    ));

  RETURN jsonb_build_object(
    'claimed', true, 'is_bundle', _is_bundle,
    'inventory_ids', to_jsonb(_claimed_ids),
    'providers', to_jsonb(_providers), 'slug', _slug
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'claimed', false, 'reason', 'rpc_exception',
    'error', SQLERRM, 'order_id', _order_id::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_subscription_for_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_subscription_for_order(uuid) TO service_role;

COMMENT ON FUNCTION public.claim_subscription_for_order(uuid) IS
  'D.2 (27 May 2026): Auto-claim subscription from inventory for paid order. Supports single + bundle (Falcon+Hulk). Race-safe via FOR UPDATE SKIP LOCKED. Non-blocking via EXCEPTION handler. Tracks claimed_role for primary/backup.';

-- ==========================================
-- Migration File: 20260527151032_87cd0aee-2b46-4e9b-a277-364ade06a94c.sql
-- ==========================================

CREATE OR REPLACE FUNCTION public.check_stock_available(
  _slug text,
  _duration int
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _product RECORD;
  _providers subscription_provider[];
  _count int;
  _bundle_falcon_count int;
  _bundle_hulk_count int;
BEGIN
  SELECT * INTO _product FROM public.products WHERE slug = _slug LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('available', false, 'reason', 'product_not_found');
  END IF;

  IF NOT _product.stock_management_enabled THEN
    RETURN jsonb_build_object('available', true, 'reason', 'stock_management_disabled');
  END IF;

  _providers := get_providers_from_slug(_slug);

  IF array_length(_providers, 1) IS NULL THEN
    RETURN jsonb_build_object('available', false, 'reason', 'unknown_slug');
  END IF;

  IF _slug = 'bundle-falcon-hulk-1y' THEN
    SELECT COUNT(*) INTO _bundle_falcon_count
      FROM public.subscription_inventory
      WHERE provider = 'falcon' AND duration_months = _duration AND status = 'available';

    SELECT COUNT(*) INTO _bundle_hulk_count
      FROM public.subscription_inventory
      WHERE provider = 'hulk' AND duration_months = _duration AND status = 'available';

    RETURN jsonb_build_object(
      'available', _bundle_falcon_count > 0 AND _bundle_hulk_count > 0,
      'falcon_count', _bundle_falcon_count,
      'hulk_count', _bundle_hulk_count,
      'is_bundle', true
    );
  END IF;

  SELECT COUNT(*) INTO _count
    FROM public.subscription_inventory
    WHERE provider = _providers[1]
      AND duration_months = _duration
      AND status = 'available';

  RETURN jsonb_build_object(
    'available', _count > 0,
    'count', _count,
    'provider', _providers[1]
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('available', true, 'reason', 'rpc_error', 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.check_stock_available(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_stock_available(text, int) TO authenticated, anon;

COMMENT ON FUNCTION public.check_stock_available(text, int) IS
  'D.3 (27 May 2026): Check subscription stock availability for product+duration. Returns {available: bool, ...}. Bundle requires both providers. Graceful fallback to available=true on error (customer-friendly).';

-- ==========================================
-- Migration File: 20260529065222_f128df12-9c97-4caf-805a-00c1db69e4f1.sql
-- ==========================================

CREATE POLICY orders_owner_insert ON public.orders
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND customer_name IS NOT NULL
  AND length(btrim(customer_name)) >= 2 AND length(customer_name) <= 120
  AND customer_phone IS NOT NULL
  AND customer_phone ~ '^(\+[1-9][0-9]{6,14}|05[0-9]{8})$'
  AND total > 0 AND total <= 10000
  AND jsonb_typeof(items) = 'array'
  AND jsonb_array_length(items) >= 1 AND jsonb_array_length(items) <= 20
  AND status = 'pending'
  AND payment_method = ANY (ARRAY['whatsapp','card'])
);

-- ==========================================
-- Migration File: 20260530124421_68e4d1d1-eba8-48d2-9cba-e8f4e4c27c45.sql
-- ==========================================

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS permission_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.admin_users.permission_overrides IS
  'Additive-only per-account permission grants on top of the role baseline. Shape: { "routes": string[], "actions": string[] }. Never used to revoke. users/canManageUsers/settings/canModifySettings are never grantable here (anti-escalation). RLS remains the final authority.';

-- ==========================================
-- Migration File: 20260603094435_478801b3-1a51-46b6-9897-5080c901d577.sql
-- ==========================================

-- Fix JSON key mismatch in accounting COGS functions.
-- Order items store: product_slug, qty, unit_price (NOT slug/quantity/price).

CREATE OR REPLACE FUNCTION public.get_monthly_financials(_year integer, _month integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _start timestamptz;
  _end timestamptz;
  _revenue numeric := 0;
  _cogs numeric := 0;
  _fees numeric := 0;
  _refunds numeric := 0;
  _expenses numeric := 0;
  _orders_count int := 0;
  _gross_profit numeric;
  _net_profit numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  _start := make_timestamptz(_year, _month, 1, 0, 0, 0, 'UTC');
  _end := _start + interval '1 month';

  SELECT COALESCE(SUM(total), 0), COUNT(*)
    INTO _revenue, _orders_count
    FROM public.orders
    WHERE is_test = false
      AND status IN ('paid', 'fulfilled')
      AND created_at >= _start AND created_at < _end;

  SELECT COALESCE(SUM(
    COALESCE((item->>'qty')::numeric, 1) *
    COALESCE(public.get_product_cost_at(item->>'product_slug', o.created_at), 0)
  ), 0)
  INTO _cogs
  FROM public.orders o, jsonb_array_elements(o.items) AS item
  WHERE o.is_test = false
    AND o.status IN ('paid', 'fulfilled')
    AND o.created_at >= _start AND o.created_at < _end
    AND item ? 'product_slug';

  SELECT COALESCE(SUM(pf.fee_amount), 0) INTO _fees
    FROM public.payment_fees pf
    JOIN public.orders o ON o.id = pf.order_id
    WHERE o.is_test = false
      AND o.created_at >= _start AND o.created_at < _end;

  SELECT COALESCE(SUM(r.amount), 0) INTO _refunds
    FROM public.refunds r
    JOIN public.orders o ON o.id = r.order_id
    WHERE o.is_test = false
      AND r.refunded_at >= _start AND r.refunded_at < _end;

  SELECT COALESCE(SUM(amount), 0) INTO _expenses
    FROM public.expenses
    WHERE expense_date >= _start::date AND expense_date < _end::date;

  _gross_profit := _revenue - _cogs;
  _net_profit := _gross_profit - _fees - _refunds - _expenses;

  RETURN jsonb_build_object(
    'year', _year,
    'month', _month,
    'period_start', _start,
    'period_end', _end,
    'orders_count', _orders_count,
    'revenue', _revenue,
    'cogs', _cogs,
    'gross_profit', _gross_profit,
    'fees', _fees,
    'refunds', _refunds,
    'expenses', _expenses,
    'net_profit', _net_profit,
    'gross_margin_pct', CASE WHEN _revenue > 0 THEN round((_gross_profit / _revenue) * 100, 2) ELSE 0 END,
    'net_margin_pct', CASE WHEN _revenue > 0 THEN round((_net_profit / _revenue) * 100, 2) ELSE 0 END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_product_profitability(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _result
  FROM (
    SELECT
      item->>'product_slug' AS slug,
      COALESCE(item->>'product_name', item->>'product_slug') AS name,
      SUM(COALESCE((item->>'qty')::numeric, 1))::int AS units_sold,
      SUM(COALESCE((item->>'unit_price')::numeric, 0) * COALESCE((item->>'qty')::numeric, 1)) AS revenue,
      SUM(
        COALESCE((item->>'qty')::numeric, 1) *
        COALESCE(public.get_product_cost_at(item->>'product_slug', o.created_at), 0)
      ) AS cogs,
      SUM(COALESCE((item->>'unit_price')::numeric, 0) * COALESCE((item->>'qty')::numeric, 1))
        - SUM(
            COALESCE((item->>'qty')::numeric, 1) *
            COALESCE(public.get_product_cost_at(item->>'product_slug', o.created_at), 0)
          ) AS gross_profit
    FROM public.orders o, jsonb_array_elements(o.items) AS item
    WHERE o.is_test = false
      AND o.status IN ('paid', 'fulfilled')
      AND o.created_at >= _from AND o.created_at < _to
      AND item ? 'product_slug'
    GROUP BY item->>'product_slug', COALESCE(item->>'product_name', item->>'product_slug')
    ORDER BY revenue DESC
  ) t;

  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_kpi_dashboard(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _revenue numeric := 0;
  _cogs numeric := 0;
  _fees numeric := 0;
  _refunds numeric := 0;
  _expenses numeric := 0;
  _orders_count int := 0;
  _customers_count int := 0;
  _aov numeric := 0;
  _gross_profit numeric;
  _net_profit numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(total), 0), COUNT(*), COUNT(DISTINCT customer_phone)
    INTO _revenue, _orders_count, _customers_count
    FROM public.orders
    WHERE is_test = false
      AND status IN ('paid', 'fulfilled')
      AND created_at >= _from AND created_at < _to;

  SELECT COALESCE(SUM(
    COALESCE((item->>'qty')::numeric, 1) *
    COALESCE(public.get_product_cost_at(item->>'product_slug', o.created_at), 0)
  ), 0)
  INTO _cogs
  FROM public.orders o, jsonb_array_elements(o.items) AS item
  WHERE o.is_test = false
    AND o.status IN ('paid', 'fulfilled')
    AND o.created_at >= _from AND o.created_at < _to
    AND item ? 'product_slug';

  SELECT COALESCE(SUM(pf.fee_amount), 0) INTO _fees
    FROM public.payment_fees pf
    JOIN public.orders o ON o.id = pf.order_id
    WHERE o.is_test = false AND o.created_at >= _from AND o.created_at < _to;

  SELECT COALESCE(SUM(r.amount), 0) INTO _refunds
    FROM public.refunds r
    JOIN public.orders o ON o.id = r.order_id
    WHERE o.is_test = false AND r.refunded_at >= _from AND r.refunded_at < _to;

  SELECT COALESCE(SUM(amount), 0) INTO _expenses
    FROM public.expenses
    WHERE expense_date >= _from::date AND expense_date < _to::date;

  _gross_profit := _revenue - _cogs;
  _net_profit := _gross_profit - _fees - _refunds - _expenses;
  _aov := CASE WHEN _orders_count > 0 THEN _revenue / _orders_count ELSE 0 END;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', _from, 'to', _to),
    'tier1', jsonb_build_object(
      'revenue', _revenue,
      'orders_count', _orders_count,
      'gross_profit', _gross_profit,
      'net_profit', _net_profit,
      'gross_margin_pct', CASE WHEN _revenue > 0 THEN round((_gross_profit / _revenue) * 100, 2) ELSE 0 END
    ),
    'tier2', jsonb_build_object(
      'cogs', _cogs,
      'fees', _fees,
      'refunds', _refunds,
      'expenses', _expenses,
      'customers_count', _customers_count,
      'aov', round(_aov, 2),
      'net_margin_pct', CASE WHEN _revenue > 0 THEN round((_net_profit / _revenue) * 100, 2) ELSE 0 END
    )
  );
END;
$function$;

-- ==========================================
-- Migration File: 20260603101246_89bde940-122a-4781-9e34-9a37cecdd64e.sql
-- ==========================================

-- ============= EXECUTE 1: device_limit column + index =============
ALTER TABLE public.subscription_inventory
  ADD COLUMN device_limit smallint NOT NULL DEFAULT 1;

CREATE INDEX idx_inventory_device_limit
  ON public.subscription_inventory (provider, duration_months, device_limit, status)
  WHERE status = 'available';

-- ============= EXECUTE 2: claim_subscription_for_order =============
CREATE OR REPLACE FUNCTION public.claim_subscription_for_order(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _order RECORD;
  _product RECORD;
  _providers subscription_provider[];
  _provider subscription_provider;
  _duration int;
  _slug text;
  _required_devices smallint;
  _inv_falcon RECORD;
  _inv_hulk RECORD;
  _inv_single RECORD;
  _claimed_ids uuid[] := '{}';
  _is_bundle boolean;
BEGIN
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'order_not_found');
  END IF;
  IF _order.status <> 'paid' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'order_not_paid', 'status', _order.status);
  END IF;
  IF _order.fulfilled_at IS NOT NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'already_fulfilled');
  END IF;

  _slug := _order.items->0->>'product_slug';
  IF _slug IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'no_product_slug');
  END IF;

  _required_devices := CASE WHEN _slug LIKE '%-2dev' THEN 2 ELSE 1 END;

  SELECT * INTO _product FROM public.products WHERE slug = _slug LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'product_not_found', 'slug', _slug);
  END IF;

  IF NOT _product.stock_management_enabled THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'stock_management_disabled');
  END IF;

  _providers := public.get_providers_from_slug(_slug);
  _duration := _product.duration_months;
  _is_bundle := _slug = 'bundle-falcon-hulk-1y';

  IF array_length(_providers, 1) IS NULL OR array_length(_providers, 1) = 0 THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'unknown_slug_mapping', 'slug', _slug);
  END IF;

  IF _is_bundle THEN
    SELECT * INTO _inv_falcon FROM public.subscription_inventory
      WHERE provider = 'falcon' AND duration_months = _duration AND device_limit = 1 AND status = 'available'
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'no_falcon_stock', 'duration', _duration);
    END IF;

    SELECT * INTO _inv_hulk FROM public.subscription_inventory
      WHERE provider = 'hulk' AND duration_months = _duration AND device_limit = 1 AND status = 'available'
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'no_hulk_stock', 'duration', _duration);
    END IF;

    UPDATE public.subscription_inventory
      SET status = 'claimed', claimed_order_id = _order_id, claimed_at = NOW(),
          claimed_role = 'primary', updated_at = NOW()
      WHERE id = _inv_falcon.id;

    UPDATE public.subscription_inventory
      SET status = 'claimed', claimed_order_id = _order_id, claimed_at = NOW(),
          claimed_role = 'backup', updated_at = NOW()
      WHERE id = _inv_hulk.id;

    _claimed_ids := ARRAY[_inv_falcon.id, _inv_hulk.id];

    UPDATE public.orders SET
      subscription_extra_info = jsonb_build_object(
        'bundle', true,
        'falcon', jsonb_build_object('username', _inv_falcon.username, 'password', _inv_falcon.password, 'url', _inv_falcon.url),
        'hulk', jsonb_build_object('username', _inv_hulk.username, 'password', _inv_hulk.password, 'url', _inv_hulk.url)
      ),
      fulfilled_at = NOW(), fulfilled_by = NULL, status = 'fulfilled',
      primary_subscription_id = _inv_falcon.id, backup_subscription_id = _inv_hulk.id,
      updated_at = NOW()
    WHERE id = _order_id;
  ELSE
    _provider := _providers[1];
    SELECT * INTO _inv_single FROM public.subscription_inventory
      WHERE provider = _provider AND duration_months = _duration AND device_limit = _required_devices AND status = 'available'
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'no_stock_device', 'provider', _provider, 'duration', _duration, 'device_limit', _required_devices);
    END IF;

    UPDATE public.subscription_inventory
      SET status = 'claimed', claimed_order_id = _order_id, claimed_at = NOW(),
          claimed_role = 'primary', updated_at = NOW()
      WHERE id = _inv_single.id;

    _claimed_ids := ARRAY[_inv_single.id];

    UPDATE public.orders SET
      subscription_username = _inv_single.username,
      subscription_password = _inv_single.password,
      subscription_url = _inv_single.url,
      subscription_extra_info = _inv_single.extra_info,
      fulfilled_at = NOW(), fulfilled_by = NULL, status = 'fulfilled',
      primary_subscription_id = _inv_single.id, updated_at = NOW()
    WHERE id = _order_id;
  END IF;

  INSERT INTO public.admin_audit_logs (action, entity_type, entity_id, admin_user_id, changes)
  VALUES ('auto_claim_subscription', 'order', _order_id, NULL,
    jsonb_build_object(
      'inventory_ids', to_jsonb(_claimed_ids),
      'is_bundle', _is_bundle,
      'providers', to_jsonb(_providers),
      'source', 'd2_auto_claim',
      'slug', _slug,
      'duration', _duration
    ));

  RETURN jsonb_build_object(
    'claimed', true, 'is_bundle', _is_bundle,
    'inventory_ids', to_jsonb(_claimed_ids),
    'providers', to_jsonb(_providers), 'slug', _slug
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'claimed', false, 'reason', 'rpc_exception',
    'error', SQLERRM, 'order_id', _order_id::text
  );
END;
$function$;

-- ============= EXECUTE 3: check_stock_available =============
CREATE OR REPLACE FUNCTION public.check_stock_available(_slug text, _duration integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _product RECORD;
  _providers subscription_provider[];
  _count int;
  _required_devices smallint;
  _bundle_falcon_count int;
  _bundle_hulk_count int;
BEGIN
  SELECT * INTO _product FROM public.products WHERE slug = _slug LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('available', false, 'reason', 'product_not_found');
  END IF;

  IF NOT _product.stock_management_enabled THEN
    RETURN jsonb_build_object('available', true, 'reason', 'stock_management_disabled');
  END IF;

  _providers := get_providers_from_slug(_slug);

  IF array_length(_providers, 1) IS NULL THEN
    RETURN jsonb_build_object('available', false, 'reason', 'unknown_slug');
  END IF;

  _required_devices := CASE WHEN _slug LIKE '%-2dev' THEN 2 ELSE 1 END;

  IF _slug = 'bundle-falcon-hulk-1y' THEN
    SELECT COUNT(*) INTO _bundle_falcon_count
      FROM public.subscription_inventory
      WHERE provider = 'falcon' AND duration_months = _duration AND device_limit = 1 AND status = 'available';

    SELECT COUNT(*) INTO _bundle_hulk_count
      FROM public.subscription_inventory
      WHERE provider = 'hulk' AND duration_months = _duration AND device_limit = 1 AND status = 'available';

    RETURN jsonb_build_object(
      'available', _bundle_falcon_count > 0 AND _bundle_hulk_count > 0,
      'falcon_count', _bundle_falcon_count,
      'hulk_count', _bundle_hulk_count,
      'is_bundle', true
    );
  END IF;

  SELECT COUNT(*) INTO _count
    FROM public.subscription_inventory
    WHERE provider = _providers[1]
      AND duration_months = _duration
      AND device_limit = _required_devices
      AND status = 'available';

  RETURN jsonb_build_object(
    'available', _count > 0,
    'count', _count,
    'provider', _providers[1],
    'device_limit', _required_devices
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('available', true, 'reason', 'rpc_error', 'error', SQLERRM);
END;
$function$;

-- ==========================================
-- Migration File: 20260603101558_9f86a5e3-cb6b-4fc9-9b3f-1b5cc4d4bc76.sql
-- ==========================================

CREATE OR REPLACE FUNCTION public.bulk_insert_inventory(_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _inserted int := 0;
  _failed int := 0;
  _errors jsonb := '[]'::jsonb;
  _item jsonb;
BEGIN
  IF NOT public.can_modify_data(auth.uid()) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    BEGIN
      INSERT INTO public.subscription_inventory (
        provider, username, password, url, extra_info,
        duration_months, device_limit, expires_at, cogs, cogs_currency, notes, status
      ) VALUES (
        (_item->>'provider')::public.subscription_provider,
        _item->>'username',
        _item->>'password',
        NULLIF(_item->>'url', ''),
        CASE WHEN _item ? 'extra_info' AND _item->'extra_info' <> 'null'::jsonb THEN _item->'extra_info' ELSE NULL END,
        (_item->>'duration_months')::int,
        COALESCE(NULLIF(_item->>'device_limit', '')::smallint, 1),
        NULLIF(_item->>'expires_at', '')::timestamptz,
        NULLIF(_item->>'cogs', '')::numeric,
        COALESCE(NULLIF(_item->>'cogs_currency', ''), 'SAR'),
        NULLIF(_item->>'notes', ''),
        'available'
      );
      _inserted := _inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      _failed := _failed + 1;
      _errors := _errors || jsonb_build_object(
        'username', _item->>'username',
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', _inserted,
    'failed', _failed,
    'errors', _errors
  );
END;
$function$;

