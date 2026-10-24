# Experience Compression Engine

Experience Compression Engine turns practitioner judgment into reviewed learning cases. It is a Next.js App Router application backed by Supabase authentication and Row Level Security.

## Milestone 2: Expert Case Capture & Review

This milestone adds two protected workspaces:

- `/expert` — experts create private drafts, revise rejected work, and submit complete cases.
- `/review` — reviewers see only submitted cases and can approve them for learners or request a revision with feedback.

An approved case remains compatible with the learner dashboard. The expert workflow deliberately captures source material and decision rationale; adding scored learner answer choices is a separate scenario-design concern.

### Workflow and security

1. An administrator assigns an authenticated user either the `expert` or `reviewer` role in `public.case_roles`.
2. Experts use database functions to create and edit only their own drafts or rejected cases.
3. Submission records an immutable snapshot. The case is read-only while it awaits review.
4. A reviewer other than the author approves or rejects it. Approval sets `is_approved` so the existing learner dashboard can read it.
5. Row Level Security limits authors to their work, reviewers to pending work, and learners to approved cases. Direct browser writes are revoked; workflow transitions occur only in security-definer functions with role and input checks.

The migrations retain submission and review snapshots in `expert_case_revisions` and enforce payload size, required fields, and field length limits server-side.

### Set up locally

Create `.env.local` with your Supabase project values:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Install and run the app:

```bash
npm install
npm run dev
```

Apply database migrations to a linked project:

```bash
supabase db push
```

### Provision an expert or reviewer

After the person has signed up, use the Supabase SQL editor as an administrator. Replace the placeholder UUID with the user ID from **Authentication → Users**:

```sql
insert into public.case_roles (user_id, role)
values ('USER_UUID_HERE', 'expert');
```

Use `reviewer` instead to provision a review account. The table intentionally permits one workflow role per account; use separate accounts if someone needs to author and review, preserving the no-self-review control.

### Checks

```bash
npm run lint
npm run build
```

## Learner case submission (Batch 1)

Learners use **Submit a Case** on `/dashboard` (page: `/dashboard/submit`). Experts claim open requests on `/expert`,
write the case, and a different reviewer approves it on `/review`. Approved cases open at `/resources/<id>`.

Apply the new migration before testing: `supabase db push` (or paste
`supabase/migrations/20261024120000_learner_case_requests.sql` into the Supabase SQL Editor and run it once).

End-to-end test with three accounts (learner = any normal sign-up; expert and reviewer provisioned in `case_roles`):
1. Learner: `/dashboard` -> Submit a Case -> fill the form -> success message; the case shows "Waiting for an expert".
2. Expert: `/expert` -> "Open learner requests" -> Claim -> fill final solution and lessons learned -> Submit for review.
3. Reviewer: `/review` -> Approve.
4. Learner: `/dashboard/submit` -> status "Published" -> Open learning resource.
5. Check: the expert account cannot approve its own case; the learner cannot open `/review` or `/expert`.

See `IMPLEMENTATION_STATUS.md` for what is verified and what remains.

## Engine, practice and progress (Batch 2)

Apply BOTH migrations in order (`supabase db push`, or run each file once in the SQL Editor). Optionally run
`supabase/seed_demo_cases.sql` to load three clearly labelled demo cases so retrieval has something to find.
Copy `.env.example` to `.env.local` and fill the two Supabase values. `ANTHROPIC_API_KEY` is optional.

Test additions (after the Batch 1 flow):
1. Expert: the draft form now has "Scored decision options" - add 3 options, one scoring 80+, before submitting.
2. Reviewer: score the four rubric criteria, then approve.
3. Learner: `/dashboard` - answer a case (score and feedback come back from the server); use "Practise this case again".
4. Learner: `/engine` - paste a problem; check matched cases, "Why this recommendation?" and the limitations box.
5. Learner: `/resources/<id>` - write an answer and press "Check my answer".
6. Learner: `/progress` - the metrics should reflect exactly the attempts you made.

Architecture: Next.js pages -> Supabase RPC functions (all authorization and scoring in PostgreSQL) -> one API route
(`/api/engine`) that calls retrieval with the caller's own token and optionally an LLM. Roles are granted only by an
administrator in `case_roles`.

## Company onboarding foundation

The company onboarding migration adds `companies`, `company_memberships`, and `company_invitations`, plus secure RPCs for creating a company workspace, issuing invitations, and accepting invitations. It does not yet replace the existing case workflow's `case_roles` model or complete the manager dashboard; those are the next integration tasks.

Apply the new migration after the existing migrations:

```bash
supabase db push
```

New routes:

- `/login` — enterprise-style sign-in and password reset.
- `/company/register` — company and first-manager onboarding.
- `/register?invite=TOKEN` — employee registration from a manager-issued invitation.

Invitation creation is exposed as a protected database RPC, but the manager-facing invitation UI and email delivery still need to be implemented. Do not manually insert company roles from the browser or disable RLS to make onboarding work.

## Manager workspace and company invitations

The manager dashboard is available at `/manager` after the first manager finishes company onboarding. Managers can:

- view the company workspace and current membership list;
- issue an email-specific invite for Beginner, Expert, or Reviewer;
- copy the invitation URL to send it privately (email delivery is not configured in this milestone);
- view recent invitation status and expiry dates.

Apply the manager integration migration after the existing onboarding migration:

```bash
supabase db push
```

The migration adds a safe membership-check helper to prevent recursive RLS, a workspace-role lookup that supports multiple company roles, and a manager-only overview RPC. A person can receive separate Expert and Reviewer invitations for the same company. Existing `case_roles` assignments remain supported.

Important: invitations are single-use, expire after seven days, and can only be accepted by an account whose verified email matches the invitation. Never share an invitation link publicly. This milestone creates a copyable link; it does not send email automatically.
