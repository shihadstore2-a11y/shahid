-- ===================================================================
-- 26: Abandoned Orders Cleanup Functions
-- ===================================================================
-- الهدف:
-- توفير دوال آمنة لحذف وتنظيف السلات المتروكة (pending / initiated / payment_failed)
-- مع حماية مطلقة تمنع حذف أي طلب مدفوع (paid / fulfilled / refunded)
-- ===================================================================

-- 1. دالة تنظيف السلات المتروكة القديمة (أقدم من عدد ساعات محدد)
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_orders(
  _older_than_hours INT DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INT;
  v_cutoff_time TIMESTAMPTZ;
BEGIN
  IF _older_than_hours IS NOT NULL AND _older_than_hours > 0 THEN
    v_cutoff_time := NOW() - (_older_than_hours || ' hours')::INTERVAL;
  ELSE
    v_cutoff_time := NOW();
  END IF;

  -- حذف فقط السلات غير المدفوعة التي سبقت وقت القطع
  WITH deleted AS (
    DELETE FROM public.orders
    WHERE status IN ('pending', 'initiated', 'payment_failed')
      AND created_at <= v_cutoff_time
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'older_than_hours', _older_than_hours,
    'cutoff_time', v_cutoff_time
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_abandoned_orders(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_abandoned_orders(INT) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.cleanup_abandoned_orders(INT) IS
  '26 (26 Aug 2026): Safe cleanup of abandoned checkouts (pending/initiated/payment_failed) older than N hours.';
