-- Hook quota enforcement BEFORE insert on generations
DROP TRIGGER IF EXISTS trg_enforce_generation_quota ON public.generations;
CREATE TRIGGER trg_enforce_generation_quota
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_quota();

-- Hook telegram notification AFTER insert on subscription_requests
DROP TRIGGER IF EXISTS trg_notify_admin_on_subscription_request ON public.subscription_requests;
CREATE TRIGGER trg_notify_admin_on_subscription_request
AFTER INSERT ON public.subscription_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_subscription_request();