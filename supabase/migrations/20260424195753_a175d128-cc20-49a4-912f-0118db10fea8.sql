
-- حصر تنفيذ الدوال على المستخدمين المسجَّلين فقط
REVOKE EXECUTE ON FUNCTION public.consume_credits(integer, public.credit_txn_type, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.consume_credits(integer, public.credit_txn_type, uuid, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.consume_text_quota() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.consume_text_quota() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_credits_summary() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_credits_summary() TO authenticated;
