# Decomposition Plan — EPIC TASK-002: Authorization

Status: APPLIED
Source task: TASK-002 — Authorization
Prepared: 2026-10-27
Applied: 2026-10-27
Mode: APPLY (child tasks TASK-003, TASK-004, TASK-005 created; epic recorded)

Applied after explicit user confirmation ("yes. create all these tasks").
Child tasks created: TASK-003, TASK-004, TASK-005. The source task TASK-002
was converted to an epic. This file records the applied decomposition.

This proposal is a draft for user review. It does not create child tasks,
change the source task status, or modify the task index. Decomposition is
applied only after explicit user confirmation.

## 1. Original business goal and expected overall outcome

From `task.md`: people can create an account and sign in, the application
stores user accounts with a role of either `user` or `admin`, a first admin
user exists after migrations run, and UI pages support sign up and sign in.

Expected overall outcome: a working account foundation (storage, roles,
bootstrap admin), API endpoints to sign up and sign in, and UI pages for both
flows, all working end to end against the local PostgreSQL database and
without committing secrets.

## 2. Repository context (inspected)

- Stack: Next.js 16.4.3 App Router, React 19.3.0, TypeScript 5,
  Tailwind CSS 4 (`package.json`).
- Database: PostgreSQL 17 via Docker Compose (`compose.yaml`,
  `docs/local-database.md`, ADR 0001). Started with `docker compose up -d`,
  reachable at `127.0.0.1:5432`, credentials from git-ignored `.env`.
- Source tree is minimal: `src/app/{layout.tsx,page.tsx,globals.css}`.
- There is **no** database client/ORM dependency, **no** migration tooling,
  and **no** test framework configured yet.
- The backend-to-database connection itself was explicitly deferred by
  TASK-001 (see ADR 0001, "Consequences"); TASK-003 therefore includes
  establishing database connectivity and a migration mechanism.

## 3. Proposed child tasks

### TASK-003 — User accounts schema, roles, and bootstrap admin migration

- Directory slug (proposed): `user-accounts-schema-and-roles`
- Business goal: user accounts are stored reliably, each has a role of
  `user` or `admin`, and a first admin account exists after migrations run.
- Scope (included):
  - Establish application database connectivity and a migration mechanism
    for the local PostgreSQL database.
  - A migration introducing the "users" storage.
  - A role on a user with exactly the two values `user` and `admin`.
  - A migration that creates the very first admin user.
- Exclusions:
  - Sign-up / sign-in endpoints and UI (TASK-004, TASK-005).
  - Fine-grained permissions, password reset, sign out, email verification,
    social sign-in.
  - Any role-management UI or admin console.
- Acceptance criteria (testable):
  - Migrations apply against the local database and are reproducible from a
    fresh database (`down -v` then up).
  - The "users" storage exists and records a role restricted to `user` and
    `admin`.
  - After migrations run on a fresh database, exactly one account with the
    `admin` role exists.
  - Migrations can be rolled back and reapplied as documented.
  - No credentials or secrets are hardcoded or committed; the bootstrap
    admin's secret is supplied without committing it.
- Relevant areas: `compose.yaml`, `.env` / `.env.example`, new DB/migration
  modules under `src/`, `docs/` (database and migration docs), `package.json`.
- Dependencies: TASK-001 (local database — `done`).
- Risks / open questions:
  - Choice of migration tooling and DB access library (ORM vs. raw driver) is
    an architectural decision.
  - How roles are stored (column on users vs. separate table).
  - How the first admin is identified without committing a secret.

### TASK-004 — Sign-up and sign-in API endpoints

- Directory slug (proposed): `signup-signin-api`
- Business goal: a person can create an account and sign in through API
  endpoints.
- Scope (included):
  - API endpoint to sign up, creating a user with role `user`.
  - API endpoint to sign in and authenticate an existing user.
  - Password handling and input validation.
  - Consistent success and error responses.
- Exclusions:
  - UI pages (TASK-005).
  - Session/token persistence choices beyond what sign-in returns, unless
    required to verify the flow.
  - Password reset, sign out, email verification, social sign-in.
- Acceptance criteria (testable):
  - A valid sign-up request creates an account with role `user`.
  - A valid sign-in request authenticates an existing account.
  - Invalid input and wrong credentials are rejected with clear errors.
  - Duplicate accounts are handled consistently.
  - Passwords are never stored or returned in plain text, and no secrets are
    committed.
- Relevant areas: new API route handlers under `src/app/` (App Router),
  shared user/validation logic, DB access from TASK-003.
- Dependencies: TASK-003.
- Risks / open questions:
  - Authentication mechanism (session cookie vs. token).
  - Validation rules and duplicate-account behavior.

### TASK-005 — Sign-up and sign-in UI pages

- Directory slug (proposed): `signup-signin-ui`
- Business goal: a person can sign up and sign in from the application UI.
- Scope (included):
  - A sign-up page and a sign-in page.
  - Form input, client-side validation feedback, and error messaging.
  - Wiring the forms to the TASK-004 API endpoints.
- Exclusions:
  - Post-authentication account area, profile, or role-based access control.
  - Password reset, sign out, email verification, social sign-in.
- Acceptance criteria (testable):
  - The sign-up page and sign-in page are reachable and render.
  - A person can complete sign up and sign in end to end from the browser
    against the local database.
  - Validation and error states are shown to the user.
  - No secrets are exposed in the UI or committed.
- Relevant areas: new pages/components under `src/app/`, shared UI styling
  (Tailwind), reuse of TASK-004 API.
- Dependencies: TASK-004.
- Risks / open questions:
  - UI framework details, layout, and messaging conventions.

## 4. Recommended implementation order

1. TASK-003 — schema, roles, bootstrap admin, DB connectivity/migrations.
2. TASK-004 — sign-up and sign-in API endpoints (needs the schema).
3. TASK-005 — sign-up and sign-in UI pages (needs the API).

Dependencies form a simple chain (003 → 004 → 005); no cycles.

## 5. Epic completion criteria

TASK-002 may be considered complete only when:

- TASK-003, TASK-004, and TASK-005 are all `done`.
- Roles `user` and `admin` exist, and a first admin account is created by a
  migration on a fresh database.
- Sign-up and sign-in work end to end through the UI, the API, and the
  database.
- No credentials or secrets are hardcoded or committed.
- Any required integration / end-to-end verification has passed.

## 6. Decisions required before APPLY

Structural decisions to confirm before applying:

- Confirm the decomposition into three child tasks (TASK-003, TASK-004,
  TASK-005) and their scopes.
- Confirm the proposed directory slugs.

Decisions that may be deferred to each child task's own planning phase (they
do not block applying the decomposition, but must be resolved there before
implementation):

- Migration tooling / DB access library (architectural — record in
  `docs/decisions/`).
- Authentication mechanism (session vs. token).
- How roles are stored.
- How the bootstrap admin's secret is supplied without committing it.
- Password rules, validation, and duplicate-account behavior.
- UI framework/layout conventions.

## 7. Coverage check

- "Users DB migration" → TASK-003.
- "Roles user/admin" → TASK-003.
- "First admin migration" → TASK-003.
- "API signup/signin" → TASK-004.
- "UI pages" → TASK-005.
- "No committed secrets" → standing acceptance criterion in TASK-003,
  TASK-004, TASK-005, and epic-level.

No part of the current `task.md` scope is left unassigned. No child scope
conflicts or overlaps were identified. All acceptance criteria above are
observable and testable.

## 8. Approval

Awaiting explicit user confirmation. On approval, run APPLY mode
(`/decompose TASK-002 --apply`) to create TASK-003/004/005 and update the
epic and task index.
