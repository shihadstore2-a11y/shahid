-- ===================================================================
-- 📄 13: تأمين مستودع الصور وتخصيص الصلاحيات (Storage Security & Isolation)
-- حل تحذير Supabase: "Clients can list all files in this bucket"
-- ===================================================================
-- الشرح:
-- 1. الدلو (Bucket) 'product-images' مضبوط كـ Public لكي تظهر الصور للزبائن في المتجر مباشرة عبر الرابط.
-- 2. في الدلاء العامة، الزوار لا يحتاجون صلاحية استعراض قائمة الملفات (list/select on storage.objects).
-- 3. صلاحيات الرفع، التعديل، الحذف، واستعراض قائمة المجلدات تقتصر فقط على مديري المتاجر الموثقين.
-- ===================================================================

-- 1. التأكد من وجود الدلو وضبطه كعام للتحميل المباشر
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152, -- 2MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. إزالة أي سياسات سابقة تسمح للعامة باستعراض مجلدات التخزين بالكامل
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select on product-images" ON storage.objects;
DROP POLICY IF EXISTS "admin_product_images_select" ON storage.objects;
DROP POLICY IF EXISTS "admin_product_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "admin_product_images_update" ON storage.objects;
DROP POLICY IF EXISTS "admin_product_images_delete" ON storage.objects;

-- 3. قصر استعراض قائمة الملفات (Listing/Select) على الأدمن ومدير المتجر فقط
CREATE POLICY "admin_product_images_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_admin(auth.uid())
);

-- 4. صلاحية رفع الصور (Upload/Insert) لمدير المتجر فقط
CREATE POLICY "admin_product_images_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_admin(auth.uid())
);

-- 5. صلاحية تحديث الصور (Update) لمدير المتجر فقط
CREATE POLICY "admin_product_images_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_admin(auth.uid())
);

-- 6. صلاحية حذف الصور (Delete) لمدير المتجر فقط
CREATE POLICY "admin_product_images_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_admin(auth.uid())
);
