---
description: Review, approve, and persist the current task's technical plan
agent: build
---

# Approve Technical Plan

Arguments:
$ARGUMENTS

## Objective

Persist the technical implementation plan produced during planning, optionally
revise it according to the user's comments, and mark the task as approved.

This command is allowed to modify only the current task's:
- `plan.md`
- `task.md`

Do not modify application source code or unrelated project files.

## 1. Identify the current task and plan

1. Read `AGENTS.md` and `tasks/README.md`.
2. Identify the task being discussed in the current conversation.
3. Locate that task's `task.md` and `plan.md`.
4. Obtain the complete plan produced by `/start-planning`.

Prefer the complete plan available in the current conversation. If it is not
available, inspect the task's existing `plan.md` for a complete draft.
Do not invent missing plan content or claim that console output was recovered
if it was not accessible.

If the task or the complete plan cannot be identified confidently, ask the user
to provide the task ID/path or paste the plan. Do not modify files yet.

## 2. Interpret the user's request

- If arguments are empty, use the current plan without intentional content
  changes.
- If arguments contain comments or requested changes, revise the plan to
  address them before saving.
- Preserve the task's business goal and acceptance criteria.
- Do not silently broaden scope or invent requirements.
- If a comment introduces a material ambiguity, ask the user before proceeding.
- If a requested change conflicts with the business goal, explain the conflict
  and ask for clarification.
- Treat `/approve` as explicit approval of the final plan after applying the
  user's requested revisions.

## 3. Validate the plan

Before writing files, verify that the plan:
- Clearly states the business goal.
- Describes the proposed technical solution.
- Identifies relevant files/modules and implementation steps.
- Includes a testing and verification strategy.
- Covers important risks, error handling, and security considerations where
  applicable.
- Maps acceptance criteria to implementation and tests.
- Records remaining assumptions and unresolved questions.

Do not require irrelevant sections for a simple task. Do not claim repository
inspection or test execution unless actually performed.

If essential information is missing, ask the user rather than approving an
incomplete plan.

## 4. Save the plan

Write the complete final plan to the current task's `plan.md`.

Preserve useful existing frontmatter or metadata where appropriate. Record the
approval state, for example:

approval:
  status: approved
  approved_by: user
  approved_at: YYYY-MM-DD

Use the actual current date. Do not fabricate a time or identity beyond the
fact that the user explicitly invoked this approval command.

Ensure the file contains the entire final plan, not a summary or a diff.

## 5. Update task status

Update the current task's `task.md`:
- Set `status: implementation`.
- Update the `updated` date.
- Record that the technical plan has been approved, if the task format has an
  appropriate field.

Do not change the business goal or acceptance criteria unless the user
explicitly requested and approved those changes.

## 6. Verify the changes

After writing:
- Read both files back.
- Confirm `plan.md` contains the complete final plan and approval status.
- Confirm `task.md` has status `implementation`.
- Confirm no unrelated files were changed.

If verification fails, report the failure honestly and do not claim success.

## 7. Final response

Report:
- Task ID and title.
- Whether the plan was revised based on user comments.
- Files updated.
- Final task status.
- A short summary of the approved plan.

Do not start implementation. Approval authorizes the next phase, not execution
of that phase in this command.
