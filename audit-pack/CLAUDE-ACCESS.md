# 🔐 حزمة الوصول الكاملة لـ Claude Max — مراجعة منصة رِفد

> **المهمة**: مراجعة استراتيجية شاملة قبل حملة Telegram (الهدف: 80 مشترك مدفوع/شهر).
> **الدور**: مراجِع خارجي. **اقترح فقط، لا تُعدّل الكود مباشرة.**

---

## 🎫 1. بيانات الدخول

| الحقل | القيمة |
|---|---|
| **رابط الإنتاج** | https://rifd.site |
| **رابط تسجيل الدخول** | https://rifd.site/auth |
| **البريد** | `claude-audit@rifd.site` |
| **كلمة السر** | `Audit-Claude-2026-Full-Access-X9k` |
| **البريد مؤكد؟** | ✅ نعم (دخول مباشر بدون تحقق) |

### الصلاحيات الممنوحة
- ✅ **دور Admin كامل** (`user_roles.role = 'admin'`) → وصول لكل لوحات `/admin/*`
- ✅ **خطة Pro** نشطة سنة كاملة (`profiles.plan = 'pro'`, `cycle_ends_at = +365d`)
- ✅ **رصيد 10,000 نقطة** (5,000 plan + 5,000 topup)
- ✅ **Onboarding مكتمل** + بيانات متجر تجريبية جاهزة (تقدر تجرب أي أداة فوراً)
- ✅ **Email confirmed** (لا يحتاج تحقق بريد)

> ⚠️ هذا حساب اختبار **فقط للمراجعة**. لا يحوي بيانات حقيقية لمستخدم فعلي.

---

## 📊 2. اللوحات الإدارية (Admin Panels)

كلها تتطلب دخول الحساب أعلاه أولاً. الرابط الكامل = `https://rifd.site` + المسار:

### نظرة عامة وأولوية للمراجعة
| الأولوية | المسار | الغرض |
|---|---|---|
| 🔴 **ابدأ هنا** | `/admin/analytics` | KPIs، funnel، MRR، عدد المستخدمين |
| 🔴 عالية | `/admin/credit-ledger` | كل حركات النقاط (plan_grant/consume/refund/topup) |
| 🔴 عالية | `/admin/subscriptions` | الاشتراكات النشطة، المعلقة، المنتهية |
| 🔴 عالية | `/admin/abuse-monitor` | محاولات إساءة، rate limiting |
| 🟡 متوسطة | `/admin/video-jobs` | حالة الفيديوهات، نسبة الفشل/الـ refund |
| 🟡 متوسطة | `/admin/email-monitor` | DLQ + معدلات إرسال البريد |
| 🟡 متوسطة | `/admin/audit` | سجل تدقيق كل إجراءات الأدمن |
| 🟢 مرجعية | `/admin/plan-limits` | حدود الخطط (شهري/يومي) |
| 🟢 مرجعية | `/admin/credits` | إدارة نقاط المستخدمين |
| 🟢 مرجعية | `/admin/campaign-packs` | حزم الحملات الجاهزة |
| 🟢 مرجعية | `/admin/contact-submissions` | رسائل الـ contact |
| 🟢 مرجعية | `/admin/ab-tests` | تجارب A/B |
| 🟢 مرجعية | `/admin/dns-check` | فحص DNS للنطاق |
| 🟢 مرجعية | `/admin/domain-scan` | فحص النطاق |
| 🟢 مرجعية | `/admin/reconcile` | مطابقة usage_logs مع generations |
| 🟢 مرجعية | `/admin/video-providers` | إعدادات مزودي الفيديو |
| 🟢 مرجعية | `/admin/video-jobs` | تفاصيل المهام |

---

## 🛠 3. لوحات المستخدم (Dashboard) — تجربة العميل النهائي

| المسار | الغرض |
|---|---|
| `/dashboard` | الواجهة الرئيسية للمستخدم |
| `/dashboard/generate-text` | توليد نصوص (المنشورات) |
| `/dashboard/generate-image` | توليد صور |
| `/dashboard/edit-image` | تعديل صور |
| `/dashboard/generate-video` | توليد فيديوهات |
| `/dashboard/campaign-studio` | استوديو الحملات (المنتج الرئيسي) |
| `/dashboard/library` | مكتبة المحتوى المُنتج |
| `/dashboard/templates` | قوالب جاهزة |
| `/dashboard/billing` | الفواتير والاشتراكات |
| `/dashboard/credits` | شراء نقاط إضافية |
| `/dashboard/usage` | استخدام شهري |
| `/dashboard/store-profile` | بروفايل المتجر (الذاكرة) |
| `/dashboard/settings` | إعدادات الحساب + إدارة الموافقات (Consent) |

### الصفحات العامة (بدون دخول)
- `/` الرئيسية، `/pricing` الأسعار، `/about` من نحن
- `/proof-center` مركز الإثبات
- `/business-solutions` حلول الأعمال
- `/for-abayas-fashion`, `/for-perfumes-beauty`, `/for-electronics-accessories`, `/for-gifts-sweets-coffee`, `/for-home-decor`, `/for-kids-baby` (صفحات قطاعات)
- `/legal/terms`, `/legal/privacy`, `/legal/refund` (قانوني)

