BEGIN;

-- Avoid recursive RLS when membership policies inspect memberships.
CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships m
    WHERE m.company_id = p_company_id AND m.user_id = (SELECT auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;

DROP POLICY IF EXISTS "Members can read their companies" ON public.companies;
CREATE POLICY "Members can read their companies"
ON public.companies FOR SELECT TO authenticated
USING (public.is_company_member(id));

DROP POLICY IF EXISTS "Members can read company membership list" ON public.company_memberships;
CREATE POLICY "Members can read company membership list"
ON public.company_memberships FOR SELECT TO authenticated
USING (public.is_company_member(company_id));

-- Company memberships can grant Expert and Reviewer separately to one user.
CREATE OR REPLACE FUNCTION public.get_my_workspace_roles()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT COALESCE(array_agg(DISTINCT role_name), ARRAY['learner']::text[])
  FROM (
    SELECT CASE m.role WHEN 'beginner' THEN 'learner' ELSE m.role END AS role_name
    FROM public.company_memberships m
    WHERE m.user_id = (SELECT auth.uid())
    UNION ALL
    SELECT r.role AS role_name
    FROM public.case_roles r
    WHERE r.user_id = (SELECT auth.uid())
  ) roles;
$$;
REVOKE ALL ON FUNCTION public.get_my_workspace_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_workspace_roles() TO authenticated;

-- Keep legacy case-role grants working while accepting company-scoped role grants.
CREATE OR REPLACE FUNCTION public.has_case_role(p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT p_role IN ('expert', 'reviewer') AND (
    EXISTS (
      SELECT 1 FROM public.case_roles r
      WHERE r.user_id = (SELECT auth.uid()) AND r.role = p_role
    ) OR EXISTS (
      SELECT 1 FROM public.company_memberships m
      WHERE m.user_id = (SELECT auth.uid()) AND m.role = p_role
    )
  );
$$;
REVOKE ALL ON FUNCTION public.has_case_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_case_role(text) TO authenticated;

-- Return only the manager's own workspace, membership list, and invite metadata.
CREATE OR REPLACE FUNCTION public.manager_workspace_overview()
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
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT m.company_id INTO v_company_id
  FROM public.company_memberships m
  WHERE m.user_id = v_user_id AND m.role = 'manager'
  ORDER BY m.created_at ASC LIMIT 1;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Manager permission required'; END IF;

  SELECT jsonb_build_object(
    'company', (SELECT to_jsonb(c) FROM public.companies c WHERE c.id = v_company_id),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'role', m.role,
        'created_at', m.created_at,
        'email', u.email,
        'full_name', COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')
      ) ORDER BY m.created_at ASC)
      FROM public.company_memberships m
      JOIN auth.users u ON u.id = m.user_id
      WHERE m.company_id = v_company_id
    ), '[]'::jsonb),
    'invitations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'email', i.email,
        'role', i.role,
        'created_at', i.created_at,
        'expires_at', i.expires_at,
        'accepted_at', i.accepted_at,
        'expired', i.expires_at <= now()
      ) ORDER BY i.created_at DESC)
      FROM (
        SELECT * FROM public.company_invitations
        WHERE company_id = v_company_id
        ORDER BY created_at DESC LIMIT 25
      ) i
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.manager_workspace_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_workspace_overview() TO authenticated;

COMMIT;
