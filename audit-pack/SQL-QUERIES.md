# 📊 SQL Queries جاهزة لمراجعة Claude

> اطلب من المالك تشغيل أي استعلام تحتاجه. كلها **READ-ONLY**.

---

## 1. KPIs أساسية (نظرة عامة)
```sql
SELECT
  (SELECT COUNT(*) FROM auth.users) AS total_signups,
  (SELECT COUNT(*) FROM profiles WHERE onboarded = true) AS onboarded,
  (SELECT COUNT(*) FROM profiles WHERE plan != 'free') AS paid_users,
  (SELECT COUNT(*) FROM subscription_requests WHERE status='activated') AS active_subs,
  (SELECT COUNT(*) FROM generations) AS total_generations,
  (SELECT ROUND(SUM(estimated_cost_usd)::numeric, 2) FROM generations) AS total_cost_usd;
```

## 2. Funnel كامل (تسجيل → دفع)
```sql
SELECT
  COUNT(*) AS signups,
  COUNT(*) FILTER (WHERE p.onboarded) AS onboarded,
  COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM generations g WHERE g.user_id=p.id)) AS first_generation,
  COUNT(*) FILTER (WHERE p.plan != 'free') AS upgraded
FROM profiles p;
```

## 3. MRR تقديري
```sql
SELECT
  plan, billing_cycle, COUNT(*) AS subs,
  SUM(CASE plan
    WHEN 'starter' THEN CASE billing_cycle WHEN 'yearly' THEN 99/12.0 ELSE 119 END
    WHEN 'business' THEN CASE billing_cycle WHEN 'yearly' THEN 299/12.0 ELSE 359 END
    WHEN 'pro' THEN CASE billing_cycle WHEN 'yearly' THEN 599/12.0 ELSE 719 END
  END) AS estimated_mrr_sar
FROM subscription_requests
WHERE status='activated' AND (activated_until IS NULL OR activated_until > now())
GROUP BY plan, billing_cycle;
```

## 4. توزيع الاستخدام حسب النوع
```sql
SELECT type, COUNT(*) AS count, ROUND(AVG(estimated_cost_usd)::numeric, 4) AS avg_cost,
       ROUND(SUM(estimated_cost_usd)::numeric, 2) AS total_cost
FROM generations GROUP BY type ORDER BY count DESC;
```

## 5. أعلى المستخدمين استهلاكاً
```sql
SELECT p.email, p.plan, COUNT(g.id) AS gens,
       ROUND(SUM(g.estimated_cost_usd)::numeric, 2) AS cost_usd,
       (SELECT plan_credits + topup_credits FROM user_credits WHERE user_id=p.id) AS credits_left
FROM profiles p LEFT JOIN generations g ON g.user_id=p.id
GROUP BY p.id, p.email, p.plan ORDER BY gens DESC LIMIT 20;
```

## 6. معدل refund للفيديو (مؤشر مزود فاشل)
```sql
WITH video_txns AS (
  SELECT * FROM credit_ledger WHERE txn_type IN ('consume_video','refund')
    AND created_at > now() - interval '30 days'
)
SELECT
  COUNT(*) FILTER (WHERE txn_type='consume_video') AS consumed,
  COUNT(*) FILTER (WHERE txn_type='refund') AS refunded,
  ROUND(100.0 * COUNT(*) FILTER (WHERE txn_type='refund') /
        NULLIF(COUNT(*) FILTER (WHERE txn_type='consume_video'), 0), 1) AS refund_rate_pct
FROM video_txns;
```

## 7. حالة طلبات الاشتراك (المعلقة، الفعالة، المنتهية)
```sql
SELECT status, plan, billing_cycle, COUNT(*),
       MIN(created_at) AS oldest, MAX(created_at) AS newest
FROM subscription_requests
GROUP BY status, plan, billing_cycle ORDER BY status, COUNT(*) DESC;
```

## 8. الطلبات المعلقة لأكثر من 24 ساعة
```sql
SELECT * FROM get_stale_subscription_requests();
```

## 9. صحة DLQ للبريد
```sql
SELECT * FROM check_email_dlq_health();
```

