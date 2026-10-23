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
