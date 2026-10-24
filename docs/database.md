# 🗄️ Experience Compression Engine — Database Design

## 🌐 Overview

Experience Compression Engine (ECE) uses Supabase PostgreSQL to store application data and enforce critical workflow rules.

The database supports expert case creation, independent review, learner case requests, practice activities, and the foundation for company onboarding.

The authoritative schema is defined by the SQL migration files in `supabase/migrations/`.

## 🧱 Core Data Domains

| Domain | Purpose |
|---|---|
| 👤 Authentication | User identities and sessions managed by Supabase Auth |
| 🧑‍💻 Case management | Expert-authored cases and their workflow states |
| 📝 Revision history | Submission and review snapshots for traceability |
| 🎓 Learner requests | Problems submitted by learners for expert assistance |
| 🛡️ Role management | Assignment of expert and reviewer workflow roles |
| 🧠 Practice and progress | Learning attempts, evaluation results, and progress data |
| 🏢 Company onboarding | Company workspaces, memberships, and invitations |

The actual tables, relationships, and available fields depend on the migrations applied to the database.

## 🔐 Authentication and Authorization

Supabase Auth authenticates users. Database policies and protected database functions determine which actions each authenticated user may perform.

The `public.case_roles` table supports workflow-role assignments for experts and reviewers.

- **Learner:** Uses normal authentication and accesses permitted learner resources.
- **Expert:** Creates and manages permitted cases and submits work for review.
- **Reviewer:** Reviews submitted cases and approves them or requests revisions.
- **Administrator:** Assigns workflow roles through authorized administrative operations.
- **Company manager:** Part of the company-onboarding direction; complete management permissions depend on the implemented membership integration.

Role names alone do not establish access. Effective permissions also depend on database grants, RLS policies, function checks, and the current user's identity.

## 🔄 Case Workflow

```mermaid id="1x3y9a"
flowchart TD
    A["📝 Draft"]
    B["📨 Submitted for review"]
    C["🔁 Revision requested"]
    D["📨 Resubmitted"]
    E["✅ Approved"]
    A --> B
    B --> C
    C --> A
    A --> D
    D --> E
    B --> E
```

This is a conceptual illustration of the case lifecycle. Refer to the database functions and migration constraints for the exact allowed transitions.

## 🛡️ Row Level Security

Row Level Security (RLS) is used to restrict access to protected records according to the authenticated caller and applicable authorization rules.

Important security requirements include:

- Users must not be able to read or modify unauthorized records.
- Experts must not modify another expert's protected work.
- Reviewers must not approve their own submissions.
- Learners must not access pending or private expert cases through unauthorized paths.
- Company membership and invitation operations must validate the caller's permissions.
- Sensitive workflow transitions must be performed through appropriately protected database functions.

RLS policies should be tested independently of frontend route protection.

## ⚙️ Database Functions

Protected PostgreSQL RPC functions can perform operations that require validation and controlled state transitions.

Examples include:

- Creating and updating permitted drafts.
- Submitting cases for review.
- Recording reviewer decisions and feedback.
- Managing learner case requests.
- Creating company workspaces and handling invitations.

Each function must have appropriate execution privileges, input validation, and authorization checks. Security-definer functions require particular care because they may execute with elevated privileges.

## 🧾 Revision Snapshots and Integrity

The `expert_case_revisions` table is used by the case workflow to retain submission and review snapshots.

Snapshots support traceability by preserving relevant information associated with workflow events.

Additional integrity controls include:

- Required-field validation.
- Payload-size and field-length limits.
- Restrictions on editing cases during review.
- Prevention of unauthorized workflow transitions.

## 🏢 Company Onboarding

The company-onboarding foundation introduces:

- `companies` — company workspace records.
- `company_memberships` — company-user membership records.
- `company_invitations` — invitation records.

Company onboarding is not yet equivalent to a complete manager dashboard. Invitation UI, email delivery, and integration with the existing case-role system require further implementation.

## 🚀 Migrations and Local Development

Database changes are maintained in `supabase/migrations/`.

To apply reviewed migrations to a linked development project:

```bash
supabase login
supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
supabase db push
```

Review migration contents and the target database before applying changes. Avoid using production data for routine testing.

## 🧪 Recommended Database Tests

- [ ] Verify RLS on all tables containing protected data.
- [ ] Check grants for tables, sequences, and RPC functions.
- [ ] Test requests made by unauthenticated users.
- [ ] Test access across different user accounts and roles.
- [ ] Confirm authors cannot approve their own cases.
- [ ] Confirm learners cannot read unpublished cases.
- [ ] Validate case payloads and invalid state transitions.
- [ ] Test company membership and invitation authorization.
- [ ] Confirm migrations work against a clean development database.

## 📌 Source of Truth

This document describes the database design at a conceptual level. For exact columns, constraints, relationships, policies, and function definitions, consult the SQL migrations and the live database schema.

Keep this document updated whenever the schema or authorization model changes.
