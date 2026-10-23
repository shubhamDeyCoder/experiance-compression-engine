BEGIN;

-- Check a user's role without exposing the private role table.
CREATE OR REPLACE FUNCTION public.has_case_role(p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_role IN ('expert', 'reviewer')
    AND EXISTS (
      SELECT 1
      FROM public.case_roles AS r
      WHERE r.user_id = auth.uid()
        AND r.role = p_role
    );
$$;

REVOKE ALL ON FUNCTION public.has_case_role(text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_case_role(text)
TO authenticated;

-- Reviewers should only see cases awaiting review.
-- Authors can still see their own workflow cases.
DROP POLICY IF EXISTS "Owners and reviewers can read workflow cases"
ON public.expert_cases;

CREATE POLICY "Owners and reviewers can read workflow cases"
ON public.expert_cases
FOR SELECT
TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  OR (
    workflow_status = 'submitted'
    AND public.has_case_role('reviewer')
  )
);

-- Let authors inspect their own revision history.
ALTER TABLE public.expert_case_revisions
ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.expert_case_revisions
TO authenticated;

DROP POLICY IF EXISTS "Authors can read their case revisions"
ON public.expert_case_revisions;

CREATE POLICY "Authors can read their case revisions"
ON public.expert_case_revisions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.expert_cases AS c
    WHERE c.id = expert_case_revisions.case_id
      AND c.owner_id = (SELECT auth.uid())
  )
);

COMMIT;