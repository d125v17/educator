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

### Dependency check

If `task.md` has a `Dependencies` section:

- For every blocking dependency, read that task's `task.md` frontmatter.
- A dependency is satisfied only when its `task.md` status is `done`. The
  `task.md` status is the single source of truth; do not re-derive a
  dependency's completion from its `review.md`, `working-notes.md`, or the
  code.
- If a blocking dependency is not `done`, stop without editing application
  code and report which dependency is unsatisfied and its current status,
  unless the approved plan explicitly identifies this work as safe to do in
  parallel.

## 2. Determine the implementation mode

Select the mode from the current task status.

### Mode A: Normal implementation

Use this mode when `task.md` status is `implementation`.

- Confirm that `plan.md` records user approval: the approver, the approval
  date, and the plan revision label (for example `draft-2`).
- Confirm that `task.md` `plan_revision` equals the revision label recorded in
  `plan.md`. If they differ, stop and report the mismatch; `/approve` records
  the current revision.
- Implement only the approved plan.
- Do not expand the business scope or make material changes to the approved
  plan without renewed approval. "Material" is defined in `tasks/README.md`
  ("Material plan changes").

### Mode B: Fix review findings

Use this mode when `task.md` status is `review failed`.

#### Work list

- Read `review.md` completely. The `### Dispositions` table of the latest
  review is the work list: implement only the rows whose disposition is
  `must-fix`.
- Do not implement `follow-up`, `accepted`, or `rejected` rows, even when the
  change is small or you are already editing that file. Every extra change
  widens the diff the next review must cover, and that is how review loops
  stop converging. If you believe a non-blocking finding must be fixed now,
  say so in the final report and leave it unchanged.
- If the latest review has no Dispositions table (a review recorded before
  the dispositions rule existed), treat the findings that its Outcome
  paragraph names as the reason for `review failed` as `must-fix`, and all
  other findings as `follow-up`.
- Read `task.md`, `plan.md`, the relevant tests, and the affected source code.
- Confirm that the must-fix findings belong to this task and are consistent
  with its acceptance criteria and approved plan.
- Decide for each fix whether it is a material plan change as defined in
  `tasks/README.md`. Remediation inside the approved scope (tests, error
  handling, hardening of planned behaviour, log sanitisation, documentation)
  is not material and needs no `/approve`; do not ask for a new plan revision
  for it. If a fix is material, ask the user to run `/approve` with the
  change. `/approve` records the new revision and keeps the task in
  `review failed`, so this mode still applies afterwards.

#### For each must-fix finding

1. Reproduce it from the recorded evidence before changing anything.
2. Fix the pattern, not only the cited location. Search the codebase for every
   other site with the same pattern: sibling route handlers, every call site
   of the same helper, every script or test that repeats the construct. Fix
   all of them in this round and list every site in `working-notes.md`.
3. Add or update the test that would have caught the finding, at every site
   fixed. A test added for one route must have its twin for each sibling
   route changed in the same way.
4. Re-run the finding's evidence scenario and confirm it no longer applies.

Treat `review.md` as the source of recorded review findings, not as
authorization to expand the task's scope. Do not make unrelated refactors or
changes merely to improve style.

If a must-fix finding conflicts with the approved plan, requires a material
plan change, or is ambiguous in a way that could change intended behaviour:

- Do not guess or silently change scope.
- Record the issue and the decision needed in `working-notes.md`.
- Set the task to `blocked` only if progress cannot safely continue and the
  documented workflow permits that transition.
- Ask the user for clarification or renewed plan approval.

Do not modify `review.md` to make findings appear resolved. Preserve the
review history. Record the fixes and their evidence in `working-notes.md`;
the next independent `/review` run will assess whether the findings are
resolved.

### Invalid status

If the status is neither `implementation` nor `review failed`, do not implement.

Explain the current status and the next step:

- `backlog`: run `/start-planning`.
- `planning` or `planned`: the plan must be completed and approved with
  `/approve`.
- `review`: run `/review`; the implementation is awaiting independent review.
- `verification`: run `/verify`.
- `need verification`: the user must resolve the manual check or decision
  recorded in `review.md`, then run `/verify` again.
- `done`: the task is complete. Do not reopen it; further changes need a new
  task.
- `blocked`: the recorded blocker must be resolved first.

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

- Run the full check suite (`npm test`, `npm run lint`, `npm run format:check`,
  `npm run build`) and record the actual results. Do not claim a check passed
  unless it ran and passed.
- Inspect the final diff. It must contain only the files needed for the
  approved scope (Mode A) or for the must-fix findings (Mode B).
- Append a round record to `working-notes.md`. Use the heading
  `## Implementation round (YYYY-MM-DD)` in Mode A, or
  `## Review-fix round <n> (YYYY-MM-DD, Review <N>)` in Mode B, and record:
  - the must-fix identifiers addressed and, for each, every site fixed;
  - the exact list of files changed in this round;
  - the commands run and their actual results;
  - anything deliberately left unchanged, and why.
  `/review` hands this record to the reviewer so that a re-review covers the
  delta instead of the whole task again.
- Commit this round's work as described in `tasks/README.md` ("Commits"),
  unless the user has said not to commit: stage only the files in the round
  record plus the task directory, never the whole working tree.
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
- Which must-fix findings were addressed, by identifier, and every site fixed
  for each.
- Non-blocking findings left unchanged on purpose, by identifier.
- Tests and other checks actually executed, including their results.
- Any unresolved findings, risks, or decisions needed.
- The final task status and the reason for it.
