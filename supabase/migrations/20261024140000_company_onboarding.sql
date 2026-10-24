-- Company onboarding foundation for Experience Compression Engine.
-- Company ownership and role grants happen only inside trusted database functions.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  industry text NOT NULL CHECK (length(trim(industry)) BETWEEN 2 AND 100),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('manager', 'beginner', 'expert', 'reviewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, role)
);

CREATE TABLE IF NOT EXISTS public.company_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('beginner', 'expert', 'reviewer')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_memberships_user_idx ON public.company_memberships(user_id);
CREATE INDEX IF NOT EXISTS company_memberships_company_role_idx ON public.company_memberships(company_id, role);
CREATE INDEX IF NOT EXISTS company_invitations_company_idx ON public.company_invitations(company_id, created_at DESC);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.companies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.company_memberships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.company_invitations FROM PUBLIC, anon, authenticated;

-- A signed-in member can read only the company in which they have membership.
CREATE POLICY "Members can read their companies"
ON public.companies FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_memberships m
    WHERE m.company_id = companies.id AND m.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Members can read company membership list"
ON public.company_memberships FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_memberships self
    WHERE self.company_id = company_memberships.company_id
      AND self.user_id = (SELECT auth.uid())
  )
);

-- No direct browser writes are granted to these tables. All mutations go through RPCs.
GRANT SELECT ON public.companies, public.company_memberships TO authenticated;

CREATE OR REPLACE FUNCTION public.create_company_workspace(
  p_name text,
  p_industry text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before registering a company';
  END IF;
  IF length(trim(coalesce(p_name, ''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Company name must be between 2 and 120 characters';
  END IF;
  IF length(trim(coalesce(p_industry, ''))) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Industry must be between 2 and 100 characters';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = v_user_id AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'This account already manages a company workspace';
  END IF;

  INSERT INTO public.companies (name, industry, created_by)
  VALUES (trim(p_name), trim(p_industry), v_user_id)
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_memberships (company_id, user_id, role)
  VALUES (v_company_id, v_user_id, 'manager');

  RETURN v_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_company_invitation(
  p_email text,
  p_role text,
  p_token text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_invitation_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_role NOT IN ('beginner', 'expert', 'reviewer') THEN
    RAISE EXCEPTION 'Only beginner, expert, or reviewer invitations can be created';
  END IF;
  IF v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;
  IF length(coalesce(p_token, '')) < 32 THEN RAISE EXCEPTION 'Invalid invitation token'; END IF;

  SELECT company_id INTO v_company_id
  FROM public.company_memberships
  WHERE user_id = v_user_id AND role = 'manager'
  ORDER BY created_at ASC LIMIT 1;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Company manager permission required'; END IF;

  INSERT INTO public.company_invitations (company_id, email, role, token_hash, invited_by)
  VALUES (v_company_id, v_email, p_role, encode(digest(p_token, 'sha256'), 'hex'), v_user_id)
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_company_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_invitation public.company_invitations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in before accepting an invitation'; END IF;
  IF length(coalesce(p_token, '')) < 32 THEN RAISE EXCEPTION 'Invalid invitation link'; END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = v_user_id;
  SELECT * INTO v_invitation
  FROM public.company_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND accepted_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation is invalid, expired, or already used'; END IF;
  IF lower(v_invitation.email) <> coalesce(v_user_email, '') THEN
    RAISE EXCEPTION 'Sign in with the email address this invitation was sent to';
  END IF;

  INSERT INTO public.company_memberships (company_id, user_id, role)
  VALUES (v_invitation.company_id, v_user_id, v_invitation.role)
  ON CONFLICT (company_id, user_id, role) DO NOTHING;

  UPDATE public.company_invitations SET accepted_at = now() WHERE id = v_invitation.id;
  RETURN v_invitation.company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_workspace(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_company_invitation(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_company_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_company_workspace(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_invitation(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_company_invitation(text) TO authenticated;

COMMIT;
