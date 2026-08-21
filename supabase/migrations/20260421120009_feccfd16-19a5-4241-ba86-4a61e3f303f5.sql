-- Clear stale Resend-era logs (root cause "Emails disabled" — no longer applicable)
DELETE FROM public.email_send_log
WHERE status IN ('pending','dlq')
  AND created_at < '2026-04-21'::date;

-- Purge any orphaned messages still sitting in pgmq queues
SELECT pgmq.purge_queue('auth_emails');
SELECT pgmq.purge_queue('transactional_emails');