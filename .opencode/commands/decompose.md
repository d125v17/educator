---
description: Analyze a large task and split it into approved child tasks
agent: build
---

Arguments: $ARGUMENTS

# Purpose

Decompose a large business or technical task into smaller, independently
implementable child tasks.

Preserve the original task as an epic. Never delete the original task
directory or reuse its task ID.

This command has two modes:
- PROPOSE: analyze and prepare a decomposition proposal.
- APPLY: create child tasks and convert the original task to an epic,
  but only after explicit user confirmation.

## 1. Parse arguments and determine mode

Accept:
- `/decompose TASK-001` — PROPOSE mode.
- `/decompose TASK-001 --apply` — APPLY mode.

If the task ID is missing or ambiguous, ask the user to specify it and stop.
Do not guess which task the user means.

Read:
- `AGENTS.md`
- `tasks/README.md`
- the target task's `task.md`
- the target task's `plan.md`, if it exists
- the target task's `working-notes.md`, if it exists
- relevant project documentation and source code

Inspect the existing task directory structure and task index.
Determine the next available task IDs from the repository; never assume
that IDs are consecutive or reuse an existing ID.

Do not modify application source code.

## 2. PROPOSE mode

Analyze the original task and decide whether decomposition is justified.

If the task is already small enough to implement and verify safely,
explain why decomposition is unnecessary and stop without creating tasks.

Otherwise, prepare a decomposition proposal containing:

1. The original business goal and expected overall outcome.
2. Proposed child tasks, each with:
   - proposed title and short directory slug
   - business goal
   - scope and explicit exclusions
   - acceptance criteria that can be verified
   - relevant documentation or code areas
   - dependencies on other child tasks
   - important risks and open questions
3. The recommended implementation order, taking dependencies into account.
4. Criteria for considering the epic complete.
5. Any decisions that must be resolved before decomposition can be applied.

Each child task must represent a meaningful, bounded unit of work.
Avoid arbitrary splitting by file or layer when that would create tasks
that cannot deliver a verifiable result independently.

Do not create empty placeholder tasks, duplicate tasks, or unnecessary
tasks for work already completed.

Check that:
- every part of the original goal is covered;
- child scopes do not conflict or unintentionally overlap;
- dependencies do not form cycles;
- acceptance criteria are testable;
- cross-cutting requirements are assigned to appropriate tasks or
  explicitly retained as epic-level criteria.

Persist the proposal in the original task directory as
`decomposition-plan.md`. Mark it as PROPOSED and include the source task ID.
Do not change the original task status, create child task directories,
or modify the task index in this mode.

Present the proposal to the user and ask for explicit confirmation
before applying it.

## 3. APPLY mode

Before making changes, require all of the following:

- `decomposition-plan.md` exists in the original task directory.
- The proposal is marked PROPOSED and identifies the correct source task.
- The user has explicitly confirmed applying this proposal.
- The source task still exists and has not materially changed since
  the proposal was prepared.
- The proposal covers the current source task and does not conflict
  with its existing approved plan or recorded decisions.
- All proposed child task IDs and directory names are unique.
- Dependencies are valid and acyclic.
- No required decision remains unresolved.

If the source task changed materially after the proposal was prepared,
do not apply the stale proposal. Return to PROPOSE mode and prepare
an updated proposal.

A previous request to analyze or propose decomposition is not approval
to apply it. If explicit confirmation is not available in the current
conversation context, ask the user to confirm and stop.

If the original task has an approved implementation plan, do not silently
discard or rewrite its approval record. If decomposition changes the
approved scope or design materially, explain what needs renewed approval
and stop before applying changes.

## 4. Create the child tasks

For every approved child task, create a directory using the repository's
existing naming convention:

`tasks/TASK-NNN-short-slug/`

Each child task must contain:
- `task.md`
- `plan.md`
- `working-notes.md`
- `review.md`

Use the actual templates and frontmatter conventions found in existing
tasks. Do not invent incompatible schemas.

Each child `task.md` must:
- identify the child as a normal task, not an epic;
- set status to `backlog`;
- identify the parent epic ID;
- describe the business goal, scope, exclusions, and acceptance criteria;
- record relevant dependencies and any shared constraints;
- reference the decomposition proposal and parent task.

Each child `plan.md` must not imply that its implementation plan has
already been approved. Leave it awaiting the normal planning and approval
workflow, using the repository's established conventions.

Initialize the other required files consistently with existing tasks.

Do not automatically approve child implementation plans.
Do not implement the child tasks.

## 5. Convert the original task into an epic

Preserve the original task ID and directory.

Update its `task.md` using the task schema documented in
`tasks/README.md`:
- set type to `epic`;
- set status to `epic`;
- retain the original business goal and relevant context;
- record the child task IDs and titles;
- record dependencies and the intended order of work;
- define epic-level completion criteria;
- link to `decomposition-plan.md`.

An epic is an organizational parent, not a directly implementable task.
Do not move, delete, or rename the original task directory.
Do not remove useful historical information.

If the repository's documented task schema does not yet support epic
types, epic status, parent links, or dependencies, stop before APPLY
and report the documentation changes required. Do not invent a conflicting
schema or partially apply the decomposition.

## 6. Update the task index and validate

Update `tasks/README.md` task index according to its existing format.
Keep the epic and all child task entries discoverable.

After applying:
- verify every created directory and required file;
- verify IDs and parent links;
- verify all dependency references and absence of cycles;
- verify the task index;
- verify that the epic is not marked as implementable;
- verify that all child tasks remain in `backlog`;
- inspect the final diff.

Do not report successful changes unless you have verified them.

If an error occurs during application, report exactly which changes
succeeded and which did not. Do not claim that the operation was atomic
unless it actually was.

## 7. Final report

In PROPOSE mode, report the proposed decomposition and ask for confirmation.

In APPLY mode, report:
- the epic ID and title;
- all created child task IDs and titles;
- dependencies and recommended order;
- files changed;
- validation results;
- unresolved risks or decisions.

Do not change the epic to `done` when all child tasks are created.
Epic completion is determined later using the documented epic completion
criteria and the results of its child tasks.
