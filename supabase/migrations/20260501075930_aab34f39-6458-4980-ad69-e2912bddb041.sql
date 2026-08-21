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