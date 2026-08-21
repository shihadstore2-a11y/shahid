# 🗺 خريطة الكود — Codebase Map

## 🏗 Stack
- **Framework**: TanStack Start v1 (React 19 + Vite 7)
- **Deployment**: Cloudflare Workers (Edge SSR)
- **Database**: Lovable Cloud (Supabase) — PostgreSQL مع RLS
- **AI**: Lovable AI Gateway (Gemini 2.5/3.1, GPT-5) + fal.ai (PixVerse video)
- **Email**: Resend (مُدار عبر Connectors)
- **Telegram**: مُدار عبر Connectors
- **Language/Locale**: عربي (RTL)، السوق السعودي

---

## 📁 الهيكل العام

```
src/
├── routes/              # File-based routing (TanStack)
│   ├── api.*.ts          # HTTP endpoints
│   ├── api.public.*.ts   # Public endpoints (NO auth, تحقق دوي يدوياً)
│   ├── lovable/email/*   # Email infra (queue, transactional, auth)
│   ├── hooks/*           # Cron-like hooks
│   ├── admin.*.tsx       # 18 لوحة أدمن
│   ├── dashboard.*.tsx   # 13 صفحة مستخدم
│   └── for-*.tsx         # 6 صفحات قطاعات SEO
├── server/              # createServerFn wrappers (RPC)
│   ├── admin-*.ts        # 9 ملفات خاصة بالأدمن
│   ├── ai-functions.ts   # توليد النصوص/الصور
│   ├── video-functions.ts # توليد الفيديو
│   ├── credits.ts        # نظام النقاط
│   ├── cost.ts           # تقدير التكاليف
│   ├── consent-functions.ts # GDPR/Consent
│   └── lovable-ai.ts     # Wrapper لـ Lovable AI Gateway
├── lib/
│   ├── plan-catalog.ts   # ⚠️ مصدر الأسعار/الميزات (UI only)
│   ├── email-templates/  # 17 قالب بريد
│   └── analytics/posthog.ts
├── components/          # ~80 component (shadcn-based)
├── integrations/
│   ├── supabase/client.ts        # Browser client
│   ├── supabase/client.server.ts # Service role (server only)
│   └── supabase/auth-middleware.ts
└── hooks/use-auth.tsx
```

---

## 🔐 Public Endpoints (بدون JWT) — افحصها!

| المسار | الغرض | الحماية |
|---|---|---|
| `/api/public/contact-submit` | استقبال نموذج التواصل | rate limit + validation |
| `/api/public/hooks/check-email-dlq` | cron: فحص DLQ بريد | secret header |
| `/api/public/hooks/check-stale-subscriptions` | cron: طلبات معلقة | secret header |
| `/api/public/hooks/ocr-receipt` | OCR للإيصالات | secret header |
| `/api/public/video-provider-callback` | callback من fal.ai | HMAC signature |
| `/lovable/email/auth/webhook` | webhook بريد الـ auth | secret header |
| `/lovable/email/auth/preview` | preview قوالب | ⚠️ تحقق |
| `/lovable/email/queue/process` | معالجة طابور البريد | secret header |
| `/lovable/email/transactional/send` | إرسال بريد | secret header |
| `/lovable/email/transactional/preview` | preview | ⚠️ تحقق |
| `/lovable/email/suppression` | suppression list | secret header |
| `/email/unsubscribe` | إلغاء اشتراك | token-based |

**⚠️ راجع كل ملف منها لتأكيد التحقق من signature/secret/token.**

---

## 🛠 Server Functions Map (`src/server/`)

| الملف | الغرض الرئيسي |
|---|---|
| `admin-ab-tests.ts` | إدارة تجارب A/B |
| `admin-abuse.ts` | مراقبة الإساءة |
| `admin-analytics.ts` | KPIs، funnel، MRR |
| `admin-audit.ts` | سجل التدقيق |
| `admin-auth.ts` | `assertAdmin()` + `logAdminAudit()` |
| `admin-contact-submissions.ts` | رسائل التواصل |
| `admin-credits.ts` | إدارة نقاط المستخدمين |
| `admin-plan-limits.ts` | حدود الخطط |
| `admin-reconcile.ts` | مطابقة `usage_logs` ↔ `generations` |
| `admin-subscriptions.ts` | تفعيل/إلغاء اشتراكات |
| `admin-video.ts` | إدارة `video_jobs` + `video_provider_configs` |
| `ai-functions.ts` | `generateText`, `generateImage` (يخصم نقاط/quota) |
| `campaign-packs.ts` | استوديو الحملات (المنتج الرئيسي) |
| `consent-functions.ts` | recordConsent, withdrawConsent (GDPR) |
| `cost.ts` | ⚠️ تقديرات تكلفة AI (داخلية، ليست من Gateway) |
| `credits.ts` | `consumeCredits`, `refundCredits` (يستدعي RPCs) |
| `dns-check.ts` | فحص DNS للنطاق |
| `lovable-ai.ts` | Wrapper موحد لـ Lovable AI Gateway |
| `prompt-memory.ts` | ذاكرة prompts المستخدم |
| `prompts.ts` | بناء prompts ذكية من بروفايل المتجر |
| `public-stats.ts` | إحصاءات عامة (founding seats, etc) |
| `receipt-ocr.ts` | OCR إيصالات الدفع |
| `receipts.ts` | فاتورة PDF |
| `send-welcome.ts` | بريد ترحيب |
| `video-functions.ts` | `requestVideoJob`, `pollVideoJob` |

