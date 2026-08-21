
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
