
-- =====================================================================
-- P1 Security: قفل INSERT على generations لمنع تجاوز الحصة والتزوير
-- =====================================================================
-- الإستراتيجية:
-- 1. نُنشئ دالة SECURITY DEFINER اسمها record_generation تستقبل القيم الحساسة
--    وتُدخل الصف بقيمها الحقيقية. هذه الدالة وحدها مَن يكتب cost/tokens/model.
-- 2. نُنشئ trigger BEFORE INSERT على generations يصفّر/يرفض الحقول الحساسة
--    إن جاء الإدراج من دور authenticated (المستخدم العادي عبر العميل)،
--    ويسمح بالقيم الكاملة فقط للسياق الخاص (security_definer = local setting).
-- 3. النتيجة: المستخدم لا يستطيع تزوير cost/tokens حتى لو أدرج صفاً يدوياً.
-- =====================================================================

-- 1) دالة آمنة للسيرفر تستخدم session-local marker
CREATE OR REPLACE FUNCTION public.record_generation(
  _type public.generation_type,
  _prompt text,
  _result text,
  _template text DEFAULT NULL,
  _model_used text DEFAULT NULL,
  _prompt_tokens integer DEFAULT NULL,
  _completion_tokens integer DEFAULT NULL,
  _total_tokens integer DEFAULT NULL,
  _estimated_cost_usd numeric DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS public.generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.generations;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  -- نضع علامة جلسة محلية تسمح للـ trigger بقبول الحقول الحساسة
  PERFORM set_config('app.trusted_generation_insert', 'on', true);

  INSERT INTO public.generations (
    user_id, type, prompt, result, template,
    model_used, prompt_tokens, completion_tokens, total_tokens,
    estimated_cost_usd, metadata
  ) VALUES (
    _uid, _type, _prompt, _result, _template,
    _model_used, _prompt_tokens, _completion_tokens, _total_tokens,
    _estimated_cost_usd, _metadata
  )
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_generation(
  public.generation_type, text, text, text, text,
  integer, integer, integer, numeric, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_generation(
  public.generation_type, text, text, text, text,
  integer, integer, integer, numeric, jsonb
) TO authenticated;

-- 2) trigger يفرض القيم الموثوقة فقط
CREATE OR REPLACE FUNCTION public.enforce_generation_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _trusted text := current_setting('app.trusted_generation_insert', true);
BEGIN
  -- إجبار user_id = auth.uid() دائماً
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    NEW.user_id := auth.uid();
  END IF;

  -- إن لم يكن السياق موثوقاً (إدراج مباشر من العميل)، صفّر الحقول الحساسة
  IF _trusted IS DISTINCT FROM 'on' THEN
    NEW.estimated_cost_usd := NULL;
    NEW.prompt_tokens := NULL;
    NEW.completion_tokens := NULL;
    NEW.total_tokens := NULL;
    NEW.model_used := NULL;
    NEW.is_favorite := false;
    -- نسمح بالـprompt/result/type/template/metadata كما هي (لا تأثير على الفوترة)
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_generation_integrity ON public.generations;
CREATE TRIGGER trg_enforce_generation_integrity
BEFORE INSERT ON public.generations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generation_integrity();

COMMENT ON FUNCTION public.record_generation IS
  'مدخل آمن لإنشاء توليدات مع قيم cost/tokens موثوقة. يُستخدم من server functions فقط.';

COMMENT ON FUNCTION public.enforce_generation_integrity IS
  'يمنع المستخدم من تزوير cost/tokens/model عند الإدراج المباشر، ويفرض user_id = auth.uid().';
