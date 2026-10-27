---
id: TASK-002
title: Authorization
type: epic
status: epic
created: 2026-10-27
updated: 2026-10-27
---

# Business Task: Authorization

## Business problem

The product has no way for people to create an account, sign in, or be
recognized by the application. Until this exists, the application cannot
associate data with a specific person, cannot restrict features to known
users, and cannot build any personalized experience. This blocks most
user-facing and data-owning features.

The product also has no concept of a user's role, so it cannot distinguish
regular users from administrators or restrict administrative functionality.

## Desired outcome

People can create an account and sign in to the application through a
consistent experience, and the application stores user accounts in its
database. This epic delivers the foundation of user identity and access that
later features can build upon.

Concretely, the epic covers these related capabilities requested by the
business:

- A database migration that introduces the "users" storage.
- Role support with two roles: "user" and "admin".
- A migration that creates the very first admin user so the system can be
  administered from the start.
- API endpoints that allow a person to sign up (register) and sign in.
- User interface pages where a person can sign up and sign in.

## User scenarios

- As a new visitor, I can create an account so that I can access the
  application as a known user.
- As a returning user, I can sign in with my credentials so that the
  application recognizes me.
- As the product team, we have a stored, queryable record of each user so
  that future features can attach data to a user.
- As the product team, every user has a role of either "user" or "admin" so
  that administrative capabilities can be distinguished from regular use.
- As the product team, a first admin user exists after the migrations run so
  that the system can be administered from a fresh setup.
- As the product team, we can grow access control on top of this foundation
  in later work.

These scenarios are described at the epic level. The detailed, independently
implementable steps will be defined as child tasks during decomposition.

## Acceptance criteria

Epic-level completion criteria (to be refined and mapped to child tasks during
the decomposition phase):

- The database can be migrated to include the "users" storage, and the
  migration can be applied and rolled back / reapplied as documented.
- The "users" storage records a role with the two allowed values "user" and
  "admin".
- A migration creates the very first admin user, so that after migrations run
  on a fresh database there is one account with the "admin" role.
- API endpoints exist that let a person sign up and sign in.
- User interface pages exist that let a person sign up and sign in.
- The sign-up and sign-in flows work end to end through the UI and the API
  against the migrated database.
- No credentials or secrets are hardcoded or committed.

Open questions that affect these criteria are listed under "Open questions".
This epic is not complete until all required child tasks and the epic-level
criteria above are satisfied.

## Scope

### Included

- A database migration introducing the "users" storage.
- Role support on a user, with exactly two roles: "user" and "admin".
- A migration that creates the very first admin user.
- API endpoints to sign up and to sign in.
- User interface pages to sign up and to sign in.

### Excluded

- Not specified. Any further authorization behavior that is not listed above
  (for example fine-grained permissions, password reset, sign out, email
  verification, third-party/social sign-in) is not part of the stated
  description and must be confirmed before being added.

## Constraints

- Not specified, beyond the requirement that this work be organized as an
  epic containing child tasks.
- No credentials or secrets may be hardcoded or committed.

## Dependencies

- Depends on the local database environment delivered by TASK-001 so that the
  "users" migration can be applied and exercised locally.

## Open questions

- What identity fields are required for a user (for example email and
  password, or username)? The description says "users" but does not specify
  fields or uniqueness rules.
- How should the "user" and "admin" roles be stored (for example a column on
  the users table or a separate roles table)? Not specified.
- How should the very first admin user be identified in the migration (for
  example fixed credentials, environment-supplied values, or a placeholder
  that must be changed)? Not specified, and no secret may be committed.
- How is a role assigned when a person signs up — does sign-up always create a
  "user", with "admin" only via migration or an administrative action?
- What authentication mechanism is expected (for example session cookies,
  tokens)? The description says "signup" and "signin" but does not specify.
- How should passwords be stored and protected? Not specified; must not be
  invented.
- Which technology stack and conventions apply to the API and UI pages? Not
  specified in the description.
- Which API style is expected (REST, GraphQL, other)? Not specified.
- Is there any requirement for password rules, email format validation, or
  duplicate-account handling? Not specified.
- Should a "sign out" flow be included, or is it out of scope?
- What are the UI expectations (framework, layout, validation feedback,
  error messaging)? Not specified.
- How should the epic be decomposed into child tasks and in what order? To be
  proposed during the decomposition phase and approved by the user.

## Child tasks

This epic is decomposed into the following child tasks. Each is planned,
approved, implemented, reviewed, and verified independently as a normal task.

| Child task | Title | Depends on |
| --- | --- | --- |
| TASK-003 | User accounts schema, roles, and bootstrap admin migration | TASK-001 (done) |
| TASK-004 | Sign-up and sign-in API endpoints | TASK-003 |
| TASK-005 | Sign-up and sign-in UI pages | TASK-004 |

Recommended implementation order: TASK-003 → TASK-004 → TASK-005
(dependencies form a simple acyclic chain).

Epic-level completion criteria:

- TASK-003, TASK-004, and TASK-005 are all `done`.
- Roles `user` and `admin` exist, and a first admin account is created by a
  migration on a fresh database.
- Sign-up and sign-in work end to end through the UI, the API, and the
  database.
- No credentials or secrets are hardcoded or committed.
- Any required integration / end-to-end verification has passed.

Decomposition proposal: `decomposition-plan.md` (status: applied).

Epic-level acceptance criteria in the section above map to child tasks as
follows:

| Epic-level acceptance criterion | Child task |
| --- | --- |
| Users DB migration | TASK-003 |
| Role support: "user" and "admin" | TASK-003 |
| Migration creating the very first admin user | TASK-003 |
| Sign-up / sign-in API endpoints | TASK-004 |
| Sign-up / sign-in UI pages | TASK-005 |
| End-to-end flows work | TASK-005 (with TASK-003, TASK-004) |
| No hardcoded/committed secrets | TASK-003, TASK-004, TASK-005 |

## Links

- Technical plan: plan.md
- Working notes: working-notes.md
- Review: review.md
