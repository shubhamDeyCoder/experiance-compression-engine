# Experience Compression Engine — manager workspace patch

This patch adds the manager dashboard, role-aware workspace navigation, a more resilient company onboarding form, and the manager integration migration.

## Apply

From the root of your existing `experience-compression-engine` project, extract these files into the project root and allow them to overwrite matching files. Keep your existing `.env.local` and `node_modules` untouched.

Then run:

```bash
npm install
supabase migration list
supabase db push
npm run lint
npm run build
```

The new migration is `20261025100000_manager_workspace.sql`. Since company onboarding migration `20261024140000_company_onboarding.sql` may already be recorded as applied in your Supabase project, do not try to reapply it manually in the SQL Editor. The new migration fixes/reasserts the safe membership policy and adds the manager overview and multi-role RPCs.

## Smoke test

1. Sign in with the manager account and open `/manager`.
2. Create an invitation for a test email and role.
3. Open the invitation link in a private/incognito browser and register with the exact invited email.
4. If Supabase requires email confirmation, confirm it, sign in, and reopen the original invitation URL before accepting.
5. Check the member list in `/manager`.
6. Invite the same test user separately as Expert and Reviewer to verify the company membership model supports both roles.

## Important limitations

- Invitation delivery is a copyable link, not an automatic email. Send it privately to the invited person.
- The app build and live database flow have not been verified in this environment because package downloads from the npm registry failed with a network/DNS error. Run the checks above locally and fix any reported error before deploying.
- Do not share `.env.local`, Supabase service-role keys, or database passwords.