---

## 📜 آخر 10 Migrations
```
20260427163604 - ...
20260428163132 - ...
20260429094423 - consent system (table + functions)
20260429094811 - consent triggers
20260429114957 - consent UI fields في profiles
20260430220327 - ...
20260501075930 - consent enhancements
20260501082445 - latest consent fix
20260501091550 - claude-audit account (هذا الحساب)
```
**الكاتالوج الكامل**: 102 migration. راجع `supabase/migrations/` للتفاصيل.

---

## 🔑 Database — جداول حرجة (راجعها بعمق)

**Auth & Users**: `profiles`, `user_roles`, `user_credits`
**Billing**: `subscription_requests`, `topup_purchases`, `topup_packages`, `payment_settings`
**Plans**: `plan_entitlements` (المصدر الموثوق), `plan_credits`, `plan_limits`
**AI**: `generations`, `video_jobs`, `video_provider_configs`, `daily_text_usage`, `usage_logs`
**Credits**: `credit_ledger` (immutable audit log)
**Consent (GDPR)**: `consent_records`
**Email**: `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`
**Admin**: `admin_audit_log`, `internal_config`, `operational_switches`
**Marketing**: `app_settings` (founding seats), `ab_test_events`, `campaign_packs`
**Misc**: `contact_submissions`, `demo_rate_limits`, `dlq_alert_state`, `domain_scan_log`, `stale_subs_alert_state`

> راجع schema الكامل في **code-bundle.md** أو من خلال `supabase--read_query`.

---

## 🔌 Database Functions الحرجة (راجع code-bundle.md للنص الكامل)

- `has_role(uuid, app_role)` — أساس RLS للأدمن
- `consume_credits(amount, txn_type, ...)` — خصم نقاط فيديو
- `refund_credits(ledger_id, reason)` — استرجاع نقاط
- `consume_text_quota()` / `consume_image_quota(quality)` — حدود يومية
- `record_generation(...)` — تسجيل توليد + تكلفة
- `reset_monthly_credits(user_id, plan)` — تجديد شهري
- `activate_topup_purchase(purchase_id)` — تفعيل شحن
- `plan_entitlement_for_user(uuid)` — جلب حقوق الخطة
- `get_user_credits_summary()` — ملخص للمستخدم
- `get_founding_status()` — حالة برنامج التأسيس
- `enforce_generation_quota()` — trigger يمنع تجاوز الشهري
- `enforce_video_processing_limit()` — أقصى 2 فيديو متزامن
- `protect_profile_plan_change()` — يمنع تغيير الخطة من غير الأدمن/service
- `handle_new_user()` — trigger ينشئ profile + role + credits
- `notify_admin_on_subscription_request()` — webhook Telegram
- `record_consent` / `withdraw_consent` / `has_marketing_consent` (GDPR)

---

## ⚙️ ملفات تهيئة حرجة

| الملف | الغرض |
|---|---|
| `supabase/config.toml` | إعدادات Supabase (project_id only) |
| `vite.config.ts` | Vite + TanStack plugins |
| `wrangler.jsonc` | Cloudflare Workers config |
| `tsconfig.json` | TypeScript strict mode |
| `package.json` | الاعتماديات |
| `src/styles.css` | Design tokens (oklch) |
| `tailwind.config.ts` | Tailwind v4 config |
| `.env` | فقط VITE_SUPABASE_* (publishable) |

---

## 🎯 نقاط مراجعة موصى بها (Hot Spots)

1. **`src/server/credits.ts`** + RPC `consume_credits` — هل كل عملية AI تخصم؟
2. **`src/server/cost.ts`** — هل التقديرات حديثة ودقيقة؟
3. **`src/server/video-functions.ts`** — معدل refund المرتفع، fallback المزود
4. **`src/server/ai-functions.ts`** — error handling، retry logic
5. **`src/lib/plan-catalog.ts`** vs `plan_entitlements` — تطابق؟
6. **`src/routes/onboarding.tsx`** — friction، abandonment
7. **`src/routes/dashboard.campaign-studio.tsx`** — المنتج الرئيسي
8. **`src/routes/api.public.*.ts`** — كل ملف، كل sig verification
9. **`src/integrations/supabase/auth-middleware.ts`** — صحة JWT
10. **`src/components/quota-exceeded-dialog.tsx`** — هل CTA الترقية واضح؟
