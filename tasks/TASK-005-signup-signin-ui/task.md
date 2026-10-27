---
id: TASK-005
title: Sign-up and sign-in UI pages
type: task
parent: TASK-002
status: backlog
created: 2026-10-27
updated: 2026-10-27
---

# Business Task: Sign-up and sign-in UI pages

## Business problem

People cannot create an account or sign in from the application itself. Even
with working API endpoints, there is no user-facing way to reach them.

## Desired outcome

A person can sign up and sign in from the application's user interface. The
pages collect the required input, call the API endpoints, and show clear
validation and error feedback.

## User scenarios

- As a new visitor, I open the sign-up page, submit my details, and my account
  is created.
- As a returning user, I open the sign-in page, submit my credentials, and I
  am signed in.
- As a person who made a mistake, I see a clear message telling me what went
  wrong.

## Acceptance criteria

- The sign-up page and the sign-in page are reachable and render.
- A person can complete sign up and sign in end to end from the browser
  against the local database.
- Validation and error states are shown to the user.
- No credentials or secrets are exposed in the UI or committed.

## Scope

### Included

- A sign-up page and a sign-in page.
- Form input, client-side validation feedback, and error messaging.
- Wiring the forms to the sign-up/sign-in API endpoints (TASK-004).

### Excluded

- Post-authentication account area, profile, or role-based access control.
- Password reset, sign out, email verification, or social sign-in.
- The API endpoints themselves (TASK-004).

## Constraints

- No credentials or secrets may be exposed in the UI or committed.
- Must use the API endpoints delivered by TASK-004.

## Dependencies

- Depends on TASK-004 — Sign-up and sign-in API endpoints (blocking).

## Open questions

- What UI framework and layout conventions should be used?
- What messaging conventions should validation and error states follow?
- Should the pages redirect somewhere after a successful sign up or sign in,
  and if so, where?

## Links

- Parent epic: ../TASK-002-authorization/task.md
- Decomposition proposal: ../TASK-002-authorization/decomposition-plan.md
- Technical plan: plan.md
- Working notes: working-notes.md
- Review: review.md
