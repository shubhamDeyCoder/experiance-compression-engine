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

## Must be run and tested against the actual project/database

1. `npm install`
2. `npm run lint`
3. `npm run build`
4. `supabase db push` to apply any pending migrations, especially `20261025100000_manager_workspace.sql`.
5. Test company registration, sign-out/sign-in, invitation creation, matching-email signup, invitation acceptance, expert submission, reviewer approval, and learner practice using separate test accounts.

## Known limitations

- Invitations are displayed as copyable URLs; automatic email delivery is not configured.
- Retrieval uses database full-text search and heuristics rather than embeddings or a trained model.
- Free-text evaluation is heuristic and should not be described as semantic understanding.
- No automated end-to-end test suite has been added.
