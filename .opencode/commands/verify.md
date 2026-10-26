---
description: Review implementation, verify acceptance criteria, and determine task status
agent: build
---

Task file or ID: $ARGUMENTS

Read `AGENTS.md`, `tasks/README.md`, the current task's `task.md`,
`plan.md`, `review.md`, and `docs/testing.md` if it exists.

Identify the current task directory. Do not assume that task files are located
in the repository root.

## 1. Preconditions and scope

- Confirm that `task.md` status is `verification`.
- If the status is different, report the mismatch and do not silently force
  the task into verification.
- Compare the actual implementation with the approved plan, business goal,
  and every acceptance criterion.
- Inspect relevant code and tests as necessary.
- Discover and run the actual relevant test, lint, type-check, and build
  commands supported by the project.
- Do not claim that a command was executed unless it actually was.
- Do not modify application code during this review. Report required fixes
  instead.
- Update only the current task's `review.md` and `task.md` as needed.

## 2. Verify acceptance criteria

For every acceptance criterion, record:
- Criterion and expected behavior.
- Evidence collected.
- Exact command or inspection performed.
- Observed result.
- Outcome: `pass`, `fail`, or `unverified`.

Distinguish between:
- Confirmed implementation defects.
- Failed automated checks.
- Checks that could not run because of environment or dependency problems.
- Remaining uncertainties that require human judgment.

Do not mark an acceptance criterion as passing without sufficient evidence.

## 3. Determine the final status

Choose exactly one of the following statuses.

### `done`

Set `task.md` status to `done` when all of these conditions hold:
- Every acceptance criterion is satisfied by sufficient evidence.
- Relevant automated checks have passed, or any inapplicable checks have
  a documented justification.
- No known significant defects or unresolved issues remain.
- No material ambiguity or decision requiring human confirmation remains.
- The implementation matches the approved business goal and plan.

Do not require explicit user acceptance when these conditions are met.

### `need verification`

Set `task.md` status to `need verification` when:
- The implementation appears substantially correct, but a material uncertainty
  requires human inspection, a manual test, or a product/business decision.
- A relevant check could not be completed and its result is necessary to
  establish correctness, but there is insufficient evidence of an implementation
  defect.
- A remaining issue requires confirmation from the user before completion.

For every such issue, explain precisely what needs to be verified, why
automation cannot resolve it, and what action or decision is required.

Do not use this status merely because a trivial detail is uncertain.

### `review failed`

Set `task.md` status to `review failed` when:
- A reproducible or otherwise clearly demonstrated implementation defect exists.
- One or more acceptance criteria are demonstrably not satisfied.
- The implementation materially contradicts the approved plan or business goal.
- Relevant automated checks reveal failures attributable to the implementation.
- A required behavior is missing or incorrect.

For each failure, provide evidence, severity, affected files or components,
and the corrective action needed.

Do not classify an environmental failure alone as an implementation bug.
If a clear defect exists alongside an environmental problem, use
`review failed` because the defect independently justifies that result.

## 4. Resolve conflicting evidence

Use this decision order:

1. A confirmed significant defect or unmet acceptance criterion means
   `review failed`.
2. Otherwise, a material unresolved uncertainty requiring human action means
   `need verification`.
3. Otherwise, if all acceptance criteria and required checks are sufficiently
   verified, use `done`.

Never choose `done` merely because the available tests pass if important
acceptance criteria remain unverified.

Never choose `review failed` merely because a check was not executed, unless
other evidence demonstrates an implementation defect.

## 5. Record the result

Update `review.md` with:
- Review date.
- Summary of the implementation reviewed.
- Results for every acceptance criterion.
- Commands executed and their actual outcomes.
- Defects, uncertainties, and environment limitations.
- Final status and rationale.
- Required next actions, if any.

Update `task.md`:
- Set `status` to exactly one of `done`, `need verification`, or `review failed`.
- Update the `updated` date.
- Record a short status rationale or reference to `review.md`, using the
  existing task format where possible.

Preserve the business goal, acceptance criteria, and unrelated task metadata.

Read both files back and verify that the status and review findings are
consistent. Do not claim successful updates unless they were verified.

## 6. Final response

Report:
- Task ID and title.
- Final status: `done`, `need verification`, or `review failed`.
- Evidence for each acceptance criterion.
- Checks executed, including any failures or checks that could not run.
- Defects or uncertainties found.
- The next action, if any.

If status is `done`, state that the task was automatically marked complete
because the evidence met the review criteria.

If status is `need verification`, list the exact human verification or decision
required.

If status is `review failed`, list the defects and the required corrective
actions.

Do not implement fixes as part of this command.