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