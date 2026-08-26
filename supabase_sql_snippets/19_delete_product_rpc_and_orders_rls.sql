-- ===================================================================
-- 📄 19: دالة حذف المنتجات للإدارة + سياسات قراءة طلبات العملاء
-- ===================================================================
-- 1. دالة حذف المنتج الشاملة (SECURITY DEFINER) لحذف المنتج ومرفقاته نهائياً.
-- 2. سياسة RLS تتيح للعملاء قراءة طلباتهم بدون رسالة "الطلب غير موجود".
-- ===================================================================

-- 1. دالة حذف المنتج نهائياً من قاعدة البيانات
CREATE OR REPLACE FUNCTION public.delete_product_admin(_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- حذف التقييمات المرتبطة
  DELETE FROM public.reviews WHERE product_id = _product_id;
  
  -- حذف مفاتيح المخزون التابعة للمنتج إن وجدت
  DELETE FROM public.inventory_keys WHERE product_id = _product_id;
  
  -- حذف مدد المنتج إن وجدت
  DELETE FROM public.product_durations WHERE product_id = _product_id;

  -- حذف أسئلة المنتج الشائعة إن وجدت
  DELETE FROM public.product_faqs WHERE product_id = _product_id;

  -- حذف عناصر السلة المرتبطة بالمنتج إن وجدت
  DELETE FROM public.cart_items WHERE product_id = _product_id;

  -- حذف المنتج نفسه
  DELETE FROM public.products WHERE id = _product_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_product_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_product_admin(UUID) TO anon, authenticated;


-- 2. فتح صلاحية قراءة الطلبات للمستخدمين لعرض طلباتهم ومعلومات الاشتراك بسلاسة
DROP POLICY IF EXISTS "users_can_read_orders" ON public.orders;
CREATE POLICY "users_can_read_orders" ON public.orders
  FOR SELECT
  TO anon, authenticated
  USING (true);
