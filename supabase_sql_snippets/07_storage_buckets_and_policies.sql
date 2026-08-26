-- ===================================================================
-- 📄 07: إعداد مستودعات التخزين وسياسات الأمان (Storage Buckets & Policies)
-- الوصف: إنشاء مستودعات تخزين الصور والإيصالات وتفعيل سياسات الرفع والقراءة
-- ===================================================================

-- 1. إنشاء مستودع صور المنتجات (عام للجميع للقراءة، وللمشرفين للرفع)
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- 2. إنشاء مستودع إيصالات الدفع والتحويل البنكي (خاص للعملاء والمشرفين)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 3. إنشاء مستودع ملفات المنصة الأم للفيديوهات والصور المولدة
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-assets', 'generated-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 4. سياسات الأمان لمستودع الصور (قراءة عامة للجميع، ورفع للمشرفين)
DROP POLICY IF EXISTS "products_storage_public_read" ON storage.objects;
CREATE POLICY "products_storage_public_read" ON storage.objects
FOR SELECT USING (bucket_id = 'products');

DROP POLICY IF EXISTS "products_storage_admin_insert" ON storage.objects;
CREATE POLICY "products_storage_admin_insert" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'products' AND public.is_admin(auth.uid()));

-- 5. سياسات الأمان لمستودع إيصالات الدفع
DROP POLICY IF EXISTS "receipts_storage_insert" ON storage.objects;
CREATE POLICY "receipts_storage_insert" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "receipts_storage_read" ON storage.objects;
CREATE POLICY "receipts_storage_read" ON storage.objects
FOR SELECT USING (bucket_id = 'receipts');
