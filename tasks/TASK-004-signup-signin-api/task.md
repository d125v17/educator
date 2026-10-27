---
id: TASK-004
title: Sign-up and sign-in API endpoints
type: task
parent: TASK-002
status: implementation
created: 2026-10-27
updated: 2026-10-27
plan_approved: 2026-10-27
plan_approved_by: user
plan_revision: draft-1
---

# Business Task: Sign-up and sign-in API endpoints

## Business problem

Even once accounts can be stored, people have no way to create an account or
sign in through the application. Without API endpoints, no user interface or
client can register or authenticate anyone.

## Desired outcome

A person can create an account and sign in through API endpoints. New
accounts are created with the `user` role, existing users can authenticate,
and invalid requests are rejected with clear errors.

## User scenarios

- As a new visitor, I send my details to the sign-up endpoint and an account
  is created for me.
- As a returning user, I send my credentials to the sign-in endpoint and I am
  authenticated.
- As a client application, I receive consistent success and error responses I
  can rely on.

## Acceptance criteria

- A valid sign-up request creates an account with the `user` role.
- A valid sign-in request authenticates an existing account.
- Invalid input and wrong credentials are rejected with clear error responses.
- Duplicate accounts are handled consistently.
- Passwords are never stored or returned in plain text.
- No credentials or secrets are hardcoded or committed.

## Scope

### Included

- An API endpoint to sign up, creating a user with role `user`.
- An API endpoint to sign in and authenticate an existing user.
- Input validation and password handling.
- Consistent success and error responses.

### Excluded

- Sign-up and sign-in UI pages (TASK-005).
- The users schema, roles, and bootstrap admin (TASK-003).
- Password reset, sign out, email verification, or social sign-in.

## Constraints

- No credentials or secrets may be hardcoded or committed.
- Must use the users storage and roles delivered by TASK-003.

## Dependencies

- Depends on TASK-003 — User accounts schema, roles, and bootstrap admin
  migration (blocking).

## Open questions

- Which authentication mechanism should be used (session cookie vs. token)?
- What validation rules apply (for example email format, password rules)?
- How should duplicate accounts be handled (reject, or another behavior)?
- What exact request/response shape should the endpoints expose?

## Links

- Parent epic: ../TASK-002-authorization/task.md
- Decomposition proposal: ../TASK-002-authorization/decomposition-plan.md
- Technical plan: plan.md
- Working notes: working-notes.md
- Review: review.md
