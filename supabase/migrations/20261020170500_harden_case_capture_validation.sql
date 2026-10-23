BEGIN;

-- Keep workflow input bounded at the database boundary. The browser is not trusted.
CREATE OR REPLACE FUNCTION public.validate_case_payload(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR pg_column_size(p_payload) > 50000 THEN
    RAISE EXCEPTION 'Invalid or oversized case payload';
  END IF;

  IF length(trim(coalesce(p_payload->>'title', ''))) NOT BETWEEN 1 AND 200
     OR length(trim(coalesce(p_payload->>'domain', ''))) NOT BETWEEN 1 AND 100
     OR length(trim(coalesce(p_payload->>'situation', ''))) NOT BETWEEN 1 AND 10000
     OR length(trim(coalesce(p_payload->>'question', ''))) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'Title, domain, situation and question are required and must be within length limits';
  END IF;

  IF length(coalesce(p_payload->>'case_context', '')) > 10000
     OR length(coalesce(p_payload->>'initial_conditions', '')) > 10000
     OR length(coalesce(p_payload->>'attempted_approaches', '')) > 10000
     OR length(coalesce(p_payload->>'final_solution', '')) > 10000
     OR length(coalesce(p_payload->>'reasoning_tradeoffs', '')) > 10000
     OR length(coalesce(p_payload->>'lessons_learned', '')) > 10000
     OR length(coalesce(p_payload->>'experience_level', '')) > 100 THEN
    RAISE EXCEPTION 'One or more case fields exceed their length limit';
  END IF;

  IF jsonb_typeof(coalesce(p_payload->'options', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Options must be a JSON array';
  END IF;
END;
$$;

-- Recreate both authoring functions so they share validation without changing their
-- authorization or state-transition rules.
CREATE OR REPLACE FUNCTION public.create_case_draft(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.case_roles WHERE user_id = auth.uid() AND role = 'expert') THEN RAISE EXCEPTION 'Expert role required'; END IF;
  PERFORM public.validate_case_payload(p_payload);
  INSERT INTO public.expert_cases (title, domain, difficulty, situation, question, options, is_approved, owner_id, workflow_status, case_context, initial_conditions, attempted_approaches, final_solution, reasoning_tradeoffs, lessons_learned, experience_level)
  VALUES (trim(p_payload->>'title'), trim(p_payload->>'domain'), coalesce(nullif(trim(p_payload->>'difficulty'), ''), 'Intermediate'), trim(p_payload->>'situation'), trim(p_payload->>'question'), coalesce(p_payload->'options', '[]'::jsonb), false, auth.uid(), 'draft', coalesce(p_payload->>'case_context', ''), coalesce(p_payload->>'initial_conditions', ''), coalesce(p_payload->>'attempted_approaches', ''), coalesce(p_payload->>'final_solution', ''), coalesce(p_payload->>'reasoning_tradeoffs', ''), coalesce(p_payload->>'lessons_learned', ''), nullif(trim(p_payload->>'experience_level'), '')) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_case_draft(p_case_id uuid, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.case_roles WHERE user_id = auth.uid() AND role = 'expert') THEN RAISE EXCEPTION 'Authenticated expert role required'; END IF;
  PERFORM public.validate_case_payload(p_payload);
  UPDATE public.expert_cases SET title = trim(p_payload->>'title'), domain = trim(p_payload->>'domain'), difficulty = coalesce(nullif(trim(p_payload->>'difficulty'), ''), 'Intermediate'), situation = trim(p_payload->>'situation'), question = trim(p_payload->>'question'), options = coalesce(p_payload->'options', '[]'::jsonb), case_context = coalesce(p_payload->>'case_context', ''), initial_conditions = coalesce(p_payload->>'initial_conditions', ''), attempted_approaches = coalesce(p_payload->>'attempted_approaches', ''), final_solution = coalesce(p_payload->>'final_solution', ''), reasoning_tradeoffs = coalesce(p_payload->>'reasoning_tradeoffs', ''), lessons_learned = coalesce(p_payload->>'lessons_learned', ''), experience_level = nullif(trim(p_payload->>'experience_level'), ''), workflow_status = 'draft', review_feedback = NULL, submitted_at = NULL, reviewed_at = NULL, reviewed_by = NULL, revision_number = revision_number + 1
  WHERE id = p_case_id AND owner_id = auth.uid() AND workflow_status IN ('draft', 'rejected');
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found or not editable'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_case_payload(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_case_draft(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_case_draft(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_case_draft(jsonb), public.update_case_draft(uuid, jsonb) TO authenticated;

COMMIT;
