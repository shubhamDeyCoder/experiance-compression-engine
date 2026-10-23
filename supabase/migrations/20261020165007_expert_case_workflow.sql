-- Milestone 2: Expert case workflow
-- This migration preserves existing case IDs and learner-facing columns.

BEGIN;

-- 1. Trusted role registry. Roles must be provisioned by an administrator.
CREATE TABLE public.case_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('expert', 'reviewer')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.case_roles FROM PUBLIC, anon, authenticated;

-- 2. Extend existing cases without deleting or recreating them.
ALTER TABLE public.expert_cases
  ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN workflow_status text NOT NULL DEFAULT 'draft'
    CHECK (workflow_status IN ('draft', 'submitted', 'approved', 'rejected')),
  ADD COLUMN case_context text NOT NULL DEFAULT '',
  ADD COLUMN initial_conditions text NOT NULL DEFAULT '',
  ADD COLUMN attempted_approaches text NOT NULL DEFAULT '',
  ADD COLUMN final_solution text NOT NULL DEFAULT '',
  ADD COLUMN reasoning_tradeoffs text NOT NULL DEFAULT '',
  ADD COLUMN lessons_learned text NOT NULL DEFAULT '',
  ADD COLUMN experience_level text,
  ADD COLUMN review_feedback text,
  ADD COLUMN submitted_at timestamptz,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN revision_number integer NOT NULL DEFAULT 1
    CHECK (revision_number > 0);

-- Keep the current learner access flag and workflow status aligned.
UPDATE public.expert_cases
SET workflow_status = CASE
  WHEN is_approved THEN 'approved'
  ELSE 'draft'
END;

-- 3. Immutable snapshots of submitted and reviewed versions.
CREATE TABLE public.expert_case_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.expert_cases(id) ON DELETE CASCADE,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  event text NOT NULL CHECK (
    event IN ('submitted', 'approved', 'rejected')
  ),
  snapshot jsonb NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, revision_number, event)
);

ALTER TABLE public.expert_case_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expert_case_revisions
  FROM PUBLIC, anon, authenticated;

CREATE INDEX expert_cases_owner_status_idx
  ON public.expert_cases (owner_id, workflow_status);

CREATE INDEX expert_cases_status_idx
  ON public.expert_cases (workflow_status);

CREATE INDEX expert_case_revisions_case_idx
  ON public.expert_case_revisions (case_id, created_at DESC);

-- 4. Experts can read their own cases, including pending/rejected cases.
-- Reviewers can read cases awaiting review.
CREATE POLICY "Owners and reviewers can read workflow cases"
ON public.expert_cases
FOR SELECT
TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.case_roles r
    WHERE r.user_id = (SELECT auth.uid())
      AND r.role = 'reviewer'
  )
);

-- Retain learner SELECT access to approved cases only through existing RLS.
-- Prevent browser clients from directly modifying case rows.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.expert_cases
FROM anon, authenticated;

GRANT SELECT ON TABLE public.expert_cases TO authenticated;

-- 5. Create a draft.
CREATE OR REPLACE FUNCTION public.create_case_draft(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_case public.expert_cases%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.case_roles
    WHERE user_id = auth.uid() AND role = 'expert'
  ) THEN
    RAISE EXCEPTION 'Expert role required';
  END IF;

  IF p_payload IS NULL OR pg_column_size(p_payload) > 50000 THEN
    RAISE EXCEPTION 'Invalid or oversized case payload';
  END IF;

  IF length(trim(coalesce(p_payload->>'title', ''))) NOT BETWEEN 1 AND 200
     OR length(trim(coalesce(p_payload->>'domain', ''))) NOT BETWEEN 1 AND 100
     OR length(trim(coalesce(p_payload->>'situation', ''))) NOT BETWEEN 1 AND 10000
     OR length(trim(coalesce(p_payload->>'question', ''))) NOT BETWEEN 1 AND 5000
  THEN
    RAISE EXCEPTION 'Title, domain, situation and question are required and must be within length limits';
  END IF;

  IF coalesce(p_payload->'options', '[]'::jsonb) <> '[]'::jsonb
     AND jsonb_typeof(p_payload->'options') <> 'array'
  THEN
    RAISE EXCEPTION 'Options must be a JSON array';
  END IF;

  INSERT INTO public.expert_cases (
    title, domain, difficulty, situation, question, options,
    is_approved, owner_id, workflow_status, case_context,
    initial_conditions, attempted_approaches, final_solution,
    reasoning_tradeoffs, lessons_learned, experience_level
  )
  VALUES (
    trim(p_payload->>'title'),
    trim(p_payload->>'domain'),
    coalesce(nullif(trim(p_payload->>'difficulty'), ''), 'Intermediate'),
    trim(p_payload->>'situation'),
    trim(p_payload->>'question'),
    coalesce(p_payload->'options', '[]'::jsonb),
    false, auth.uid(), 'draft',
    coalesce(p_payload->>'case_context', ''),
    coalesce(p_payload->>'initial_conditions', ''),
    coalesce(p_payload->>'attempted_approaches', ''),
    coalesce(p_payload->>'final_solution', ''),
    coalesce(p_payload->>'reasoning_tradeoffs', ''),
    coalesce(p_payload->>'lessons_learned', ''),
    nullif(trim(p_payload->>'experience_level'), '')
  )
  RETURNING * INTO v_case;

  v_id := v_case.id;
  RETURN v_id;
