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
- `review failed`: review or verification found at least one blocking
  finding (`must-fix`; see "Review findings and dispositions")
- `done`: acceptance criteria are sufficiently verified and required checks
  passed, or any justified limitations are explicitly documented
- `blocked`: progress requires a decision, missing information, or an
  external dependency

Only epics use the `epic` status.

The current status must be recorded in `task.md` frontmatter.

### Task frontmatter

| Field | Written by | Meaning |
|---|---|---|
| `id` | `/new-task`, `/decompose --apply` | Task ID; never reused |
| `title` | `/new-task`, `/decompose --apply` | Short business title |
| `type` | `/new-task`, `/decompose` | `task` or `epic` |
| `parent` | `/decompose --apply` | Owning epic ID; omitted for standalone tasks |
| `status` | the command that owns the transition (see below) | Current status |
| `created` | `/new-task`, `/decompose --apply` | Creation date |
| `updated` | every command that changes the task | Date of the last change |
| `plan_approved` | `/approve` | Date of the latest plan approval |
| `plan_approved_by` | `/approve` | `user` |
| `plan_revision` | `/approve` | Approved revision label, equal to the label in `plan.md` (`draft-1`, `draft-2`, ...) |

Do not add other frontmatter fields. `task.md` frontmatter is the single
source of truth for a task's state: a dependency is satisfied only when the
dependency's `task.md` status is `done`, and no command may infer a different
state from `review.md`, `working-notes.md`, or the code.

### Status transitions

| Status set | Set only by | From |
|---|---|---|
| `backlog` | `/new-task`, `/decompose --apply` | — |
| `planning`, then `planned` or `blocked` | `/start-planning` | `backlog` |
| `implementation` | `/approve` | `planned`, or `blocked` during planning |
| `review` or `blocked` | `/implement` | `implementation`, `review failed` |
| `review failed` or `verification` | `/review` | `review` |
| `done`, `need verification`, or `review failed` | `/verify` | `verification` |
| `verification` (again) | the user, after resolving `need verification` | `need verification` |

`done` is set only by `/verify`, and only after a dated Verification section
with evidence for every acceptance criterion has been appended to `review.md`.
`review.md` is append-only: each review and each verification adds a dated
section and never rewrites earlier findings. A renewed plan approval
(`/approve` after a material change) does not change the status of a task in
`implementation` or `review failed`.

## Review findings and dispositions

Every finding recorded by `/review` carries three labels:

- `severity`: `critical`, `high`, `medium`, or `low`.
- `type`: `defect` (wrong behaviour), `ac-gap` (an acceptance criterion is not
  met), `plan-deviation` (a material mismatch with the approved plan),
  `test-gap` (behaviour without an automated test), `hardening` (a safe
  improvement, not a defect), `docs`, or `process`.
- `confidence`: `confirmed` (reproduced with a command or test, or
  demonstrated on the actual code path), `likely`, or `speculative` (code
  reading only). When the reviewer could not run the validation commands,
  nothing is `confirmed`.

A finding is **blocking** when it is:

- `critical` or `high`, of any type; or
- `medium`, `confirmed`, and of type `defect`, `ac-gap`, or `plan-deviation`;
  or
- a `test-gap` for behaviour named in the approved plan's acceptance mapping.

A `test-gap` on code that was added only to fix an earlier finding is not
blocking. From the third review of the same plan revision, only `critical`
and `high` findings are blocking.

`/review` gives every finding exactly one **disposition** and records it in
the Dispositions table of the review section:

- `must-fix`: blocking; `/implement` fixes it in the next round.
- `follow-up`: not blocking; listed under Follow-ups so `/verify` carries it
  into the final record and a new task can be opened for it.
- `accepted`: not blocking; the risk or behaviour is accepted, with a reason.
- `rejected`: a false positive or outside this task's scope, with evidence.

The latest Dispositions table is always the complete current state: rows that
are `accepted`, `follow-up`, or `rejected` are carried forward from one review
to the next, and the reviewer does not re-raise them. Findings are numbered
`R<round>-F<n>` so identifiers never collide across reviews.

`review failed` is set only when at least one row is `must-fix`; otherwise the
outcome is `verification`. Low findings, non-blocking medium findings, tests
for tests, documentation that enumerates tests, and `plan.md` not mirroring an
ADR never fail a review on their own.

If a third review of the same plan revision is still `review failed`, the loop
is not converging: `/review` reports the chain of fix-induced findings, and the
user decides whether to escalate the implementer model, split the remaining
work into a new task, or accept the remaining findings.

## Material plan changes

