# Implementation status

## Implemented in the project files

- Learner case requests and expert claiming flow.
- Expert case capture, scored decision options, and independent rubric review.
- Learner practice, server-side scoring, written-answer feedback, recommendations, and progress metrics.
- Supabase company onboarding with protected company creation and manager membership.
- Employee registration through manager-issued invitations.
- Manager dashboard at `/manager` with company overview, member list, role-specific invitations, and recent invitation status.
- Workspace role lookup supports manager, learner, expert, and reviewer roles, including separate Expert and Reviewer memberships for one person.
- Manager overview is returned by a security-definer RPC; the browser cannot directly write company or membership tables.
- Hybrid engine retrieval now uses PostgreSQL full-text search and optional pgvector embeddings for approved cases and company-scoped knowledge.
- `/engine` can generate cited, fictional scenarios, evaluate answers against approved expert decision rubrics, adapt difficulty from saved progress, and collect learner feedback.
- Managers can contribute company decisions, ingest explicitly allow-listed web sources, index approved cases, and validate or reject learner feedback.
- Engine scenarios, evaluations, feedback, and source provenance are persisted through authenticated database functions. Retrieval is not model fine-tuning.
- Company evaluation examples are queued as pending and require manager validation before inclusion in a curated evaluation dataset; managers can export only validated examples and feedback.
- Optional `ai-engine/` FastAPI service implements real per-company TF-IDF/logistic-regression training from authorized reviewed evaluations and expert-scored learner attempts, group-separated holdout evaluation, model versioning, promotion gates, and scheduled retraining.
- The manager workspace can request training and view active version/holdout metrics. Learner evaluations can display an experimental, uncalibrated historical manager-review classifier score; it is not a probability or a grade. The separate learner-decision classifier is trained but is not yet used to score free-text answers.
- Engine actions have database-backed per-user quotas; trusted-source fetches pin HTTPS to validated public IPv4 addresses and reject private destinations and redirects. Production ingress/egress controls remain required.

## Must be run and tested against the actual project/database

1. `npm install`, `npm run lint`, and `npm run build`.
2. `supabase db push` to apply pending migrations, including `20261025120000_ai_learning_engine.sql` and `20261025130000_engine_launch_hardening.sql`.
3. Install and run Python tests using the commands in README's **Trainable Python service** section.
4. Configure separate test workspaces and accounts; verify manager-only export/training, learner inference, and cross-company isolation against the applied migration.
5. Add organization-approved source domains to `engine_trusted_domains`, then test company knowledge retrieval with separate workspaces.
6. Use the manager page to index approved cases, create scenarios, submit learner feedback, validate/reject feedback, and train a model when data suffices.
7. Live database/RLS and production service deployment checks remain environment-dependent and must be completed before claiming them verified.
8. Configure provider-level unauthenticated rate limits, signup protections, and budget alerts before a public event.

## Known limitations

- Invitations are displayed as copyable URLs; automatic email delivery is not configured.
- Without `OPENAI_API_KEY`, retrieval falls back to full-text search. Existing approved cases must be embedded through the manager workspace to participate in vector search.
- Free-text evaluation is heuristic and should not be described as semantic understanding.
- RAG and validated feedback do not fine-tune model weights. Model output quality still needs representative offline evaluation.
- The supervised models require sufficient real, manager-reviewed data; no model or quality metrics are fabricated when data is inadequate.
- No automated end-to-end test suite has been added.