END;
$$;

-- 6. Edit only your own draft or rejected case.
CREATE OR REPLACE FUNCTION public.update_case_draft(
  p_case_id uuid,
  p_payload jsonb
)
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

  IF p_payload IS NULL OR pg_column_size(p_payload) > 50000 THEN
    RAISE EXCEPTION 'Invalid or oversized case payload';
  END IF;

  IF length(trim(coalesce(p_payload->>'title', ''))) NOT BETWEEN 1 AND 200
     OR length(trim(coalesce(p_payload->>'domain', ''))) NOT BETWEEN 1 AND 100
     OR length(trim(coalesce(p_payload->>'situation', ''))) NOT BETWEEN 1 AND 10000
     OR length(trim(coalesce(p_payload->>'question', ''))) NOT BETWEEN 1 AND 5000
  THEN
    RAISE EXCEPTION 'Required fields are missing or exceed length limits';
  END IF;

  IF coalesce(p_payload->'options', '[]'::jsonb) <> '[]'::jsonb
     AND jsonb_typeof(p_payload->'options') <> 'array'
  THEN
    RAISE EXCEPTION 'Options must be a JSON array';
  END IF;

  UPDATE public.expert_cases
  SET title = trim(p_payload->>'title'),
      domain = trim(p_payload->>'domain'),
      difficulty = coalesce(nullif(trim(p_payload->>'difficulty'), ''), 'Intermediate'),
      situation = trim(p_payload->>'situation'),
      question = trim(p_payload->>'question'),
      options = coalesce(p_payload->'options', '[]'::jsonb),
      case_context = coalesce(p_payload->>'case_context', ''),
      initial_conditions = coalesce(p_payload->>'initial_conditions', ''),
      attempted_approaches = coalesce(p_payload->>'attempted_approaches', ''),
      final_solution = coalesce(p_payload->>'final_solution', ''),
      reasoning_tradeoffs = coalesce(p_payload->>'reasoning_tradeoffs', ''),
      lessons_learned = coalesce(p_payload->>'lessons_learned', ''),
      experience_level = nullif(trim(p_payload->>'experience_level'), ''),
      workflow_status = 'draft',
      review_feedback = NULL,
      submitted_at = NULL,
      reviewed_at = NULL,
      reviewed_by = NULL,
      revision_number = revision_number + 1
  WHERE id = p_case_id
    AND owner_id = auth.uid()
    AND workflow_status IN ('draft', 'rejected')
  RETURNING * INTO v_case;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found or not editable';
  END IF;
END;
$$;

-- 7. Submit a complete case for review and record a snapshot.
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

  UPDATE public.expert_cases
  SET workflow_status = 'submitted',
      is_approved = false,
      submitted_at = now(),
      reviewed_at = NULL,
      reviewed_by = NULL,
      review_feedback = NULL
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

-- 8. Only a reviewer other than the author may approve/reject a submission.
CREATE OR REPLACE FUNCTION public.review_expert_case(
  p_case_id uuid,
  p_decision text,
  p_feedback text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case public.expert_cases%ROWTYPE;
  v_event text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.case_roles
    WHERE user_id = auth.uid() AND role = 'reviewer'
  ) THEN
    RAISE EXCEPTION 'Authorized reviewer role required';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  IF length(coalesce(p_feedback, '')) > 5000 THEN
    RAISE EXCEPTION 'Review feedback exceeds the 5000-character limit';
  END IF;

  SELECT * INTO v_case
  FROM public.expert_cases
  WHERE id = p_case_id AND workflow_status = 'submitted'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submitted case not found';
  END IF;

  IF v_case.owner_id = auth.uid() THEN
    RAISE EXCEPTION 'Authors cannot review their own cases';
  END IF;

  UPDATE public.expert_cases
  SET workflow_status = p_decision,
      is_approved = (p_decision = 'approved'),
      review_feedback = nullif(trim(coalesce(p_feedback, '')), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  v_event := p_decision;

  INSERT INTO public.expert_case_revisions (
    case_id, revision_number, event, snapshot, actor_id, feedback
  )
  VALUES (
    v_case.id, v_case.revision_number, v_event,
    to_jsonb(v_case), auth.uid(), v_case.review_feedback
  );
END;
$$;

-- Do not leave SECURITY DEFINER functions executable by PUBLIC.
REVOKE ALL ON FUNCTION public.create_case_draft(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_case_draft(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_case(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_expert_case(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_case_draft(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_case_draft(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_case(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_expert_case(uuid, text, text) TO authenticated;

COMMIT;