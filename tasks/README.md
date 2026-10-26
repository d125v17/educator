# Task Management

## Purpose

Tasks are the source of truth for development work.

Every implementation must be linked to a task. Task status must reflect the
actual development phase and the evidence collected during review and
verification.

## Task structure

Each task has its own directory:

- `task.md` — business requirements and current status
- `plan.md` — technical implementation plan and approval record
- `working-notes.md` — temporary findings, hypotheses, and open questions
- `review.md` — review findings, verification evidence, and conclusions

## Statuses

- `backlog`: business task created; planning has not started
- `planning`: technical analysis and planning in progress
- `planned`: technical plan prepared and awaiting user approval
- `implementation`: approved implementation in progress, or fixes are required
- `review`: implementation ready for independent review
- `verification`: tests and quality checks in progress
- `need verification`: implementation appears correct, but a material uncertainty or manual check requires human attention
- `review failed`: review or verification identified a confirmed defect, unmet acceptance criterion, or material mismatch with the approved requirements
- `done`: acceptance criteria are sufficiently verified, required checks have passed or have documented justification, and no material unresolved issues remain
- `blocked`: progress requires a decision, missing information, or an external dependency

## Ownership of each phase

Planning may write only inside its own task directory and must not modify
application source code.

Independent review is read-only with respect to application code. Review
findings and verification evidence may be recorded in the task's `review.md`
and `task.md` by the authorized workflow command.

Plan approval is a human decision recorded in `plan.md`. The `/review` command
may automatically set a task to `done` when the evidence satisfies the
completion criteria defined below. Explicit human acceptance is not required
for every task.

| Phase | Produces | Writes task files |
| --- | --- | --- |
| Create task | Business description and initial status | Yes, creates a task directory |
| Plan | `plan.md`, `working-notes.md`, status `planned` or `blocked` | Yes, inside the task directory only |
| Approve | Final plan and recorded user approval | Yes |
| Implement | Code, tests, updated `working-notes.md` | Yes, as authorized |
| Review | Independent findings | No application-code changes |
| Record review | Findings in `review.md` | Yes |
| Verify | Test results and evidence for each acceptance criterion | Yes |
| Finalize review | Final status and rationale in `task.md` and `review.md` | Yes |
| Human verification | Results of required manual checks or decisions | Yes |

## Workflow

1. Create a task using business-oriented language.
2. Set