A change is **material**, and needs renewed approval through `/approve`, when
it adds or removes user-visible behaviour; changes an API shape, the data
model, a dependency, or configuration; expands the scope to files owned by
another task; or contradicts a decision recorded in the approved plan.

A change is **not material** when it stays inside the approved scope: adding
or correcting tests, error handling, hardening of planned behaviour, log
sanitisation, documentation, and any fix of a `must-fix` finding that does not
meet the definition above. Non-material changes do not get a plan revision;
the review Dispositions table, `working-notes.md`, and ADRs are the record. A
reviewer must not report "plan not updated" for them.

## Commits

Commit a task's work at the end of each `/implement` round, staging only the
files changed in that round and the task directory, with a message such as
`TASK-004: implement` or `TASK-004: review-fix round 3`. This lets a re-review
diff against the previous round instead of re-auditing the whole task, and
keeps one task's uncommitted files out of another task's review. Commit a
task's remaining work before starting the next task.

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

| Phase | Command | Produces | Writes task files |
|---|---|---|---|
| Create task | `/new-task` | Business description and initial status | Yes |
| Decompose | `/decompose` | Proposed child tasks and dependencies | Proposal only until approval |
| Apply decomposition | `/decompose --apply` | Child task files, epic relationships, updated task index | Yes |
| Plan | `/start-planning` | `plan.md`, `working-notes.md`, status `planned` or `blocked` | Yes, inside the task directory |
| Approve | `/approve` | Recorded user approval and revision label in `plan.md` | Yes |
| Implement | `/implement` | Code, tests, `working-notes.md` | Yes |
| Review | `/review`, through the read-only `review` subagent | Independent findings with severity, type, and confidence | Must not modify application code |
| Record review | `/review` | Findings, dispositions, and follow-ups appended to `review.md`; status `review failed` or `verification` | Yes |
| Verify | `/verify` | Per-criterion verification evidence appended to `review.md`; final status | Yes |
| Resolve human verification | the user (with agent help if asked), then `/verify` again | Recorded result of the required manual check or decision | Yes |
| Complete epic | no command yet; done manually against the epic completion criteria | Evidence that child tasks and epic-level criteria are complete | Yes |

## Workflow for normal tasks

1. `/new-task` creates the business task with status `backlog`.
2. `/start-planning` analyzes the task and prepares a technical plan
   (`draft-1`).
3. `/start-planning` sets status to `planned` or `blocked`.
4. `/approve` records explicit user approval in `plan.md`, including the
   approver and the exact approved plan revision, and copies the revision
   label into `task.md`.
5. `/approve` sets status to `implementation`.
6. `/implement` implements the approved plan and adds or updates tests.
7. `/implement` sets status to `review`.
8. `/review` runs the independent `review` subagent, gives every finding a
   disposition, and appends findings and dispositions to `review.md`.
9. If any finding is `must-fix`, `/review` sets status to `review failed`.
10. `/implement` fixes the `must-fix` findings only, at every site where the
    same pattern occurs, without expanding the approved scope, and records the
    round (identifiers, sites, files changed, checks) in `working-notes.md`.
    A material plan change needs `/approve` first; the status stays
    `review failed`. Non-material remediation needs no new plan revision.
11. After the fixes, `/implement` sets status to `review`; repeat `/review`,
    which re-verifies the `must-fix` findings and reviews the changed files.
12. When no finding is `must-fix`, `/review` sets status to `verification`.
13. `/verify` runs the relevant tests and quality checks and appends evidence
    for each acceptance criterion to `review.md`. All tests must pass before
    the task can be considered complete.
14. `/verify` sets status to `done`, `need verification`, or `review failed`
    according to the actual findings and remaining work.

A task in `need verification` must specify the exact human action, manual
test, or decision required. After the user records the result in `review.md`
and sets the status back to `verification`, `/verify` is run again before the
final status is decided.

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
- `done` may be set only by `/verify`; `/review` sets only `review failed`
  or `verification`.
- Planning may modify only files inside the relevant task directory and
  must not modify application source code.
- Implementation must follow the currently approved plan.
- A material plan change (see "Material plan changes") requires renewed user
  approval; non-material remediation of review findings does not.
- Independent review must not modify application source code.
- Review findings must be preserved in `review.md`; implementation must not
  silently erase or rewrite findings to make them appear resolved.
- After fixes, rerun the independent review; the re-review verifies the
  `must-fix` findings at every affected site and reviews the files changed by
  the fix round.
- Only `must-fix` findings fail a review. `follow-up` and `accepted` findings
  are recorded and do not block `done`.
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