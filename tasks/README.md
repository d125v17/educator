# Task Management

## Purpose

Tasks are the source of truth for development work.
Every implementation must be linked to a task.

Large initiatives are represented by epics. Epics organize and track related
tasks but are not directly implementable.

## Task structure

Every task directory follows this structure:

- `task.md` — business requirements, task type, relationships, and current status
- `plan.md` — technical implementation plan and approval record
- `working-notes.md` — temporary findings, hypotheses, and open questions
- `review.md` — review findings and conclusions

Epic directories also contain:

- `decomposition-plan.md` — the proposed and applied task decomposition

## Task types

### Task

A normal task represents a bounded unit of work that can be planned,
implemented, reviewed, and verified independently.

A normal task uses:

```yaml
type: task
status: backlog
```

A child task must reference its parent epic:

```yaml
type: task
parent: TASK-001
status: backlog
```

The `parent` field is omitted for tasks that do not belong to an epic.

### Epic

An epic represents a larger business goal that requires multiple child tasks.

An epic uses:

```yaml
type: epic
status: epic
```

An epic must retain its original task ID and directory when an existing task
is decomposed.

An epic must contain:

- The overall business goal and expected outcome.
- Epic-level acceptance and completion criteria.
- A list of child task IDs and titles.
- Dependencies and the recommended implementation order.
- Links to the decomposition plan and relevant documentation.

An epic cannot be directly planned for implementation, implemented, reviewed,
or verified using the normal task workflow. Its child tasks go through the
normal workflow independently.

Do not mark an epic `done` merely because its child tasks have been created.

An epic may be considered complete only when all required child tasks are
`done`, all epic-level acceptance criteria are satisfied, and any required
integration or end-to-end verification has passed.

If a child task is blocked, failed, or awaiting human verification, the epic
must not be considered complete unless the relevant requirement is explicitly
removed or revised through an approved decision.

## Task statuses

Normal tasks may use these statuses:

- `backlog`: business task created; planning has not started
- `planning`: technical analysis and planning are in progress
- `planned`: plan prepared and awaiting user approval
- `implementation`: approved implementation in progress or fixes required
- `review`: implementation is ready for independent review
- `verification`: tests and quality checks are in progress
- `need verification`: automated checks and review are sufficiently complete,
  but a specific human check, decision, or manual test remains
- `review failed`: review or verification found a confirmed defect,
  unmet acceptance criterion, or material mismatch requiring changes
- `done`: acceptance criteria are sufficiently verified and required checks
  passed, or any justified limitations are explicitly documented
- `blocked`: progress requires a decision, missing information, or an
  external dependency

Only epics use the `epic` status.

The current status must be recorded in `task.md` frontmatter.

## Task relationships and dependencies

- `parent` identifies the epic that owns a child task.
- An epic maintains the authoritative list of its child task IDs.
- A task may depend on other tasks. Record dependencies using the repository's
  established task metadata or an explicit `Dependencies` section in `task.md`.
- Dependencies must reference existing task IDs.
- Dependency cycles are forbidden.
- A dependent task should not begin implementation until its blocking
  dependencies are satisfied, unless the plan explicitly identifies safe
  parallel work.
- Do not infer completion of a parent epic from a single child task.

## Ownership of each phase

| Phase | Produces | Writes task files |
|---|---|---|
| Create task | Business description and initial status | Yes |
| Decompose | Proposed child tasks and dependencies | Proposal only until approval |
| Apply decomposition | Child task files, epic relationships, updated task index | Yes |
| Plan | `plan.md`, `working-notes.md`, status `planned` or `blocked` | Yes, inside the task directory |
| Approve | Recorded user approval in `plan.md` | Yes |
| Implement | Code, tests, `working-notes.md` | Yes |
| Review | Independent findings | Must not modify application code |
| Record review | Findings in `review.md` and appropriate status | Yes |
| Verify | Per-criterion verification evidence and status | Yes |
| Resolve human verification | Recorded result of the required manual check or decision | Yes |
| Complete epic | Evidence that child tasks and epic-level criteria are complete | Yes |

