
-- نمنح authenticated صلاحية الاستدعاء، والدالة نفسها تفحص has_role admin داخلياً
GRANT EXECUTE ON FUNCTION public.activate_topup_purchase(uuid) TO authenticated;
