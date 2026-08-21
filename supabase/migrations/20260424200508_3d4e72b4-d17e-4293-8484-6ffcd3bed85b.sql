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