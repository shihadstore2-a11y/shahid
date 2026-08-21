-- Auto-assign admin role to saalla012@gmail.com on signup
-- Also assigns retroactively if user already exists

-- 1. Update handle_new_user to grant admin to specific email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  );

  -- Grant admin role to the founder email, regular user role to everyone else
  IF LOWER(NEW.email) = 'saalla012@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Retroactively grant admin if the user already exists
DO $$
DECLARE
  founder_id uuid;
BEGIN
  SELECT id INTO founder_id FROM auth.users WHERE LOWER(email) = 'saalla012@gmail.com' LIMIT 1;
  IF founder_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (founder_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;