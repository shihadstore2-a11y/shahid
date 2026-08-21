-- Test data: set one subscription to expire in 7 days, one in 1 day
UPDATE subscription_requests
SET activated_until = now() + INTERVAL '7 days'
WHERE id = 'b2d7090a-a979-433c-8dfe-3745aa790407';

UPDATE subscription_requests
SET activated_until = now() + INTERVAL '1 day'
WHERE id = 'c52ad8c3-a3f9-423a-8807-e55dd77f22c2';

-- Cleanup old DLQ rows (emails disabled era) so dashboard reflects current reality
DELETE FROM email_send_log WHERE status = 'dlq';