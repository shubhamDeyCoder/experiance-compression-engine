-- OPTIONAL demo data. Run manually in the Supabase SQL Editor AFTER applying all migrations.
--
-- These cases were WRITTEN BY THE DEVELOPMENT TEAM to demonstrate the retrieval engine.
-- They are NOT genuine verified industry experience. They are flagged is_seed = true and the
-- app labels them "Demo seed example". To remove them later:
--   delete from public.expert_cases where is_seed = true;

INSERT INTO public.expert_cases (
  title, domain, difficulty, situation, question, options,
  is_approved, workflow_status, is_seed,
  case_context, initial_conditions, attempted_approaches,
  final_solution, reasoning_tradeoffs, lessons_learned
)
SELECT * FROM (VALUES
(
  '[DEMO SEED] API latency doubled after a release',
  'Backend engineering', 'Intermediate',
  'A web API''s median response time doubled right after a Friday deployment. Error rates are normal. The release contained a new database query, a dependency upgrade and a logging change. Customers are complaining about slow pages.',
  'What should you do first?',
  '[{"text":"Roll back immediately, then investigate the release offline with profiling data.","score":100,"feedback":"Restoring service first and diagnosing from evidence afterwards limits customer impact. A rollback is cheap and reversible when the release is the only recent change."},
    {"text":"Add more servers to absorb the load.","score":30,"feedback":"Scaling out treats a symptom. If a slow query is the cause, more servers add cost and can increase database contention."},
    {"text":"Start rewriting the new database query without measuring it.","score":40,"feedback":"Optimising before measuring risks fixing the wrong thing while customers keep waiting."},
    {"text":"Wait until Monday to see if it improves on its own.","score":0,"feedback":"Latency regressions tied to a release rarely fix themselves, and waiting prolongs customer impact."}]'::jsonb,
  true, 'approved', true,
  'Small team, single primary database, deployments on Fridays.',
  'Only the release changed. Error rate is flat. Latency doubled within minutes of deployment.',
  'Scaling servers and waiting were considered and rejected.',
  'Roll back to the previous version to restore service, then reproduce the slowdown in staging with a profiler and query plan. The new query was missing an index; add it, re-test under load and redeploy behind a feature flag.',
  'Rolling back delays the feature but protects customers. Measuring before changing code avoids optimising the wrong part. A feature flag trades a little complexity for a safer rollout.',
  'Separate restoring service from finding the cause. Change one thing at a time. Keep releases small enough to roll back. Review query plans for new queries before release.'
),
(
  '[DEMO SEED] Scope creep in a small client project',
  'Project management', 'Foundational',
  'You are managing a three-week website project for a local business. In week two the client asks for an online booking system that was not in the agreement. The team is already at full capacity and the deadline is fixed.',
  'How do you respond?',
  '[{"text":"Explain the impact on time and cost, and offer options: a later phase, a reduced version, or a revised schedule and budget.","score":100,"feedback":"Making trade-offs visible lets the client choose with full information and protects the team and the relationship."},
    {"text":"Say yes and ask the team to work extra hours.","score":20,"feedback":"Absorbing unplanned scope silently harms quality and morale and sets a precedent for further additions."},
    {"text":"Refuse flatly because it is not in the contract.","score":50,"feedback":"Holding the boundary is right, but refusing without alternatives damages trust and misses a chance to add value."},
    {"text":"Quietly build a basic version without telling the client.","score":10,"feedback":"Hidden work breaks expectations on cost and schedule and removes the client''s ability to decide."}]'::jsonb,
  true, 'approved', true,
  'Fixed-price contract, fixed deadline, small team.',
  'Booking system was never discussed in the original scope document.',
  'Saying yes and refusing outright were considered.',
  'Acknowledge the request, estimate the effort, then present three options with their time and cost impact. Record the client''s choice as a written change request before any work starts.',
  'Adding scope costs time or money; a phased approach keeps the launch date but delays the feature. Written change requests add small overhead but prevent disputes.',
  'Treat new requests as change requests, not favours. Offer options rather than a bare yes or no. Put decisions in writing.'
),
(
  '[DEMO SEED] Rising defect rate on a production line',
  'Quality assurance', 'Advanced',
  'A packaging line''s defect rate rose from 1% to 4% over two weeks. The supplier, one machine operator shift and the machine settings changed during that period. Management wants a fix by the end of the week.',
  'What is the best way to find the cause?',
  '[{"text":"Collect defect data by shift, machine setting and supplier batch, then compare to isolate which change correlates with the rise.","score":100,"feedback":"Stratifying the data separates overlapping changes so you can test the most likely cause with evidence instead of guessing."},
    {"text":"Replace the supplier immediately.","score":35,"feedback":"The supplier is only one of three changes. Switching without evidence may cost money and leave the real cause untouched."},
    {"text":"Retrain all operators this week.","score":30,"feedback":"Training addresses one possible cause only and takes time away from finding the real one."},
    {"text":"Increase inspection at the end of the line.","score":40,"feedback":"Inspection catches defects but does not remove their cause; it adds cost and still lets some defects through."}]'::jsonb,
  true, 'approved', true,
  'Three changes overlapped within the same two weeks; records exist for each shift and batch.',
  'Defects rose from 1% to 4%. Records exist by shift, setting and supplier batch.',
  'Replacing the supplier, retraining operators and extra inspection were considered.',
  'Group defects by shift, machine setting and supplier batch. The rise tracked a machine temperature setting changed at the same time as the shift change. Restore the old setting on a trial run, confirm the defect rate drops, then document the approved range.',
  'Containing defects with extra inspection is a short-term hedge while root cause analysis runs. Trial runs cost production time but confirm the cause before permanent change.',
  'When several things change at once, stratify the data before acting. Confirm a suspected cause with a controlled trial. Document the validated settings.'
)
) AS v(title, domain, difficulty, situation, question, options, is_approved, workflow_status, is_seed, case_context, initial_conditions, attempted_approaches, final_solution, reasoning_tradeoffs, lessons_learned)
WHERE NOT EXISTS (SELECT 1 FROM public.expert_cases e WHERE e.title = v.title);
