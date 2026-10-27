---
id: TASK-003
title: User accounts schema, roles, and bootstrap admin migration
type: task
parent: TASK-002
status: done
created: 2026-10-27
updated: 2026-10-27
plan_approved: 2026-10-27
plan_approved_by: user
plan_revision: draft-3
---

# Business Task: User accounts schema, roles, and bootstrap admin migration

## Business problem

The application has no place to store user accounts, no concept of a user's
role, and no starting administrator. Without account storage, roles, and an
initial admin, neither sign-up/sign-in nor administration can exist.

## Desired outcome

The database stores user accounts; each account has a role of either `user`
or `admin`; and running the migrations against a fresh database creates the
very first `admin` account so the system can be administered from the start.

## User scenarios

- As the product team, after the migrations run, user accounts have a defined,
  queryable home.
- As the product team, every account is either a regular user or an admin.
- As the product team, a freshly set-up environment already has one admin
  account that can manage the system.

## Acceptance criteria

- The migrations apply successfully against the local PostgreSQL database.
- The setup is reproducible from a fresh database (reset, then migrate).
- The "users" storage exists and its role value is restricted to exactly
  `user` and `admin`.
- After the migrations run on a fresh database, exactly one account with the
  `admin` role exists.
- Migrations can be rolled back and reapplied as documented.
- No credentials or secrets are hardcoded or committed; the bootstrap admin's
  secret is supplied without committing it.

## Scope

### Included

- Application database connectivity and a migration mechanism for the local
  PostgreSQL database.
- A migration introducing the "users" storage.
- A role on a user restricted to `user` and `admin`.
- A migration that creates the very first admin user.

### Excluded

- Sign-up and sign-in API endpoints (TASK-004).
- Sign-up and sign-in UI pages (TASK-005).
- Fine-grained permissions, password reset, sign out, email verification, or
  social sign-in.
- Any role-management UI or admin console.

## Constraints

- Must use the local PostgreSQL database from TASK-001.
- No credentials or secrets may be hardcoded or committed.
- Architectural decisions (migration tooling, DB access library, role storage
  shape) must be recorded as required by `AGENTS.md`.

## Dependencies

- Depends on TASK-001 — Local database running via Docker Compose (done).

## Open questions

- Which migration tooling and database access library should be used
  (architectural decision; note there is currently no DB client or ORM
  dependency in `package.json`)?
- Should a role be a column on the users table or a separate roles table?
- How should the very first admin user be identified in the migration without
  committing a secret?
- What identity fields are required for a user (for example email and
  password, or username) and what uniqueness rules apply?

## Links

- Parent epic: ../TASK-002-authorization/task.md
- Decomposition proposal: ../TASK-002-authorization/decomposition-plan.md
- Technical plan: plan.md
- Working notes: working-notes.md
- Review: review.md
