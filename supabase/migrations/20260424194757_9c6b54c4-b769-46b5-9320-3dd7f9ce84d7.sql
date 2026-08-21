-- إضافة الباقات الجديدة
ALTER TYPE public.user_plan ADD VALUE IF NOT EXISTS 'starter';
ALTER TYPE public.user_plan ADD VALUE IF NOT EXISTS 'growth';