## 10. أداء مزودي الفيديو
```sql
SELECT provider, status, COUNT(*),
       ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)))::numeric, 1) AS avg_seconds
FROM video_jobs
WHERE created_at > now() - interval '30 days'
GROUP BY provider, status ORDER BY provider, status;
```

## 11. RLS coverage check
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables WHERE schemaname='public'
ORDER BY rowsecurity, tablename;
```

## 12. Public endpoints (تحقق من الحماية يدوياً في الكود)
```sql
-- لا يوجد جدول لهذا، راجع: src/routes/api.public.*.ts
-- و src/routes/lovable/email/*.ts
-- وكل route يحوي: server: { handlers: { ... } } بدون JWT verification
```

## 13. تناقضات بين plan-catalog.ts وDB
```sql
SELECT plan, monthly_price_sar, yearly_price_sar, monthly_credits,
       daily_text_cap, daily_image_cap, image_pro_allowed,
       video_fast_allowed, video_quality_allowed, max_video_duration_seconds, active
FROM plan_entitlements ORDER BY plan;
```

## 14. حركات نقاط مشبوهة (refund بدون consume أصلي)
```sql
SELECT cl.id, cl.user_id, cl.txn_type, cl.amount, cl.refund_ledger_id, cl.metadata
FROM credit_ledger cl
WHERE cl.txn_type='refund' AND cl.refund_ledger_id IS NULL
ORDER BY cl.created_at DESC LIMIT 20;
```

## 15. توزيع المستخدمين حسب الخطة
```sql
SELECT plan, COUNT(*),
       COUNT(*) FILTER (WHERE onboarded) AS onboarded,
       COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') AS new_this_week
FROM profiles GROUP BY plan ORDER BY plan;
```

## 16. سجل تدقيق آخر إجراءات الأدمن
```sql
SELECT created_at, action, target_table, target_id, metadata
FROM admin_audit_log ORDER BY created_at DESC LIMIT 50;
```

## 17. حملات A/B النشطة + النتائج
```sql
SELECT experiment, variant, event_type, COUNT(*)
FROM ab_test_events
WHERE created_at > now() - interval '30 days'
GROUP BY experiment, variant, event_type
ORDER BY experiment, variant, event_type;
```

## 18. حالة Consent (نظام الموافقات الجديد)
```sql
SELECT consent_type, consent_given, COUNT(*),
       COUNT(*) FILTER (WHERE withdrawn_at IS NOT NULL) AS withdrawn
FROM consent_records
GROUP BY consent_type, consent_given ORDER BY consent_type;
```

## 19. حملات منشأة + حالتها
```sql
SELECT status, channel, goal, COUNT(*)
FROM campaign_packs GROUP BY status, channel, goal ORDER BY COUNT(*) DESC;
```

## 20. unit economics: متوسط تكلفة لكل مستخدم Pro
```sql
WITH pro_users AS (SELECT id FROM profiles WHERE plan='pro'),
     costs AS (
       SELECT g.user_id, SUM(g.estimated_cost_usd) AS total
       FROM generations g WHERE g.user_id IN (SELECT id FROM pro_users)
         AND g.created_at > now() - interval '30 days'
       GROUP BY g.user_id
     )
SELECT COUNT(*) AS pro_users,
       ROUND(AVG(total)::numeric, 4) AS avg_cost_usd_30d,
       ROUND(MAX(total)::numeric, 4) AS max_cost_usd_30d
FROM costs;
```

## 21. أحدث الأخطاء في video_jobs
```sql
SELECT created_at, status, provider, error_message, credits_charged
FROM video_jobs WHERE error_message IS NOT NULL
ORDER BY created_at DESC LIMIT 20;
```

## 22. معدل استخدام البريد + suppression
```sql
SELECT
  (SELECT COUNT(*) FROM email_send_log WHERE created_at > now() - interval '7 days') AS sent_7d,
  (SELECT COUNT(*) FROM email_send_log WHERE status='failed' AND created_at > now() - interval '7 days') AS failed_7d,
  (SELECT COUNT(*) FROM suppressed_emails) AS total_suppressed;
```
