---
id: TASK-006
title: Validation
type: task
status: review failed
created: 2026-10-27
updated: 2026-10-27
plan_approved: 2026-10-27
plan_approved_by: user
plan_revision: draft-3
---

# Business Task: Validation

## Business problem

The project has no consistent, automated way to validate code quality before
it is shared. There is no code formatter, so formatting is left to individual
habit, and there is no way to run automated tests. This makes the codebase
inconsistent and makes it hard to catch mistakes before they reach other
people.

## Desired outcome

Contributors can validate the project with documented, runnable tooling:
formatting is applied consistently (for example with Prettier), and tests can
be run with a documented command. The tooling fits the current project and is
usable by any contributor without extra guidance.

## User scenarios

- As a contributor, I run a documented command to format the code
  consistently before sharing it.
- As a contributor, I run a documented command to run the project's tests.
- As a new contributor, I read the project documentation and know which
  validation commands exist and how to use them.
- As the product team, code style and correctness are checked by tooling
  rather than by memory or habit.

## Acceptance criteria

- Prettier (or an equivalent formatter, if the user confirms a different
  choice) is set up in the project and can format the codebase with a
  documented command.
- A test setup exists and the project's tests can be run with a documented
  command.
- The available validation commands are documented where contributors will
  find them.
- Existing project commands (for example build and lint) continue to work.
- No credentials or secrets are added.

Process requirements added during planning and approved by the user:

- Every new task is expected to include tests (as part of the task workflow).
- Code must pass all tests during the `/verify` process.
- Sub-agent instructions (the review agent) are updated to check tests.

The exact tooling, commands, and any example tests depend on the open
questions below; these criteria must not be finalized by guessing.

## Scope

### Included

- A code formatter (Prettier was named in the description).
- A test setup and test tooling for the project.
- Documentation of the validation commands.
- Wiring the tooling into the project's existing scripts/conventions as
  appropriate.

### Excluded

- Changing application behavior, features, or architecture.
- Not specified beyond the above. Anything described by the description's
  "etc." is listed as an open question until it is confirmed.

## Constraints

- Must fit the current project and its existing conventions.
- Avoid unnecessary dependencies.
- No credentials or secrets may be committed.

## Open questions

- Which test framework and tooling should be used? The description says
  "tests" but does not name one.
- What does "etc." include — for example type-checking, coverage thresholds,
  pre-commit hooks, lint-staged, or continuous integration? Not specified.
- Should example or representative tests be included, and for what?
- Should the formatter and tests run automatically (for example in CI or on
  commit), or only via manual commands?
- How should Prettier and the existing ESLint setup relate (for example should
  ESLint formatting rules be turned off in favor of Prettier)?
- Are there any style or coverage requirements the tooling must enforce?
- Which Node.js / package-manager versions must be supported?

## Links

- Technical plan: plan.md
- Working notes: working-notes.md
- Review: review.md
