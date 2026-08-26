-- ===================================================================
-- 24: confirm_order_paid with auto-claim + secure delivery status
-- ===================================================================
-- 1. Update confirm_order_paid to auto-claim inventory on payment confirmation
--    If stock available -> order becomes 'fulfilled' immediately
--    If no stock -> order stays 'paid' for manual delivery
-- 2. Add get_order_delivery_status - only exposes credentials when fulfilled
-- ===================================================================


-- ─────────────────────────────────────────────────────────────────
-- 1. Update confirm_order_paid to include auto-claim
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_order_paid(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_claim JSONB;
  v_final_status text;
BEGIN
  -- 1. Try to mark order as paid (only from pending/initiated/failed/payment_failed states)
  UPDATE public.orders
  SET status = 'paid', updated_at = NOW()
  WHERE id = _order_id AND status IN ('pending', 'initiated', 'failed', 'payment_failed')
  RETURNING id, order_number, total, customer_name, customer_phone, customer_email, status INTO v_order;

  -- Idempotent: order already paid or fulfilled
  IF v_order.id IS NULL THEN
    SELECT id, order_number, total, customer_name, customer_phone, customer_email, status
    INTO v_order FROM public.orders WHERE id = _order_id;

    IF v_order.id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'total', v_order.total,
      'status', v_order.status
    );
  END IF;

  -- 2. Update payment transaction record
  UPDATE public.payment_transactions
  SET status = 'success', updated_at = NOW()
  WHERE order_id = _order_id;

  -- 3. Try auto-claim from subscription inventory (non-blocking)
  BEGIN
    SELECT public.claim_subscription_for_order(_order_id) INTO v_claim;
  EXCEPTION WHEN OTHERS THEN
    v_claim := jsonb_build_object(
      'claimed', false,
      'reason', 'exception',
      'error', SQLERRM
    );
  END;

  -- Get final status after auto-claim attempt
  SELECT status INTO v_final_status FROM public.orders WHERE id = _order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'total', v_order.total,
    'status', v_final_status,
    'auto_claimed', COALESCE((v_claim->>'claimed')::boolean, false),
    'claim_reason', v_claim->>'reason'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order_paid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_order_paid(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_subscription_for_order(UUID) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.confirm_order_paid(UUID) IS
  '24 (Aug 2026): Payment confirmation + auto-claim inventory. If stock -> fulfilled immediately, else -> paid for manual delivery.';


-- ─────────────────────────────────────────────────────────────────
-- 2. Secure delivery status view
--    ONLY exposes subscription credentials when status = 'fulfilled'
--    All other statuses (paid, pending, failed, cancelled) return NULL credentials
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_order_delivery_status(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT
    id, order_number, status, fulfilled_at,
    subscription_username, subscription_password,
    subscription_url, subscription_extra_info
  INTO v_row
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Only expose credentials when fulfilled
  IF v_row.status = 'fulfilled' THEN
    RETURN jsonb_build_object(
      'found', true,
      'status', v_row.status,
      'order_number', v_row.order_number,
      'fulfilled_at', v_row.fulfilled_at,
      'subscription_username', v_row.subscription_username,
      'subscription_password', v_row.subscription_password,
      'subscription_url', v_row.subscription_url,
      'subscription_extra_info', v_row.subscription_extra_info
    );
  END IF;

  -- For paid/pending/failed: hide credentials entirely
  RETURN jsonb_build_object(
    'found', true,
    'status', v_row.status,
    'order_number', v_row.order_number,
    'fulfilled_at', NULL,
    'subscription_username', NULL,
    'subscription_password', NULL,
    'subscription_url', NULL,
    'subscription_extra_info', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_delivery_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_delivery_status(UUID) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_order_delivery_status(UUID) IS
  '24 (Aug 2026): Secure delivery status. Credentials only visible when status=fulfilled.';
