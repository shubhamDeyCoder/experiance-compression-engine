BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Columns (additive)
-- ---------------------------------------------------------------------------
ALTER TABLE public.expert_cases
  ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_scores jsonb;

-- ---------------------------------------------------------------------------
-- 1. Answer options must be complete before an expert can submit a case
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_case_options(p_options jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item jsonb;
  v_best integer := 0;
  v_count integer;
BEGIN
  IF p_options IS NULL OR jsonb_typeof(p_options) <> 'array' THEN
    RAISE EXCEPTION 'Answer options must be a list';
  END IF;

  v_count := jsonb_array_length(p_options);
  IF v_count < 3 OR v_count > 6 THEN
    RAISE EXCEPTION 'Add between 3 and 6 answer options before submitting';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_options) LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR length(trim(coalesce(v_item->>'text', ''))) = 0
       OR length(trim(coalesce(v_item->>'feedback', ''))) = 0 THEN
      RAISE EXCEPTION 'Every answer option needs text and feedback';
    END IF;
    IF length(v_item->>'text') > 1000 OR length(v_item->>'feedback') > 2000 THEN
      RAISE EXCEPTION 'Option text is limited to 1000 characters and feedback to 2000';
    END IF;
    IF coalesce(v_item->>'score', '') !~ '^[0-9]{1,3}$' OR (v_item->>'score')::integer > 100 THEN
      RAISE EXCEPTION 'Option scores must be whole numbers from 0 to 100';
    END IF;
    v_best := greatest(v_best, (v_item->>'score')::integer);
  END LOOP;

  IF v_best < 80 THEN
    RAISE EXCEPTION 'At least one option must score 80 or more (the expert-recommended choice)';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_case_options(jsonb) FROM PUBLIC, anon, authenticated;

