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