## Workflow for normal tasks

1. Create the business task with status `backlog`.
2. Analyze the task and prepare a technical plan.
3. Set status to `planned` or `blocked`.
4. Record explicit user approval in `plan.md`, including the approver and
   the exact approved plan revision.
5. Set status to `implementation`.
6. Implement the approved plan and add or update tests.
7. Set status to `review`.
8. Perform independent review and record findings.
9. If defects or unmet criteria are found, set status to `review failed`.
10. Use `/implement` to fix the review findings without expanding the
    approved scope.
11. After fixes, set status to `review` and repeat independent review.
12. When review is clean, proceed to `verification`.
13. Run relevant tests and quality checks, and record evidence for each
    acceptance criterion. All tests must pass before the task can be
    considered complete.
14. Set status to `done`, `need verification`, `review failed`, or `blocked`
    according to the actual findings and remaining work.

A task in `need verification` must specify the exact human action, manual
test, or decision required. After that action is recorded, rerun any relevant
review or verification checks before deciding the final status.

## Workflow for epics

1. Create or identify the large task.
2. Run `/decompose TASK-NNN` to analyze it and prepare a decomposition proposal.
3. Review the proposed child tasks, scopes, acceptance criteria, and dependencies.
4. Explicitly approve the proposal.
5. Run `/decompose TASK-NNN --apply` to create the child tasks and convert
   the original task into an epic.
6. Plan, approve, implement, review, and verify each child task independently.
7. Track child task statuses and blockers through the epic.
8. Verify the overall epic-level acceptance criteria, including integration
   behavior where applicable.
9. Mark the epic complete only when its documented completion criteria
   are satisfied.

Do not delete the original task during decomposition. Preserve its ID,
history, and business goal.

## Rules

- Every implementation must be linked to a task.
- Do not implement tasks in `backlog`, `planning`, or `planned`.
- Do not directly implement, plan, review, or verify an epic as if it were
  a normal task.
- Business goals and acceptance criteria must be understandable and testable.
- Every new task that changes behavior must include automated tests, and all
  tests must pass at verification.
- Technical design belongs in `plan.md`.
- Hypotheses in `working-notes.md` are not approved decisions.
- Record blockers and update status at phase changes.
- Keep task directories in place; do not reuse task IDs.
- Do not mark a task `done` if required checks fail or acceptance criteria
  remain unmet.
- Do not mark a task `done` when material unresolved risks or required human
  verification remain.
- Planning may modify only files inside the relevant task directory and
  must not modify application source code.
- Implementation must follow the currently approved plan.
- A material plan change requires renewed user approval.
- Independent review must not modify application source code.
- Review findings must be preserved in `review.md`; implementation must not
  silently erase or rewrite findings to make them appear resolved.
- After fixes, rerun independent review and relevant verification checks.
- Do not claim that tests or other checks passed unless they were executed.
- Decomposition must not create child tasks before explicit user approval.
- Applying decomposition must preserve the original task and validate IDs,
  parent links, dependencies, and the task index.
- An epic is not complete until all required child tasks and epic-level
  acceptance criteria are satisfied.

## Task index

The task index lists epics and normal tasks so they remain discoverable.
Use relative links to each task's `task.md`.

Keep the index synchronized whenever tasks are created, decomposed, or
otherwise reorganized.

Example:

- [TASK-001 — User authentication epic](TASK-001-user-authentication/task.md)
- [TASK-002 — Registration](TASK-002-registration/task.md)
- [TASK-003 — Login](TASK-003-login/task.md)

### Tasks

- [TASK-002 — Authorization (epic)](TASK-002-authorization/task.md)
  - [TASK-003 — User accounts schema, roles, and bootstrap admin migration](TASK-003-user-accounts-schema-and-roles/task.md)
  - [TASK-004 — Sign-up and sign-in API endpoints](TASK-004-signup-signin-api/task.md)
  - [TASK-005 — Sign-up and sign-in UI pages](TASK-005-signup-signin-ui/task.md)
- [TASK-006 — Validation](TASK-006-validation/task.md)