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

Apply the migrations in order (`supabase db push`, or run each file once in the SQL Editor), including
`20261025120000_ai_learning_engine.sql` and `20261025130000_engine_launch_hardening.sql`. Optionally run `supabase/seed_demo_cases.sql` to load three clearly labelled
demo cases so retrieval has something to find.

Copy `.env.example` to `.env.local` and configure:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — required for the existing app.
- `ANTHROPIC_API_KEY` — required for generated scenarios and rubric-based AI evaluations; without it, existing retrieval and practice remain available.
- `OPENAI_API_KEY` — required for embeddings, hybrid semantic retrieval, company knowledge indexing, and approved-case indexing. Without it, search falls back to PostgreSQL keyword retrieval.
- `ANTHROPIC_MODEL` and `OPENAI_EMBEDDING_MODEL` — optional model overrides.

Provider keys are server-side only. Retrieved company knowledge and learner answers are sent to the configured model providers for the requested AI operation; configure providers and data handling to meet your organization's requirements.

Start the application:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Apply migrations to a linked Supabase project:

```bash
supabase login
supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
supabase db push
```

For trusted web source ingestion, a Supabase administrator must explicitly allow-list domains in the SQL editor. Use only domains your organization has reviewed:

```sql
insert into public.engine_trusted_domains (domain)
values ('example.org')
on conflict (domain) do update set enabled = true;
```

Managers can then add company decisions or ingest pages from allow-listed HTTPS domains on `/manager`. Company knowledge and feedback are scoped to company memberships. Use **Index approved cases** on that page to embed existing approved cases in batches of 25.

The launch-hardening migration adds database-enforced per-user request quotas (search 30/minute, scenarios 8/minute, evaluations 15/minute, trusted-source ingestion 2/minute, and model training once per five minutes, with separate limits for manager actions). The API returns HTTP 429 with `Retry-After` when a limit is reached and fails closed if its rate-limit RPC is unavailable. These per-account limits do not replace hosting-provider IP/WAF limits for unauthenticated traffic or multi-account abuse.

Trusted-source fetching now resolves and pins an allow-listed hostname to a vetted public IPv4 address, rejects private/special-use or IPv6 destinations, uses HTTPS with the original hostname for certificate validation, and does not follow redirects. This intentionally excludes IPv6-only source hosts. Also configure outbound network policy at the hosting provider so the web process cannot reach private/link-local networks; application checks are defense in depth, not a substitute for egress controls.

RAG uses retrieved evidence; it is not model training or fine-tuning. Evaluations and validated feedback are persisted with source provenance to support future curation and evaluation datasets.

### Trainable Python service

The optional `ai-engine/` service trains tenant-specific scikit-learn models from authorized company data returned by the protected `export_engine_training_dataset` RPC. It currently trains manager-review acceptance and expert-scored learner-decision outcomes as separate supervised tasks. Training requires real labels, minimum per-class counts, independent group-separated holdout data, and a measured macro-F1 promotion threshold. Insufficient or failing candidates are not promoted. RAG, feedback storage, and learner difficulty personalization remain distinct from model training.

The active manager-review model can provide an experimental, uncalibrated historical classifier score during learner evaluation; it is explicitly not the learner's grade or a probability estimate. Python artifacts are local files and must be stored on persistent, access-controlled storage in production. The service supports Python 3.9+; its container image uses Python 3.11.

Generate a shared internal secret with `openssl rand -hex 32`, then set the same value in `.env.local` and `ai-engine/.env`. Copy the Supabase project URL and publishable key into the Python environment file; configure the service-role key only for the scheduled worker and CLI trainer. Never prefix these secrets with `NEXT_PUBLIC_`.

```bash
cp ai-engine/.env.example ai-engine/.env
# Edit ai-engine/.env with the same AI_ENGINE_INTERNAL_KEY as .env.local.
python3 -m venv ai-engine/.venv
source ai-engine/.venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r ai-engine/requirements.txt
(cd ai-engine && .venv/bin/python -m pytest tests)
```

Run these from the repository root in separate terminals after setting both environment files:

```bash
set -a; source ai-engine/.env; set +a
ai-engine/.venv/bin/uvicorn ai_engine.service:app --app-dir ai-engine --host 127.0.0.1 --port 8000
```

```bash
set -a; source ai-engine/.env; set +a
ai-engine/.venv/bin/python -m ai_engine.scheduler
```

Set `AI_ENGINE_SERVICE_URL=http://localhost:8000` in `.env.local`, then restart Next.js. The manager workspace has **Train / refresh models** and displays the current model version and holdout metrics. Training can also be run for one company from the repository root:

```bash
set -a; source ai-engine/.env; set +a
PYTHONPATH=ai-engine ai-engine/.venv/bin/python -m ai_engine.train --company-id YOUR_COMPANY_UUID
```

`AI_ENGINE_ARTIFACT_DIR` must point to persistent private storage. The scheduler runs once at startup and then at `AI_ENGINE_RETRAIN_INTERVAL_HOURS`. For a containerized API service:

```bash
docker build -t ece-ai-engine ./ai-engine
docker run --env-file ai-engine/.env -p 8000:8000 \
  -e AI_ENGINE_ARTIFACT_DIR=/srv/ai-engine/artifacts \
  -v "$(pwd)/ai-engine/artifacts:/srv/ai-engine/artifacts" ece-ai-engine
```

Run the scheduler as a separate worker using the same image, environment, and shared persistent artifact volume:

```bash
docker run --env-file ai-engine/.env \
  -e AI_ENGINE_ARTIFACT_DIR=/srv/ai-engine/artifacts \
  -v "$(pwd)/ai-engine/artifacts:/srv/ai-engine/artifacts" \
  --entrypoint python ece-ai-engine -m ai_engine.scheduler
```

Required Python service variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `AI_ENGINE_INTERNAL_KEY`. The scheduler/CLI additionally require `SUPABASE_SERVICE_ROLE_KEY`. Optional controls are `AI_ENGINE_ARTIFACT_DIR`, `AI_ENGINE_MINIMUM_PER_CLASS`, `AI_ENGINE_MINIMUM_MACRO_F1`, and `AI_ENGINE_RETRAIN_INTERVAL_HOURS`. The Next.js proxy requires private `AI_ENGINE_SERVICE_URL` and the matching `AI_ENGINE_INTERNAL_KEY`; it allows plain HTTP only in local development, so production service URLs must use HTTPS. Schedule persistent-artifact backups and restrict network access to the service; only the Next.js server should call its authenticated model endpoints.

### Hackathon launch checklist

Before inviting external participants:

1. Apply all migrations to a staging Supabase project and exercise RLS/RPC access with separate users in at least two companies.
2. Deploy Next.js and the Python API over HTTPS; configure the same high-entropy internal key only as private server secrets. Keep the service-role key only in the worker/trainer.
3. Configure hosting-provider IP rate limits/WAF, signup protections/CAPTCHA if available, provider spending alerts, and a kill switch for model-provider calls.
4. Verify secret scanning, backups, data deletion/retention expectations, and provider data policies for participant prompts.
5. Run a complete signed-in test of search, source citations, scenario generation, answer evaluation, manager review, model status/training (including insufficient-data behavior), and cross-company isolation.
6. Start with invite-only participants and monitor costs/errors. Do not describe model scores as calibrated probabilities or certified competency assessments.

The repository tests do not replace staging database, provider, or deployment verification. Do not claim those checks passed until they have been run in the target environment.

Test additions (after the Batch 1 flow):
1. Expert: the draft form now has "Scored decision options" - add 3 options, one scoring 80+, before submitting.
2. Reviewer: score the four rubric criteria, then approve.
3. Learner: `/dashboard` - answer a case (score and feedback come back from the server); use "Practise this case again".
4. Learner: `/engine` - paste a problem; check matched cases, "Why this recommendation?" and the limitations box.
5. Learner: `/resources/<id>` - write an answer and press "Check my answer".
6. Learner: `/progress` - the metrics should reflect exactly the attempts you made.

Architecture: Next.js pages use Supabase RPC functions for database-enforced authorization and scoring, and the
authenticated `/api/engine` route for hybrid retrieval and server-side LLM calls. When enabled, that route forwards
authorized ML requests to the separately deployed Python service. Expert/reviewer workflow roles are provisioned in
`case_roles`; company workspace roles are managed through protected company membership and invitation functions.

## Company onboarding foundation

The company onboarding migration adds `companies`, `company_memberships`, and `company_invitations`, plus secure RPCs for creating a company workspace, issuing invitations, and accepting invitations. Company membership permissions coexist with the existing `case_roles` workflow rather than replacing it. The manager dashboard and invitation workflow are implemented below.

Apply the new migration after the existing migrations:

```bash
supabase db push
```

New routes:

- `/login` — enterprise-style sign-in and password reset.
- `/company/register` — company and first-manager onboarding.
- `/register?invite=TOKEN` — employee registration from a manager-issued invitation.

Do not manually insert company roles from the browser or disable RLS to make onboarding work. Invitation links are copyable; automatic email delivery is not configured.

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
