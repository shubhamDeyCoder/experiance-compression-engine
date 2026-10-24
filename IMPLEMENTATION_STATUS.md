# Implementation status

## Done in code (nothing below has been run against a live database or `next build` yet)

### Batch 1 — learner submission
- Migration `20261024120000_learner_case_requests.sql`; `/dashboard/submit`; "Submit a Case" buttons; expert "Open learner requests" + claim; `/resources/[id]`.

### Batch 2 — practice, rubric review, engine, metrics
- Migration `20261024130000_practice_rubric_and_engine.sql`:
  - `validate_case_options` + `submit_case`: an expert cannot submit without 3-6 scored options (one scoring 80+).
  - `review_case_scored`: reviewer rubric (clarity, accuracy, practical value, learning value, 1-5; approval needs >=3 each); old `review_expert_case` is no longer callable from the browser. Self-review still blocked.
  - `list_practice_cases` (option text only) and `submit_case_attempt` (score computed server-side; direct inserts into `learner_attempts` revoked).
  - `evaluate_free_text` + `reflection_attempts`: keyword-coverage check of a written answer (heuristic, labelled as such).
  - `find_similar_cases`: PostgreSQL full-text rank + domain/difficulty match + learner weak-area signal; approved cases only.
  - `learner_progress`: accuracy, domains, weak areas, repeated mistakes, first-vs-latest improvement, all from saved attempts.
- `supabase/seed_demo_cases.sql` (optional, manual): 3 demo cases flagged `is_seed`, labelled in the UI as not real expert experience.
- Backend: `app/api/engine/route.ts` (uses the caller's own token; optional LLM via `lib/engine/llm.ts`, server-side key only).
- Pages: `/engine` (matching, learning path, "Why this recommendation?", limitations), `/progress`; expert options editor; reviewer rubric UI; dashboard uses server-scored practice with retry.

## Not verified — do these first
1. `npm install`, `npm run lint`, `npm run build` (type errors are possible; only syntax was checked).
2. Apply both migrations; the SQL has never been executed (no Postgres available when it was written).
3. End-to-end test in README. The LLM summary has never been called.

## Known limitations
- Answer keys (`options` scores/feedback) are still readable by a determined signed-in learner by querying the API directly; the app UI does not expose them before answering. Fix: move answer keys to a separate table.
- Retrieval is keyword-based, not semantic (no embeddings). Weights are fixed; there is no automatic learning.
- Free-text check compares word stems, not meaning.
- No decline/unclaim of learner requests; learners cannot see reviewer feedback.
- No automated tests; no deployment done.
