BEGIN;

-- Learner-submitted problems. Additive: no existing table or row is touched.
-- Browsers get NO direct table access; everything goes through the functions below.
CREATE TABLE public.learner_case_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 200),
  domain text NOT NULL CHECK (char_length(domain) BETWEEN 2 AND 100),
  difficulty text NOT NULL CHECK (difficulty IN ('Foundational', 'Intermediate', 'Advanced')),
  learning_objective text NOT NULL CHECK (char_length(learning_objective) BETWEEN 10 AND 1000),
  context text NOT NULL CHECK (char_length(context) BETWEEN 20 AND 4000),
  constraints_text text NOT NULL DEFAULT '' CHECK (char_length(constraints_text) <= 1500),
  known_facts text NOT NULL DEFAULT '' CHECK (char_length(known_facts) <= 1500),
  attempted_approaches text NOT NULL DEFAULT '' CHECK (char_length(attempted_approaches) <= 1500),
  content_hash text NOT NULL,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  expert_case_id uuid UNIQUE REFERENCES public.expert_cases(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, content_hash)
);

ALTER TABLE public.learner_case_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.learner_case_requests FROM PUBLIC, anon, authenticated;

CREATE INDEX learner_case_requests_learner_idx
  ON public.learner_case_requests (learner_id, created_at DESC);
CREATE INDEX learner_case_requests_open_idx
  ON public.learner_case_requests (created_at) WHERE expert_case_id IS NULL;

