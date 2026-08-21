-- Reconcile usage_logs against actual generations counts
-- Admin-only. Returns a report of corrections made.
CREATE OR REPLACE FUNCTION public.reconcile_usage_logs(_month text DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  month text,
  old_text_count integer,
  new_text_count integer,
  old_image_count integer,
  new_image_count integer,
  text_diff integer,
  image_diff integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _admin_id uuid := auth.uid();
  _target_month text;
  _rows_affected integer := 0;
  _total_text_diff integer := 0;
  _total_image_diff integer := 0;
  _users_corrected integer := 0;
BEGIN
  -- Admin guard
  IF _admin_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT public.has_role(_admin_id, 'admin'::app_role) INTO _is_admin;
  IF NOT _is_admin THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  -- Default to current Riyadh month
  _target_month := COALESCE(_month, to_char((now() AT TIME ZONE 'Asia/Riyadh')::date, 'YYYY-MM'));

  -- Build actual counts from generations for the month
  CREATE TEMP TABLE _actual ON COMMIT DROP AS
  SELECT
    g.user_id,
    _target_month AS month,
    COUNT(*) FILTER (WHERE g.type = 'text')::int AS text_count,
    COUNT(*) FILTER (WHERE g.type IN ('image','image_enhance'))::int AS image_count
  FROM public.generations g
  WHERE to_char((g.created_at AT TIME ZONE 'Asia/Riyadh')::date, 'YYYY-MM') = _target_month
  GROUP BY g.user_id;

  -- Also include users who have a usage row but zero generations (to zero them out)
  INSERT INTO _actual (user_id, month, text_count, image_count)
  SELECT u.user_id, _target_month, 0, 0
  FROM public.usage_logs u
  WHERE u.month = _target_month
    AND u.user_id NOT IN (SELECT a.user_id FROM _actual a);

  -- Return diffs and apply corrections
  RETURN QUERY
  WITH joined AS (
    SELECT
      a.user_id,
      a.month,
      COALESCE(u.text_count, 0)  AS old_text_count,
      a.text_count               AS new_text_count,
      COALESCE(u.image_count, 0) AS old_image_count,
      a.image_count              AS new_image_count
    FROM _actual a
    LEFT JOIN public.usage_logs u
      ON u.user_id = a.user_id AND u.month = a.month
  ),
  diffs AS (
    SELECT
      j.*,
      (j.new_text_count  - j.old_text_count)  AS text_diff,
      (j.new_image_count - j.old_image_count) AS image_diff
    FROM joined j
    WHERE j.new_text_count <> j.old_text_count
       OR j.new_image_count <> j.old_image_count
  ),
  upserted AS (
    INSERT INTO public.usage_logs (user_id, month, text_count, image_count, updated_at)
    SELECT d.user_id, d.month, d.new_text_count, d.new_image_count, now()
    FROM diffs d
    ON CONFLICT (user_id, month) DO UPDATE
      SET text_count  = EXCLUDED.text_count,
          image_count = EXCLUDED.image_count,
          updated_at  = now()
    RETURNING usage_logs.user_id
  )
  SELECT d.user_id, d.month,
         d.old_text_count, d.new_text_count,
         d.old_image_count, d.new_image_count,
         d.text_diff, d.image_diff
  FROM diffs d;

  GET DIAGNOSTICS _rows_affected = ROW_COUNT;

  -- Audit log entry (best-effort)
  BEGIN
    INSERT INTO public.admin_audit_log (
      admin_user_id, action, target_table, target_id, before_value, after_value, metadata
    ) VALUES (
      _admin_id,
      'reconcile_usage_logs',
      'usage_logs',
      _target_month,
      NULL,
      jsonb_build_object('users_corrected', _rows_affected),
      jsonb_build_object('month', _target_month)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit log insert failed: %', SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_usage_logs(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_usage_logs(text) TO authenticated;