---

## ⚠️ 4. تنبيهات صريحة — اكتشف وأبلغ

نحن **نعرف** عن بعض المخاطر. مهمتك تأكيدها وكشف غيرها:

### مخاطر معروفة (راجعها وقيّمها)
1. **Single Point of Failure للفيديو**: مزود `fal.ai` (PixVerse v6) هو الوحيد المُفعّل في `video_provider_configs`. لو سقط = تعطل كامل لميزة الفيديو.
2. **معدل refund الفيديو مرتفع**: قراءات سابقة 27-43% — تحقق من `/admin/video-jobs` و`credit_ledger` (txn_type='refund').
3. **3 طلبات اشتراك Pro منتهية**: في `subscription_requests` بحالة `pending` تجاوزت 24 ساعة — راجع `/admin/subscriptions`.
4. **تكاليف AI تقديرية**: `src/server/cost.ts` يحوي تقديرات داخلية—لا يوجد ربط مباشر بـ Lovable AI Gateway pricing API. تحقق من مدى دقتها.
5. **حساب الأدمن الوحيد قبل الآن**: `saalla012@gmail.com` (مذكور في `handle_new_user` trigger كـ hardcoded admin) — راجع لو هذا مقبول.

### اكتشف بنفسك
- **RLS coverage**: هل كل الجداول الحساسة محمية؟ (راجع 31 جدول في schema)
- **Public endpoints**: راجع `src/routes/api.public.*` و `src/routes/lovable/*` — كلها بدون JWT verification
- **Secrets exposure**: تأكد لا توجد مفاتيح في الكود (`.env`، `client.ts`، أي ملف غير `.server.ts`)
- **تناقضات الخطط**: قارن `src/lib/plan-catalog.ts` مع جدول `plan_entitlements` في DB
- **استهلاك غير محسوب**: راجع `src/server/cost.ts` ضد `src/server/credits.ts` — هل كل عملية AI تخصم نقاط؟
- **Telegram readiness**: هل البنية تتحمل دفعة 200-500 مستخدم في 48 ساعة؟ راجع rate limits، DB indexes، edge function timeouts.
- **Onboarding friction**: راجع `/auth` ثم `/onboarding` — كم خطوة قبل أول قيمة؟
- **Pricing psychology**: راجع `/pricing` — هل anchoring واضح؟ هل founding offer مقنع؟

---

## 📚 5. الملفات المرفقة في الحزمة

في مجلد `audit-pack/`:

- **`CLAUDE-ACCESS.md`** ← أنت هنا
- **`SQL-QUERIES.md`** — 20+ استعلام SQL جاهز (اطلب من المالك تشغيله)
- **`CODEBASE-MAP.md`** — خريطة كاملة للكود
- **`code-bundle.md`** — محتوى 15 ملف حرج (موجود من جلسة سابقة)
- **`*.png`** — لقطات production للصفحات العامة (موجودة من جلسة سابقة)

---

## 🎯 6. منهجية المراجعة المقترحة

### اليوم 1: نظرة عامة (2 ساعة)
1. ادخل بالحساب → راجع `/admin/analytics` للأرقام الفعلية
2. اقرأ `CODEBASE-MAP.md` لفهم البنية
3. جرب `/dashboard/campaign-studio` كمستخدم نهائي (3 حملات مختلفة)

### اليوم 2: العمق التقني (3 ساعات)
1. راجع `code-bundle.md` ملف ملف
2. نفّذ استعلامات `SQL-QUERIES.md` (اطلب من المالك)
3. افحص الـ public endpoints + RLS

### اليوم 3: الاقتصاد + UX (2 ساعة)
1. احسب unit economics: تكلفة 80 مشترك Pro/شهر
2. راجع تجربة الـ onboarding كأنك مستخدم سعودي جديد
3. قيّم استعداد المنصة لحملة Telegram

### المخرجات المطلوبة
- **تقرير مخاطر**: P0 (يوقف الإطلاق)، P1 (يجب قبل الحملة)، P2 (بعد الإطلاق)
- **توصيات unit economics**: هل الأسعار الحالية مستدامة؟
- **خطة 30-60-90 يوم**: ما يجب تنفيذه قبل/أثناء/بعد الحملة
- **سيناريو الفشل**: ماذا لو fal.ai سقط في يوم الحملة؟

---

## 🚨 ملاحظة مهمة

- **لا تُعدّل الكود مباشرة** — اقترح فقط، والمالك ينفّذ مع Lovable
- **الحساب أدمن كامل** — كن حذراً: تقدر تحذف بيانات حقيقية. **اقرأ فقط، لا تكتب**.
- **عند الشك** اسأل المالك بدلاً من التخمين
- إذا احتجت بيانات إضافية، اطلب SQL محدد من المالك من `SQL-QUERIES.md` أو خارجها