-- Same behaviour as before, plus the option check. Grants are preserved by CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION public.submit_case(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case public.expert_cases%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.case_roles
    WHERE user_id = auth.uid() AND role = 'expert'
  ) THEN
    RAISE EXCEPTION 'Authenticated expert role required';
  END IF;

  SELECT * INTO v_case
  FROM public.expert_cases
  WHERE id = p_case_id
    AND owner_id = auth.uid()
    AND workflow_status IN ('draft', 'rejected')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found or cannot be submitted';
  END IF;

  IF length(trim(v_case.final_solution)) = 0
     OR length(trim(v_case.lessons_learned)) = 0
  THEN
    RAISE EXCEPTION 'Add the final solution and lessons learned before submitting';
  END IF;

  PERFORM public.validate_case_options(v_case.options);

  UPDATE public.expert_cases
  SET workflow_status = 'submitted',
      is_approved = false,
      submitted_at = now(),
      reviewed_at = NULL,
      reviewed_by = NULL,
      review_feedback = NULL,
      review_scores = NULL
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  INSERT INTO public.expert_case_revisions (
    case_id, revision_number, event, snapshot, actor_id
  )
  VALUES (
    v_case.id, v_case.revision_number, 'submitted',
    to_jsonb(v_case), auth.uid()
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Reviewer rubric. The old review function is no longer callable from the browser.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_case_scored(
  p_case_id uuid,
  p_decision text,
  p_feedback text,
  p_scores jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_case_role('reviewer') THEN
    RAISE EXCEPTION 'Authorized reviewer role required';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  IF p_decision = 'rejected' AND length(trim(coalesce(p_feedback, ''))) = 0 THEN
    RAISE EXCEPTION 'Explain what the expert should revise before rejecting a case';
  END IF;

  IF p_scores IS NULL OR jsonb_typeof(p_scores) <> 'object' THEN
    RAISE EXCEPTION 'Rubric scores are required';
  END IF;

  FOREACH v_key IN ARRAY ARRAY['clarity', 'accuracy', 'practical_value', 'learning_value'] LOOP
    IF coalesce(p_scores->>v_key, '') !~ '^[1-5]$' THEN
      RAISE EXCEPTION 'Rubric score "%" must be a whole number from 1 to 5', v_key;
    END IF;
    IF p_decision = 'approved' AND (p_scores->>v_key)::integer < 3 THEN
      RAISE EXCEPTION 'Approval requires every rubric score to be at least 3 (scored below 3: %)', v_key;
    END IF;
  END LOOP;

  UPDATE public.expert_cases
  SET review_scores = jsonb_build_object(
        'clarity', (p_scores->>'clarity')::integer,
        'accuracy', (p_scores->>'accuracy')::integer,
        'practical_value', (p_scores->>'practical_value')::integer,
        'learning_value', (p_scores->>'learning_value')::integer
      )
  WHERE id = p_case_id
    AND workflow_status = 'submitted'
    AND owner_id IS DISTINCT FROM auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submitted case not found, or you are its author';
  END IF;

  -- Re-uses the existing, already-hardened transition (also snapshots the revision).
  PERFORM public.review_expert_case(p_case_id, p_decision, p_feedback);
END;
$$;

REVOKE ALL ON FUNCTION public.review_case_scored(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_case_scored(uuid, text, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.review_expert_case(uuid, text, text) FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3. Server-scored practice. The browser can no longer insert attempts or choose a score.
-- ---------------------------------------------------------------------------
REVOKE INSERT ON TABLE public.learner_attempts FROM authenticated;

CREATE OR REPLACE FUNCTION public.list_practice_cases()
RETURNS TABLE (
  id uuid,
  title text,
  domain text,
  difficulty text,
  situation text,
  question text,
  options jsonb,
  is_seed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.id, c.title, c.domain, c.difficulty, c.situation, c.question,
    -- Only the option text is returned: scores and feedback stay on the server until answered.
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object('text', t.o->>'text') ORDER BY t.ord), '[]'::jsonb)
      FROM jsonb_array_elements(c.options) WITH ORDINALITY AS t(o, ord)
    ),
    c.is_seed
  FROM public.expert_cases c
  WHERE auth.uid() IS NOT NULL
    AND c.workflow_status = 'approved'
  ORDER BY c.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.submit_case_attempt(p_case_id uuid, p_selected_option integer)
RETURNS TABLE (
  out_score integer,
  out_feedback text,
  out_best_option integer,
  out_best_feedback text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_opts jsonb;
  v_n integer;
  v_score integer;
  v_feedback text;
  v_best integer := 0;
  v_best_score integer := -1;
  i integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT c.options INTO v_opts
  FROM public.expert_cases c
  WHERE c.id = p_case_id AND c.workflow_status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved case not found';
  END IF;

  IF v_opts IS NULL OR jsonb_typeof(v_opts) <> 'array' THEN
    RAISE EXCEPTION 'This case has no scored options';
  END IF;

  v_n := jsonb_array_length(v_opts);
  IF v_n = 0 OR p_selected_option IS NULL OR p_selected_option < 0 OR p_selected_option >= v_n THEN
    RAISE EXCEPTION 'Invalid option selected';
  END IF;

  v_score := (v_opts->p_selected_option->>'score')::integer;
  v_feedback := coalesce(v_opts->p_selected_option->>'feedback', '');

  FOR i IN 0..(v_n - 1) LOOP
    IF (v_opts->i->>'score')::integer > v_best_score THEN
      v_best_score := (v_opts->i->>'score')::integer;
      v_best := i;
    END IF;
  END LOOP;

  INSERT INTO public.learner_attempts (learner_id, case_id, selected_option, score, feedback)
  VALUES (auth.uid(), p_case_id, p_selected_option, v_score, v_feedback);

  RETURN QUERY SELECT v_score, v_feedback, v_best, coalesce(v_opts->v_best->>'feedback', '');
END;
$$;

REVOKE ALL ON FUNCTION public.list_practice_cases() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_case_attempt(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_practice_cases() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_case_attempt(uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Free-text answer check (transparent keyword-coverage heuristic, not a grade)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reflection_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.expert_cases(id) ON DELETE CASCADE,
  answer text NOT NULL CHECK (char_length(answer) BETWEEN 20 AND 4000),
  coverage integer NOT NULL CHECK (coverage BETWEEN 0 AND 100),
  covered_terms text[] NOT NULL,
  missing_terms text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reflection_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reflection_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.reflection_attempts TO authenticated;

CREATE POLICY "Learners can read their own reflections"
ON public.reflection_attempts
FOR SELECT
TO authenticated
USING (learner_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS reflection_attempts_learner_idx
  ON public.reflection_attempts (learner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.evaluate_free_text(p_case_id uuid, p_answer text)
RETURNS TABLE (
  out_coverage integer,
  out_covered text[],
  out_missing text[],
  out_expected_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_text text;
  v_expected text[];
  v_covered text[];
  v_missing text[];
  v_answer tsvector;
  v_coverage integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_answer IS NULL OR char_length(trim(p_answer)) < 20 OR char_length(p_answer) > 4000 THEN
    RAISE EXCEPTION 'Write between 20 and 4000 characters so there is enough to evaluate';
  END IF;

  SELECT coalesce(c.final_solution, '') || ' ' || coalesce(c.reasoning_tradeoffs, '') || ' ' || coalesce(c.lessons_learned, '')
  INTO v_text
  FROM public.expert_cases c
  WHERE c.id = p_case_id AND c.workflow_status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved case not found';
  END IF;

  -- Expected concepts: the most frequent meaningful word stems in the reviewed expert reasoning.
  SELECT coalesce(array_agg(t.word ORDER BY t.nentry DESC, t.word), ARRAY[]::text[])
  INTO v_expected
  FROM (
    SELECT s.word, s.nentry
    FROM ts_stat(format('SELECT to_tsvector(''english'', %L)', v_text)) AS s
    WHERE char_length(s.word) > 3
    ORDER BY s.nentry DESC, s.word
    LIMIT 15
  ) t;

  IF cardinality(v_expected) < 3 THEN
    RAISE EXCEPTION 'This case has too little expert text to evaluate a written answer';
  END IF;

  v_answer := to_tsvector('english', p_answer);

  SELECT coalesce(array_agg(term ORDER BY term) FILTER (WHERE v_answer @@ to_tsquery('simple', quote_literal(term))), ARRAY[]::text[]),
         coalesce(array_agg(term ORDER BY term) FILTER (WHERE NOT (v_answer @@ to_tsquery('simple', quote_literal(term)))), ARRAY[]::text[])
  INTO v_covered, v_missing
  FROM unnest(v_expected) AS term;

  v_coverage := round(100.0 * cardinality(v_covered) / cardinality(v_expected));

  INSERT INTO public.reflection_attempts (learner_id, case_id, answer, coverage, covered_terms, missing_terms)
  VALUES (auth.uid(), p_case_id, trim(p_answer), v_coverage, v_covered, v_missing);

  RETURN QUERY SELECT v_coverage, v_covered, v_missing, cardinality(v_expected);
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_free_text(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_free_text(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Retrieval: full-text rank + domain/difficulty match + learner weak-area signal
--    Only reviewer-approved cases are ever searched.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_similar_cases(
  p_query text,
  p_domain text DEFAULT NULL,
  p_difficulty text DEFAULT NULL,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  case_id uuid,
  title text,
  domain text,
  difficulty text,
  is_seed boolean,
  relevance numeric,
  text_score numeric,
  domain_score numeric,
  difficulty_score numeric,
  weak_area_score numeric,
  mastered_penalty numeric,
  matched_terms text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_words text[];
  v_tsq tsquery;
  v_domain text := lower(trim(coalesce(p_domain, '')));
  v_difficulty text := lower(trim(coalesce(p_difficulty, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_query IS NULL OR char_length(trim(p_query)) < 3 OR char_length(p_query) > 4000 THEN
    RAISE EXCEPTION 'Describe your problem in 3 to 4000 characters';
  END IF;

  p_limit := least(greatest(coalesce(p_limit, 5), 1), 10);

  SELECT coalesce(array_agg(DISTINCT w), ARRAY[]::text[])
  INTO v_words
  FROM unnest(regexp_split_to_array(lower(regexp_replace(p_query, '[^a-zA-Z0-9]+', ' ', 'g')), '\s+')) AS w
  WHERE char_length(w) > 2;

  IF cardinality(v_words) > 60 THEN
    v_words := v_words[1:60];
  END IF;

  IF cardinality(v_words) > 0 THEN
    -- Words are letters/digits only, so this string cannot inject tsquery syntax.
    v_tsq := to_tsquery('english', array_to_string(v_words, ' | '));
  END IF;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (a.case_id) a.case_id, a.score
    FROM public.learner_attempts a
    WHERE a.learner_id = v_uid
    ORDER BY a.case_id, a.created_at DESC
  ),
  domain_avg AS (
    SELECT lower(c.domain) AS d, avg(l.score)::numeric AS avg_score
    FROM latest l
    JOIN public.expert_cases c ON c.id = l.case_id
    GROUP BY lower(c.domain)
  ),
  base AS (
    SELECT
      c.id, c.title, c.domain, c.difficulty, c.is_seed,
      setweight(to_tsvector('english', coalesce(c.title, '')), 'A')
      || setweight(to_tsvector('english', coalesce(c.domain, '')), 'B')
      || setweight(to_tsvector('english', coalesce(c.situation, '') || ' ' || coalesce(c.case_context, '') || ' ' || coalesce(c.question, '')), 'C')
      || setweight(to_tsvector('english', coalesce(c.reasoning_tradeoffs, '') || ' ' || coalesce(c.lessons_learned, '') || ' ' || coalesce(c.final_solution, '')), 'D') AS tsv
    FROM public.expert_cases c
    WHERE c.workflow_status = 'approved'
  ),
  scored AS (
    SELECT
      b.id, b.title, b.domain, b.difficulty, b.is_seed,
      (CASE WHEN v_tsq IS NULL THEN 0 ELSE ts_rank_cd(b.tsv, v_tsq, 32) END)::numeric AS text_s,
      (CASE
        WHEN v_domain = '' THEN 0
        WHEN lower(b.domain) = v_domain THEN 1
        WHEN position(v_domain IN lower(b.domain)) > 0 THEN 0.5
        ELSE 0
      END)::numeric AS domain_s,
      (CASE WHEN v_difficulty <> '' AND lower(b.difficulty) = v_difficulty THEN 1 ELSE 0 END)::numeric AS diff_s,
      coalesce((100 - da.avg_score) / 100, 0.5)::numeric AS weak_s,
      (CASE WHEN l.score IS NOT NULL AND l.score >= 90 THEN 0.15 ELSE 0 END)::numeric AS mastered_s,
      ARRAY(
        SELECT w FROM unnest(v_words) AS w
        WHERE b.tsv @@ to_tsquery('english', w)
        ORDER BY w
      ) AS matched
    FROM base b
    LEFT JOIN domain_avg da ON da.d = lower(b.domain)
    LEFT JOIN latest l ON l.case_id = b.id
  )
  SELECT
    s.id, s.title, s.domain, s.difficulty, s.is_seed,
    round(greatest(0, 0.60 * s.text_s + 0.15 * s.domain_s + 0.05 * s.diff_s + 0.20 * s.weak_s - s.mastered_s), 3),
    round(s.text_s, 3),
    s.domain_s,
    s.diff_s,
    round(s.weak_s, 3),
    s.mastered_s,
    s.matched
  FROM scored s
  WHERE s.text_s > 0 OR s.domain_s > 0
  ORDER BY 6 DESC, s.title
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.find_similar_cases(text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_similar_cases(text, text, text, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Honest, explainable progress metrics (computed only from saved attempts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.learner_progress()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN (
    WITH att AS (
      SELECT a.case_id, a.score, a.created_at, c.title, c.domain,
             row_number() OVER (PARTITION BY a.case_id ORDER BY a.created_at ASC) AS rn_first,
             row_number() OVER (PARTITION BY a.case_id ORDER BY a.created_at DESC) AS rn_last
      FROM public.learner_attempts a
      JOIN public.expert_cases c ON c.id = a.case_id
      WHERE a.learner_id = v_uid
    ),
    latest AS (SELECT * FROM att WHERE rn_last = 1),
    first_try AS (SELECT * FROM att WHERE rn_first = 1)
    SELECT jsonb_build_object(
      'attempts_total', (SELECT count(*) FROM att),
      'cases_attempted', (SELECT count(*) FROM latest),
      'cases_available', (SELECT count(*) FROM public.expert_cases c WHERE c.workflow_status = 'approved' AND jsonb_array_length(c.options) > 0),
      'cases_mastered', (SELECT count(*) FROM latest WHERE score >= 80),
      'avg_latest_score', (SELECT round(avg(score))::integer FROM latest),
      'avg_all_attempts', (SELECT round(avg(score))::integer FROM att),
      'domains', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'domain', d.domain, 'cases', d.cases, 'avg_latest_score', d.avg_score, 'attempts', d.attempts
        ) ORDER BY d.avg_score ASC), '[]'::jsonb)
        FROM (
          SELECT l.domain, count(*) AS cases, round(avg(l.score))::integer AS avg_score,
                 (SELECT count(*) FROM att x WHERE x.domain = l.domain) AS attempts
          FROM latest l GROUP BY l.domain
        ) d
      ),
      'repeated_mistakes', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'case_id', m.case_id, 'title', m.title, 'low_attempts', m.low_attempts
        ) ORDER BY m.low_attempts DESC), '[]'::jsonb)
        FROM (
          SELECT x.case_id, x.title, count(*) FILTER (WHERE x.score < 70) AS low_attempts
          FROM att x
          GROUP BY x.case_id, x.title
          HAVING count(*) FILTER (WHERE x.score < 70) >= 2
        ) m
      ),
      'improvement', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'case_id', f.case_id, 'title', f.title, 'first_score', f.score, 'latest_score', l.score
        ) ORDER BY f.title), '[]'::jsonb)
        FROM first_try f
        JOIN latest l ON l.case_id = f.case_id
        WHERE (SELECT count(*) FROM att z WHERE z.case_id = f.case_id) >= 2
      ),
      'reflections', (SELECT count(*) FROM public.reflection_attempts r WHERE r.learner_id = v_uid),
      'avg_reflection_coverage', (SELECT round(avg(r.coverage))::integer FROM public.reflection_attempts r WHERE r.learner_id = v_uid)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.learner_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.learner_progress() TO authenticated;

COMMIT;
