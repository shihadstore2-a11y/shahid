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
