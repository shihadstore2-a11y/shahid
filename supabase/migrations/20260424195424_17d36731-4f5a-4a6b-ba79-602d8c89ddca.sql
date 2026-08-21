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