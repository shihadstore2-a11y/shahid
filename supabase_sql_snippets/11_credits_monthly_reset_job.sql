-- ===================================================================
-- 📄 11: وظيفة تجديد رصيد النقاط الشهري (Monthly AI Credits Reset)
-- الوصف: دالة تقوم بتجديد النقاط الشهرية للمنصة الأم لأي مستخدم انتهت دورته الشهرية
-- متى يُستخدم: يُشغّل يدوياً لتجديد النقاط أو يُربط بـ Supabase pg_cron
-- ===================================================================

CREATE OR REPLACE FUNCTION public.reset_expired_user_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated_count integer := 0;
BEGIN
  -- تجديد نقاط المشتركين الذين تجاوز تاريخ انتهاء دورتهم الوقت الحالي
  UPDATE public.user_credits uc
  SET plan_credits = COALESCE(pc.monthly_credits, 50),
      cycle_started_at = now(),
      cycle_ends_at = now() + interval '30 days'
  FROM public.profiles p
  LEFT JOIN public.plan_credits pc ON pc.plan = p.plan
  WHERE uc.user_id = p.id
    AND uc.cycle_ends_at <= now();

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  RETURN _updated_count;
END;
$$;