-- 1. Learner submits a case. learner_id always comes from the session, never the client.
CREATE OR REPLACE FUNCTION public.submit_learner_case(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title text;
  v_domain text;
  v_difficulty text;
  v_objective text;
  v_context text;
  v_constraints text;
  v_facts text;
  v_tried text;
  v_open integer;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR pg_column_size(p_payload) > 20000 THEN
    RAISE EXCEPTION 'Invalid or oversized case submission';
  END IF;

  v_title := trim(coalesce(p_payload->>'title', ''));
  v_domain := trim(coalesce(p_payload->>'domain', ''));
  v_difficulty := coalesce(nullif(trim(p_payload->>'difficulty'), ''), 'Intermediate');
  v_objective := trim(coalesce(p_payload->>'learning_objective', ''));
  v_context := trim(coalesce(p_payload->>'context', ''));
  v_constraints := trim(coalesce(p_payload->>'constraints', ''));
  v_facts := trim(coalesce(p_payload->>'known_facts', ''));
  v_tried := trim(coalesce(p_payload->>'attempted_approaches', ''));

  IF char_length(v_title) NOT BETWEEN 5 AND 200 THEN
    RAISE EXCEPTION 'Title must be between 5 and 200 characters';
  END IF;
  IF char_length(v_domain) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Domain must be between 2 and 100 characters';
  END IF;
  IF v_difficulty NOT IN ('Foundational', 'Intermediate', 'Advanced') THEN
    RAISE EXCEPTION 'Difficulty must be Foundational, Intermediate or Advanced';
  END IF;
  IF char_length(v_objective) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Learning objective must be between 10 and 1000 characters';
  END IF;
  IF char_length(v_context) NOT BETWEEN 20 AND 4000 THEN
    RAISE EXCEPTION 'Context must be between 20 and 4000 characters';
  END IF;
  IF char_length(v_constraints) > 1500 OR char_length(v_facts) > 1500 OR char_length(v_tried) > 1500 THEN
    RAISE EXCEPTION 'Constraints, known facts and attempted approaches are limited to 1500 characters each';
  END IF;

  SELECT count(*) INTO v_open
  FROM public.learner_case_requests
  WHERE learner_id = auth.uid() AND expert_case_id IS NULL;

  IF v_open >= 10 THEN
    RAISE EXCEPTION 'You already have 10 cases waiting for an expert. Please wait for some to be picked up.';
  END IF;

  INSERT INTO public.learner_case_requests (
    learner_id, title, domain, difficulty, learning_objective, context,
    constraints_text, known_facts, attempted_approaches, content_hash
  )
  VALUES (
    auth.uid(), v_title, v_domain, v_difficulty, v_objective, v_context,
    v_constraints, v_facts, v_tried, md5(lower(v_title || '|' || v_context))
  )
  ON CONFLICT (learner_id, content_hash) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'You have already submitted this case';
  END IF;

  RETURN v_id;
END;
$$;

-- 2. Learner reads only their own submissions, with a status derived from the linked
--    expert case. Drafts and reviewer feedback are never exposed here.
CREATE OR REPLACE FUNCTION public.my_case_requests()
RETURNS TABLE (
  id uuid,
  title text,
  domain text,
  difficulty text,
  learning_objective text,
  created_at timestamptz,
  status text,
  published_case_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    r.id, r.title, r.domain, r.difficulty, r.learning_objective, r.created_at,
    CASE
      WHEN r.expert_case_id IS NULL THEN 'submitted'
      WHEN c.workflow_status = 'approved' THEN 'published'
      WHEN c.workflow_status = 'submitted' THEN 'in_review'
      ELSE 'in_progress'
    END,
    CASE WHEN c.workflow_status = 'approved' THEN c.id END
  FROM public.learner_case_requests r
  LEFT JOIN public.expert_cases c ON c.id = r.expert_case_id
  WHERE r.learner_id = auth.uid()
  ORDER BY r.created_at DESC;
$$;

-- 3. Experts see unclaimed requests (never their own, and without learner identity).
CREATE OR REPLACE FUNCTION public.list_open_case_requests()
RETURNS TABLE (
  id uuid,
  title text,
  domain text,
  difficulty text,
  learning_objective text,
  context text,
  constraints_text text,
  known_facts text,
  attempted_approaches text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_case_role('expert') THEN
    RAISE EXCEPTION 'Authenticated expert role required';
  END IF;

  RETURN QUERY
  SELECT r.id, r.title, r.domain, r.difficulty, r.learning_objective, r.context,
         r.constraints_text, r.known_facts, r.attempted_approaches, r.created_at
  FROM public.learner_case_requests r
  WHERE r.expert_case_id IS NULL
    AND r.learner_id <> auth.uid()
  ORDER BY r.created_at ASC
  LIMIT 50;
END;
$$;

-- 4. An expert claims a request. This creates a private draft owned by the expert,
--    prefilled from the learner's submission, and links it back to the request.
CREATE OR REPLACE FUNCTION public.claim_case_request(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req public.learner_case_requests%ROWTYPE;
  v_case_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_case_role('expert') THEN
    RAISE EXCEPTION 'Authenticated expert role required';
  END IF;

  SELECT * INTO v_req
  FROM public.learner_case_requests
  WHERE id = p_request_id
    AND expert_case_id IS NULL
    AND learner_id <> auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found, already claimed, or submitted by you';
  END IF;

  INSERT INTO public.expert_cases (
    title, domain, difficulty, situation, question, options,
    is_approved, owner_id, workflow_status,
    case_context, initial_conditions, attempted_approaches
  )
  VALUES (
    v_req.title, v_req.domain, v_req.difficulty, v_req.context,
    'Given this situation, what would you do first, and why? Learning objective: ' || v_req.learning_objective,
    '[]'::jsonb,
    false, auth.uid(), 'draft',
    v_req.context,
    concat_ws(
      E'\n\n',
      CASE WHEN v_req.known_facts <> '' THEN 'Known facts (from the learner):' || E'\n' || v_req.known_facts END,
      CASE WHEN v_req.constraints_text <> '' THEN 'Constraints (from the learner):' || E'\n' || v_req.constraints_text END
    ),
    CASE WHEN v_req.attempted_approaches <> ''
      THEN 'Learner reported trying:' || E'\n' || v_req.attempted_approaches
      ELSE '' END
  )
  RETURNING id INTO v_case_id;

  UPDATE public.learner_case_requests
  SET claimed_by = auth.uid(), claimed_at = now(), expert_case_id = v_case_id
  WHERE id = p_request_id;

  RETURN v_case_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_learner_case(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_case_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_open_case_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_case_request(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_learner_case(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_case_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_case_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_case_request(uuid) TO authenticated;

COMMIT;
