
# Task Management

## Purpose

Tasks are the source of truth for development work.
Every implementation must be linked to a task.

## Task structure

Each task has its own directory:

- `task.md` — business requirements and current status
- `plan.md` — technical implementation plan
- `working-notes.md` — temporary findings and open questions
- `review.md` — review findings and conclusions

## Statuses

- `backlog`: business task created, planning not started
- `planning`: technical analysis and planning in progress
- `planned`: plan prepared and awaiting user approval
- `implementation`: approved implementation in progress
- `review`: implementation ready for independent review
- `verification`: tests and quality checks in progress
- `done`: acceptance criteria met and result accepted
- `blocked`: progress requires a decision or missing information

## Workflow

1. Create a task with business-oriented language.
2. Set status to `backlog`.
3. Analyze the task and prepare `plan.md`.
4. Set status to `planned` and wait for approval.
5. After explicit approval, set status to `implementation`.
6. Implement the approved plan and update `working-notes.md`.
7. Set status to `review` and perform an independent review.
8. Resolve findings and set status to `verification`.
9. Run required checks and evaluate acceptance criteria.
10. After successful verification and user acceptance, set status to `done`.

## Rules

- Do not implement a task in `backlog`, `planning`, or `planned`.
- The business goal must remain understandable to a non-technical stakeholder.
- Technical design belongs in `plan.md`, not in the business description.
- Do not treat hypotheses in working notes as approved decisions.
- Record blockers explicitly.
- Update the status field in `task.md` when the phase changes.
- Keep task directories in place; use the status field rather than moving files.
- Do not mark a task done if required tests failed or acceptance criteria remain unmet.

## Task index

<!-- Add a link to each task directory here. -->
