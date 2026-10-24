BEGIN;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE public.expert_cases
  ADD COLUMN IF NOT EXISTS engine_embedding extensions.vector(1536);

CREATE INDEX expert_cases_engine_embedding_hnsw
  ON public.expert_cases USING hnsw (engine_embedding extensions.vector_cosine_ops)
  WHERE engine_embedding IS NOT NULL;

CREATE TABLE public.engine_trusted_domains (
  domain text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engine_trusted_domains_domain_check
    CHECK (domain = lower(domain) AND domain ~ '^[a-z0-9.-]+$')
);

CREATE TABLE public.engine_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('manager_decision', 'trusted_web', 'validated_feedback')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
  content text NOT NULL CHECK (length(trim(content)) BETWEEN 30 AND 12000),
  source_url text,
  embedding extensions.vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engine_knowledge_source_check CHECK (
    (kind = 'trusted_web' AND source_url IS NOT NULL)
    OR (kind <> 'trusted_web')
  )
);

CREATE INDEX engine_knowledge_company_created_idx
  ON public.engine_knowledge(company_id, created_at DESC);

CREATE INDEX engine_knowledge_embedding_hnsw
  ON public.engine_knowledge USING hnsw (embedding extensions.vector_cosine_ops);

CREATE TABLE public.engine_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  prompt text NOT NULL CHECK (length(prompt) BETWEEN 10 AND 4000),
  scenario jsonb NOT NULL CHECK (jsonb_typeof(scenario) = 'object'),
  source_case_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  citations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(citations) = 'array'),
  difficulty text NOT NULL CHECK (difficulty IN ('Foundational', 'Intermediate', 'Advanced')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX engine_scenarios_learner_created_idx
  ON public.engine_scenarios(learner_id, created_at DESC);

CREATE TABLE public.engine_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.engine_scenarios(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  answer text NOT NULL CHECK (length(trim(answer)) BETWEEN 20 AND 4000),
  evaluation jsonb NOT NULL CHECK (jsonb_typeof(evaluation) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX engine_evaluations_learner_created_idx
  ON public.engine_evaluations(learner_id, created_at DESC);

CREATE TABLE public.engine_evaluation_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL UNIQUE REFERENCES public.engine_evaluations(id) ON DELETE CASCADE,
  scenario_id uuid NOT NULL REFERENCES public.engine_scenarios(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_case_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  learner_answer text NOT NULL,
  model_evaluation jsonb NOT NULL CHECK (jsonb_typeof(model_evaluation) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX engine_evaluation_examples_company_status_idx
  ON public.engine_evaluation_examples(company_id, status, created_at DESC);

CREATE TABLE public.engine_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.engine_scenarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('scenario', 'evaluation')),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '' CHECK (length(comment) <= 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX engine_feedback_company_status_idx
  ON public.engine_feedback(company_id, status, created_at DESC);

ALTER TABLE public.engine_trusted_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_evaluation_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.engine_trusted_domains, public.engine_knowledge,
  public.engine_scenarios, public.engine_evaluations, public.engine_feedback
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.engine_evaluation_examples FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.engine_is_trusted_source(p_url text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_host text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.company_memberships m
    WHERE m.user_id = auth.uid() AND m.role = 'manager'
  ) THEN
    RETURN false;
  END IF;
  IF p_url IS NULL OR p_url !~ '^https://[^/@?#]+([/?#].*)?$' THEN
    RETURN false;
  END IF;
  v_host := lower(regexp_replace(p_url, '^https://([^/:?#]+).*$','\1'));
  IF v_host !~ '\.'
     OR v_host ~ '^[0-9.]+$'
     OR v_host LIKE '[%'
     OR v_host ~ '(^|\.)(localhost|local|internal|test|invalid)$'
  THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.engine_trusted_domains d
    WHERE d.enabled
      AND (v_host = d.domain OR right(v_host, length(d.domain) + 1) = '.' || d.domain)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.engine_is_trusted_source(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.engine_is_trusted_source(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.engine_manager_company()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT m.company_id
  FROM public.company_memberships m
  WHERE m.user_id = (SELECT auth.uid()) AND m.role = 'manager'
  ORDER BY m.created_at
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.engine_manager_company() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.engine_manager_company() TO authenticated;

CREATE OR REPLACE FUNCTION public.engine_current_company()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT m.company_id
  FROM public.company_memberships m
  WHERE m.user_id = (SELECT auth.uid())
  ORDER BY m.created_at, m.company_id
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.engine_current_company() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.engine_current_company() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_engine_knowledge(
  p_kind text,
  p_title text,
  p_content text,
  p_source_url text,
  p_embedding extensions.vector(1536)
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.engine_manager_company();
  v_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company manager permission required';
  END IF;
  IF p_kind NOT IN ('manager_decision', 'trusted_web') THEN
    RAISE EXCEPTION 'Unsupported knowledge source type';
  END IF;
  IF length(trim(coalesce(p_title, ''))) NOT BETWEEN 3 AND 200
     OR length(trim(coalesce(p_content, ''))) NOT BETWEEN 30 AND 12000
  THEN
    RAISE EXCEPTION 'Title must be 3–200 characters and knowledge text 30–12000 characters';
  END IF;
  IF p_kind = 'trusted_web' AND NOT public.engine_is_trusted_source(p_source_url) THEN
    RAISE EXCEPTION 'The source URL is not on the administrator-approved trusted-domain list';
  END IF;

  INSERT INTO public.engine_knowledge (
    company_id, created_by, kind, title, content, source_url, embedding
  )
  VALUES (
    v_company_id, v_user_id, p_kind, trim(p_title), trim(p_content),
    CASE WHEN p_kind = 'trusted_web' THEN p_source_url ELSE NULL END, p_embedding
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_engine_knowledge(text, text, text, text, extensions.vector) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_engine_knowledge(text, text, text, text, extensions.vector) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_unindexed_engine_cases(p_limit integer DEFAULT 50)
RETURNS TABLE (
  case_id uuid,
  title text,
  domain text,
  difficulty text,
  case_context text,
  situation text,
  question text,
  attempted_approaches text,
  final_solution text,
  reasoning_tradeoffs text,
  lessons_learned text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR (
    NOT public.has_case_role('reviewer')
    AND public.engine_manager_company() IS NULL
  ) THEN
    RAISE EXCEPTION 'Reviewer or company manager permission required';
  END IF;

  RETURN QUERY
  SELECT c.id, c.title, c.domain, c.difficulty, c.case_context, c.situation,
    c.question, c.attempted_approaches, c.final_solution, c.reasoning_tradeoffs,
    c.lessons_learned
  FROM public.expert_cases c
  WHERE c.workflow_status = 'approved' AND c.engine_embedding IS NULL
  ORDER BY c.reviewed_at NULLS LAST, c.created_at
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 100);
END;
$$;
REVOKE ALL ON FUNCTION public.list_unindexed_engine_cases(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_unindexed_engine_cases(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_engine_case_embedding(
  p_case_id uuid,
  p_embedding extensions.vector(1536)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR (
    NOT public.has_case_role('reviewer')
    AND public.engine_manager_company() IS NULL
  ) THEN
    RAISE EXCEPTION 'Reviewer or company manager permission required';
  END IF;
  UPDATE public.expert_cases
  SET engine_embedding = p_embedding
  WHERE id = p_case_id AND workflow_status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved case not found';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_engine_case_embedding(uuid, extensions.vector) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_engine_case_embedding(uuid, extensions.vector) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_engine_knowledge(
  p_query text,
  p_embedding extensions.vector(1536) DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_difficulty text DEFAULT NULL,
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  source_type text,
  source_id uuid,
  case_id uuid,
  title text,
  domain text,
  difficulty text,
  content text,
  source_url text,
  relevance numeric,
  semantic_score numeric,
  text_score numeric,
  is_seed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_query tsquery;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_query IS NULL OR length(trim(p_query)) < 3 OR length(p_query) > 4000 THEN
    RAISE EXCEPTION 'Search text must be between 3 and 4000 characters';
  END IF;
  v_query := websearch_to_tsquery('english', p_query);

  RETURN QUERY
  WITH candidates AS (
    SELECT
      'approved_case'::text AS kind, c.id AS ref_id, c.id AS ref_case_id,
      c.title, c.domain, c.difficulty,
      left(concat_ws(E'\n', c.case_context, c.initial_conditions, c.situation,
        c.question, c.attempted_approaches, c.final_solution,
        c.reasoning_tradeoffs, c.lessons_learned), 6000) AS body,
      NULL::text AS url,
      c.is_seed AS seed,
      CASE WHEN p_embedding IS NOT NULL AND c.engine_embedding IS NOT NULL
        THEN greatest(0, 1 - (c.engine_embedding <=> p_embedding)) ELSE 0 END::numeric AS sem,
      ts_rank_cd(
        setweight(to_tsvector('english', c.title), 'A')
        || setweight(to_tsvector('english', c.domain), 'B')
        || setweight(to_tsvector('english', concat_ws(' ', c.situation, c.case_context, c.question)), 'C')
        || setweight(to_tsvector('english', concat_ws(' ', c.final_solution, c.reasoning_tradeoffs, c.lessons_learned)), 'D'),
        v_query, 32
      )::numeric AS lexical
    FROM public.expert_cases c
    WHERE c.workflow_status = 'approved'
      AND (coalesce(trim(p_domain), '') = '' OR lower(c.domain) = lower(trim(p_domain)))
      AND (coalesce(trim(p_difficulty), '') = '' OR lower(c.difficulty) = lower(trim(p_difficulty)))

    UNION ALL

    SELECT
      k.kind, k.id, NULL::uuid, k.title, 'Company knowledge'::text,
      coalesce(nullif(trim(p_difficulty), ''), 'Intermediate'),
      left(k.content, 6000), k.source_url,
      false AS seed,
      greatest(0, 1 - (k.embedding <=> p_embedding))::numeric,
      ts_rank_cd(to_tsvector('english', concat_ws(' ', k.title, k.content)), v_query, 32)::numeric
    FROM public.engine_knowledge k
    JOIN public.company_memberships m ON m.company_id = k.company_id
    WHERE m.user_id = v_uid
      AND m.company_id = (
        SELECT primary_membership.company_id
        FROM public.company_memberships primary_membership
        WHERE primary_membership.user_id = v_uid
        ORDER BY primary_membership.created_at, primary_membership.company_id
        LIMIT 1
      )
  )
  SELECT
    c.kind, c.ref_id, c.ref_case_id, c.title, c.domain, c.difficulty, c.body, c.url,
    round((CASE WHEN c.sem > 0 THEN 0.7 * c.sem + 0.3 * least(1, c.lexical * 10)
      ELSE least(1, c.lexical * 10) END)::numeric, 4),
    round(c.sem, 4),
    round(c.lexical, 4),
    c.seed
  FROM candidates c
  WHERE c.lexical > 0 OR c.sem >= 0.25
  ORDER BY 9 DESC, c.title
  LIMIT least(greatest(coalesce(p_limit, 8), 1), 12);
END;
$$;
REVOKE ALL ON FUNCTION public.search_engine_knowledge(text, extensions.vector, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_engine_knowledge(text, extensions.vector, text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_engine_scenario(
  p_prompt text,
  p_scenario jsonb,
  p_case_ids uuid[],
  p_citations jsonb,
  p_difficulty text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF length(trim(coalesce(p_prompt, ''))) NOT BETWEEN 10 AND 4000
     OR jsonb_typeof(p_scenario) <> 'object'
     OR jsonb_typeof(p_citations) <> 'array'
     OR p_difficulty NOT IN ('Foundational', 'Intermediate', 'Advanced')
  THEN
    RAISE EXCEPTION 'Invalid scenario data';
  END IF;
  SELECT m.company_id INTO v_company_id
  FROM public.company_memberships m
  WHERE m.user_id = auth.uid()
  ORDER BY m.created_at, m.company_id
  LIMIT 1;
  INSERT INTO public.engine_scenarios (
    learner_id, company_id, prompt, scenario, source_case_ids, citations, difficulty
  )
  VALUES (
    auth.uid(), v_company_id, trim(p_prompt), p_scenario,
    coalesce(p_case_ids, ARRAY[]::uuid[]), p_citations, p_difficulty
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_engine_scenario(text, jsonb, uuid[], jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_engine_scenario(text, jsonb, uuid[], jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_engine_scenario(p_scenario_id uuid)
RETURNS TABLE (
  id uuid,
  prompt text,
  scenario jsonb,
  source_case_ids uuid[],
  citations jsonb,
  difficulty text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.prompt, s.scenario, s.source_case_ids, s.citations, s.difficulty
  FROM public.engine_scenarios s
  WHERE s.id = p_scenario_id AND s.learner_id = (SELECT auth.uid());
$$;
REVOKE ALL ON FUNCTION public.get_my_engine_scenario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_engine_scenario(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_engine_evaluation(
  p_scenario_id uuid,
  p_answer text,
  p_evaluation jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_case_ids uuid[];
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF length(trim(coalesce(p_answer, ''))) NOT BETWEEN 20 AND 4000
     OR jsonb_typeof(p_evaluation) <> 'object'
     OR coalesce(p_evaluation->>'overall_score', '') !~ '^(100|[0-9]{1,2})$'
     OR coalesce(p_evaluation->>'decision_quality', '') !~ '^(100|[0-9]{1,2})$'
     OR coalesce(p_evaluation->>'evidence_use', '') !~ '^(100|[0-9]{1,2})$'
     OR coalesce(p_evaluation->>'risk_awareness', '') !~ '^(100|[0-9]{1,2})$'
     OR coalesce(p_evaluation->>'feasibility', '') !~ '^(100|[0-9]{1,2})$'
     OR length(coalesce(p_evaluation->>'feedback', '')) NOT BETWEEN 20 AND 2000
     OR coalesce(jsonb_typeof(p_evaluation->'strengths'), '') <> 'array'
     OR coalesce(jsonb_typeof(p_evaluation->'gaps'), '') <> 'array'
     OR jsonb_array_length(coalesce(p_evaluation->'strengths', '[]'::jsonb)) NOT BETWEEN 1 AND 5
     OR jsonb_array_length(coalesce(p_evaluation->'gaps', '[]'::jsonb)) NOT BETWEEN 1 AND 5
     OR length(coalesce(p_evaluation->>'next_step', '')) NOT BETWEEN 10 AND 500
     OR NOT EXISTS (
       SELECT 1 FROM public.engine_scenarios s
       WHERE s.id = p_scenario_id AND s.learner_id = auth.uid()
     )
  THEN
    RAISE EXCEPTION 'Invalid answer or scenario';
  END IF;
  SELECT company_id INTO v_company_id
  FROM public.engine_scenarios
  WHERE id = p_scenario_id AND learner_id = auth.uid();
  SELECT source_case_ids INTO v_case_ids
  FROM public.engine_scenarios
  WHERE id = p_scenario_id AND learner_id = auth.uid();
  INSERT INTO public.engine_evaluations (
    scenario_id, learner_id, company_id, answer, evaluation
  )
  VALUES (p_scenario_id, auth.uid(), v_company_id, trim(p_answer), p_evaluation)
  RETURNING id INTO v_id;
  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.engine_evaluation_examples (
      evaluation_id, scenario_id, company_id, source_case_ids, learner_answer, model_evaluation
    )
    VALUES (v_id, p_scenario_id, v_company_id, coalesce(v_case_ids, ARRAY[]::uuid[]), trim(p_answer), p_evaluation);
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_engine_evaluation(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_engine_evaluation(uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_engine_evaluation_examples_for_review()
RETURNS TABLE (
  id uuid,
  scenario_id uuid,
  scenario jsonb,
  citations jsonb,
  source_case_ids uuid[],
  learner_answer text,
  model_evaluation jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.engine_manager_company();
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company manager permission required';
  END IF;
  RETURN QUERY
  SELECT e.id, e.scenario_id, s.scenario, s.citations, e.source_case_ids,
    e.learner_answer, e.model_evaluation, e.created_at
  FROM public.engine_evaluation_examples e
  JOIN public.engine_scenarios s ON s.id = e.scenario_id
  WHERE e.company_id = v_company_id AND e.status = 'pending'
  ORDER BY e.created_at DESC
  LIMIT 25;
END;
$$;
REVOKE ALL ON FUNCTION public.list_engine_evaluation_examples_for_review() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_engine_evaluation_examples_for_review() TO authenticated;

CREATE OR REPLACE FUNCTION public.review_engine_evaluation_example(
  p_example_id uuid,
  p_decision text,
  p_reviewer_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.engine_manager_company();
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company manager permission required';
  END IF;
  IF p_decision NOT IN ('validated', 'rejected')
     OR length(coalesce(p_reviewer_notes, '')) > 2000
  THEN
    RAISE EXCEPTION 'Evaluation decision or reviewer notes are invalid';
  END IF;
  UPDATE public.engine_evaluation_examples
  SET status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      reviewer_notes = nullif(trim(p_reviewer_notes), '')
  WHERE id = p_example_id AND company_id = v_company_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending company evaluation example not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.review_engine_evaluation_example(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_engine_evaluation_example(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.engine_learning_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'validated_evaluations', count(*),
    'avg_score', round(avg((e.evaluation->>'overall_score')::numeric))
  )
  FROM (
    SELECT evaluation
    FROM public.engine_evaluations e
    JOIN public.engine_evaluation_examples x ON x.evaluation_id = e.id
    WHERE e.learner_id = (SELECT auth.uid()) AND x.status = 'validated'
    ORDER BY e.created_at DESC
    LIMIT 10
  ) e;
$$;
REVOKE ALL ON FUNCTION public.engine_learning_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.engine_learning_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_engine_feedback(
  p_scenario_id uuid,
  p_category text,
  p_rating integer,
  p_comment text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_category NOT IN ('scenario', 'evaluation')
     OR p_rating NOT BETWEEN 1 AND 5
     OR length(coalesce(p_comment, '')) > 2000
  THEN
    RAISE EXCEPTION 'Feedback category, rating, or comment is invalid';
  END IF;
  SELECT s.company_id INTO v_company_id
  FROM public.engine_scenarios s
  WHERE s.id = p_scenario_id AND s.learner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Scenario not found'; END IF;
  INSERT INTO public.engine_feedback (
    scenario_id, user_id, company_id, category, rating, comment
  )
  VALUES (p_scenario_id, auth.uid(), v_company_id, p_category, p_rating, trim(coalesce(p_comment, '')))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_engine_feedback(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_engine_feedback(uuid, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_engine_feedback_for_review()
RETURNS TABLE (
  id uuid,
  scenario_id uuid,
  category text,
  rating smallint,
  comment text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.engine_manager_company();
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company manager permission required';
  END IF;
  RETURN QUERY
  SELECT f.id, f.scenario_id, f.category, f.rating, f.comment, f.created_at
  FROM public.engine_feedback f
  WHERE f.company_id = v_company_id AND f.status = 'pending'
  ORDER BY f.created_at DESC
  LIMIT 50;
END;
$$;
REVOKE ALL ON FUNCTION public.list_engine_feedback_for_review() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_engine_feedback_for_review() TO authenticated;

CREATE OR REPLACE FUNCTION public.review_engine_feedback(
  p_feedback_id uuid,
  p_decision text,
  p_embedding extensions.vector(1536)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_feedback public.engine_feedback%ROWTYPE;
  v_company_id uuid := public.engine_manager_company();
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company manager permission required';
  END IF;
  IF p_decision NOT IN ('validated', 'rejected') THEN
    RAISE EXCEPTION 'Feedback decision must be validated or rejected';
  END IF;
  SELECT * INTO v_feedback FROM public.engine_feedback
  WHERE id = p_feedback_id AND company_id = v_company_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending feedback not found'; END IF;

  UPDATE public.engine_feedback
  SET status = p_decision, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_feedback_id;

  IF p_decision = 'validated' AND length(trim(v_feedback.comment)) >= 30 THEN
    INSERT INTO public.engine_knowledge (
      company_id, created_by, kind, title, content, embedding
    )
    VALUES (
      v_company_id, v_feedback.user_id, 'validated_feedback',
      'Validated learner feedback', v_feedback.comment, p_embedding
    );
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.review_engine_feedback(uuid, text, extensions.vector) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_engine_feedback(uuid, text, extensions.vector) TO authenticated;

CREATE OR REPLACE FUNCTION public.export_engine_evaluation_dataset()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid := public.engine_manager_company();
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company manager permission required';
  END IF;

  RETURN jsonb_build_object(
    'evaluations', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'input', jsonb_build_object(
          'scenario', s.scenario,
          'learner_answer', x.learner_answer,
          'citations', s.citations
        ),
        'expected_output', x.model_evaluation,
        'source_case_ids', x.source_case_ids,
        'reviewer_notes', x.reviewer_notes,
        'validated_at', x.reviewed_at
      ) ORDER BY x.reviewed_at)
      FROM public.engine_evaluation_examples x
      JOIN public.engine_scenarios s ON s.id = x.scenario_id
      WHERE x.company_id = v_company_id AND x.status = 'validated'
    ), '[]'::jsonb),
    'feedback', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'category', f.category,
        'rating', f.rating,
        'comment', f.comment,
        'scenario_id', f.scenario_id,
        'validated_at', f.reviewed_at
      ) ORDER BY f.reviewed_at)
      FROM public.engine_feedback f
      WHERE f.company_id = v_company_id AND f.status = 'validated'
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.export_engine_evaluation_dataset() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_engine_evaluation_dataset() TO authenticated;

CREATE OR REPLACE FUNCTION public.export_engine_training_dataset(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
BEGIN
  IF v_is_service_role THEN
    v_company_id := p_company_id;
    IF v_company_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.companies c WHERE c.id = v_company_id
    ) THEN
      RAISE EXCEPTION 'A valid company ID is required for scheduled training';
    END IF;
  ELSE
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    v_company_id := public.engine_manager_company();
    IF v_company_id IS NULL THEN RAISE EXCEPTION 'Company manager permission required'; END IF;
    IF p_company_id IS NOT NULL AND p_company_id <> v_company_id THEN
      RAISE EXCEPTION 'You cannot export training data for another company';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'company_id', v_company_id,
    'evaluations', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'example_id', x.id,
        'scenario_id', x.scenario_id,
        'status', x.status,
        'scenario', s.scenario,
        'learner_answer', x.learner_answer,
        'model_evaluation', x.model_evaluation,
        'reviewer_notes', x.reviewer_notes,
        'source_cases', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'title', c.title,
            'domain', c.domain,
            'difficulty', c.difficulty,
            'situation', c.situation,
            'question', c.question,
            'final_solution', c.final_solution,
            'reasoning_tradeoffs', c.reasoning_tradeoffs,
            'lessons_learned', c.lessons_learned,
            'review_scores', c.review_scores,
            'is_seed', c.is_seed
          ))
          FROM unnest(x.source_case_ids) case_ref(case_id)
          JOIN public.expert_cases c ON c.id = case_ref.case_id
          WHERE c.workflow_status = 'approved'
        ), '[]'::jsonb)
      ) ORDER BY x.created_at)
      FROM public.engine_evaluation_examples x
      JOIN public.engine_scenarios s ON s.id = x.scenario_id
      WHERE x.company_id = v_company_id AND x.status IN ('validated', 'rejected')
    ), '[]'::jsonb),
    'outcomes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'attempt_id', attempt.id,
        'case_id', c.id,
        'title', c.title,
        'domain', c.domain,
        'difficulty', c.difficulty,
        'situation', c.situation,
        'question', c.question,
        'final_solution', c.final_solution,
        'reasoning_tradeoffs', c.reasoning_tradeoffs,
        'lessons_learned', c.lessons_learned,
        'selected_option_text', c.options->attempt.selected_option->>'text',
        'option_feedback', c.options->attempt.selected_option->>'feedback',
        'score', attempt.score
      ) ORDER BY attempt.created_at)
      FROM (
        SELECT a.id, a.learner_id, a.case_id, a.selected_option, a.score, a.created_at
        FROM public.learner_attempts a
        JOIN public.company_memberships membership
          ON membership.user_id = a.learner_id AND membership.company_id = v_company_id
        ORDER BY a.created_at DESC
        LIMIT 10000
      ) attempt
      JOIN public.expert_cases c
        ON c.id = attempt.case_id AND c.workflow_status = 'approved' AND c.is_seed = false
    ), '[]'::jsonb),
    'knowledge', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', k.id,
        'kind', k.kind,
        'title', k.title,
        'content', left(k.content, 3000),
        'created_at', k.created_at
      ) ORDER BY k.created_at)
      FROM public.engine_knowledge k
      WHERE k.company_id = v_company_id AND k.kind IN ('manager_decision', 'trusted_web', 'validated_feedback')
    ), '[]'::jsonb),
    'validated_feedback_count', (
      SELECT count(*) FROM public.engine_feedback f
      WHERE f.company_id = v_company_id AND f.status = 'validated'
    ),
    'source_count', (
      SELECT count(*) FROM public.engine_knowledge k WHERE k.company_id = v_company_id
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.export_engine_training_dataset(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_engine_training_dataset(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_engine_training_companies()
RETURNS TABLE (company_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT DISTINCT candidates.company_id
  FROM (
    SELECT x.company_id
    FROM public.engine_evaluation_examples x
    WHERE coalesce(auth.role(), '') = 'service_role'
      AND x.status IN ('validated', 'rejected')
    UNION ALL
    SELECT membership.company_id
    FROM public.company_memberships membership
    JOIN public.learner_attempts attempt ON attempt.learner_id = membership.user_id
    WHERE coalesce(auth.role(), '') = 'service_role'
  ) candidates
  ORDER BY candidates.company_id;
$$;
REVOKE ALL ON FUNCTION public.list_engine_training_companies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_engine_training_companies() TO service_role;

COMMIT;
