---
name: Email domain naming
description: النطاق المُفعَّل والمُفوَّض فعلياً لإرسال البريد + قواعد كتابة sender في الكود
type: constraint
---
**النطاق الجذر للمشروع:** `rifd.site`

**النطاق المُفوَّض لإرسال البريد:** `send.rifd.site` (تم تفويضه عبر NS records لـ Lovable nameservers `ns3.lovable.cloud` + `ns4.lovable.cloud`).

**عنوان المرسل الفعلي:** `noreply@notify.send.rifd.site` (Lovable يضيف `notify` تلقائياً للـ subdomain المُفوَّض).

## قواعد الكتابة في الكود

في كل ملف يحتوي على إعداد البريد:
```ts
const SENDER_DOMAIN = "send.rifd.site";  // النطاق المُفوَّض — لا تكتب notify يدوياً
const FROM_ADDRESS = `${SITE_NAME} <noreply@notify.send.rifd.site>`;  // Lovable يضيف notify
```

**لا تستخدم:**
- ❌ `notify.rifd.site` — لم يعد مُفوَّضاً (تم استبداله بـ `send.rifd.site`)
- ❌ `notify.notify.send.rifd.site` — تكرار خاطئ
- ❌ `rifd.club` — نطاق قديم مهجور

## الملفات المتأثرة (يجب أن تتطابق دائماً)
- `src/routes/lovable/email/transactional/send.ts`
- `src/routes/lovable/email/auth/webhook.ts`
- `src/server/send-welcome.ts`
- `src/routes/hooks/expiring-subscriptions.ts`
- `src/routes/hooks/onboarding-emails.ts`
