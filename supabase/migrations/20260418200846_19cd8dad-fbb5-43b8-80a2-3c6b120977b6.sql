UPDATE public.internal_config 
SET value = 'https://id-preview--694f48b8-26d0-46e8-9443-b81b61c8f1f6.lovable.app/api/notify-telegram-admin',
    updated_at = now()
WHERE key = 'notify_webhook_url';