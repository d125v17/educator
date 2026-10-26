---
description: Implement an approved task or fix review findings
agent: build
---

Task file: $ARGUMENTS

Read:
- `AGENTS.md`
- `tasks/README.md`
- the specified `task.md`
- the task's `plan.md`
- the task's `working-notes.md`
- the task's `review.md`
- relevant project documentation and source code

## 1. Validate the task

Before editing any files:

- Resolve the specified task file to its task directory.
- Read the task's frontmatter and identify its type and status.
- Follow the task schema documented in `tasks/README.md`.

### Epic protection

If the task has `type: epic` or `status: epic`:

- Do not implement it directly.
- Do not edit application source code or tests.
- Do not change the epic's status.
- Report that the specified task is an epic and list its child tasks if they are recorded.
- Explain that implementation must be performed through the normal workflow for individual child tasks.

Stop after reporting the epic. Do not continue to implementation.

If the task type or status is missing, contradictory, or incompatible with the documented schema, stop and report the inconsistency instead of guessing.

## 2. Determine the implementation mode

Select the mode from the current task status.

### Mode A: Normal implementation

Use this mode when `task.md` status is `implementation`.

- Confirm that `plan.md` contains recorded user approval, including the approver and an approval reference.
- Confirm that the approval refers to the exact current plan revision.
- Implement only the approved plan.
- Do not expand the business scope or make material changes to the approved plan without renewed approval.

### Mode B: Fix review findings

Use this mode when `task.md` status is `review failed`.

- Read `review.md` completely.
- Identify every unresolved finding from the latest review, including its severity, affected files or behavior, and reproduction or verification evidence.
- Read `task.md`, `plan.md`, relevant tests, and the affected source code.
- Confirm that the review findings belong to this task and are consistent with its acceptance criteria and approved plan.
- Confirm that the existing plan approval remains valid for the proposed fixes.

Treat `review.md` as the source of recorded review findings, not as authorization to expand the task's scope.

Fix the confirmed defects and unmet acceptance criteria identified by the review. Do not make unrelated refactors or changes merely to improve style.

If a finding conflicts with the approved plan, requires a material plan change, or is ambiguous in a way that could change intended behavior:

- Do not guess or silently change scope.
- Record the issue and the decision needed in `working-notes.md`.
- Set the task to `blocked` only if progress cannot safely continue and the documented workflow permits that transition.
- Ask the user for clarification or renewed plan approval.

Do not modify `review.md` to make findings appear resolved. Preserve the review history. Record the fixes and their evidence in `working-notes.md`; the next independent `/review` run will assess whether the findings are resolved.

### Invalid status

If the status is neither `implementation` nor `review failed`, do not implement.

Explain the current status and the required next workflow step. In particular, do not start implementation for tasks in `backlog`, `planning`, `planned`, `review`, `verification`, `need verification`, `done`, or `blocked`.

## 3. Common implementation rules

Before editing application code:

- Confirm that the selected mode is valid for the current status.
- Verify that the approved plan and required approval records are present and valid.
- Confirm that the proposed changes remain within the approved scope.
- If prerequisites are missing or inconsistent, stop without editing application code and explain what is missing.

During implementation:

- Follow the repository's conventions and relevant documentation.
- Add or update tests for behavior changes and confirmed defects.
- Run relevant tests, linting, type checks, and build checks when available.
- Do not claim that a check passed unless it was actually executed and passed.
- Inspect the final diff for unintended changes.
- Update `working-notes.md` with important findings, changes, checks, and unresolved issues.

Do not edit unrelated tasks or modify the task index unless the approved implementation explicitly requires it.

## 4. Finish the task

If implementation or fixes are ready for independent review:

- Update `task.md` status to `review`.
- Update the task's date according to the repository's conventions.
- Do not mark the task `done`; independent review and verification must determine the outcome.
- Do not overwrite or pre-emptively change the findings in `review.md`.

If implementation cannot safely continue:

- Set status to `blocked` only when a genuine decision, missing information, or external dependency prevents progress.
- Record the reason and the exact action needed to unblock the task.
- Do not claim that the task is ready for review.

## 5. Final report

Report:

- The mode used: normal implementation or review-fix mode.
- The changes made.
- Which review findings were addressed, referring to the finding identifiers or descriptions in `review.md`.
- Tests and other checks actually executed, including their results.
- Any unresolved findings, risks, or decisions needed.
- The final task status and the reason for it.