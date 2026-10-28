---
description: Create a new business-oriented development task
agent: build
---

Create a new task from the following business description:

$ARGUMENTS

## Rules

Read `AGENTS.md` and `tasks/README.md` before proceeding.

This command creates a task only. It must not plan or implement
the task, modify application source code, or change project architecture.

### Step 1: Validate input

- If no meaningful business description was provided, ask the user
  to describe the desired business outcome.
- Preserve the user's intent.
- Use clear language understandable to a non-technical stakeholder.
- Do not invent requirements, acceptance criteria, or business constraints.
- If essential information is missing, record it under Open questions.
- Distinguish confirmed requirements from assumptions.

### Step 2: Allocate a unique task ID

Inspect existing task directories under `tasks/` and their task.md files.

- Find the highest existing numeric TASK ID.
- Allocate the next number using the format TASK-001, TASK-002, etc.
- Do not reuse an existing ID, even if a task is done or blocked.
- Create a concise, lowercase, hyphen-separated directory slug
  based on the business outcome.
- If the directory already exists, choose a different slug.
- Never overwrite an existing task or its files.

Expected directory format:

tasks/TASK-001-short-business-description/

### Step 3: Create the task directory and files

Create these four files. Every task that changes behavior must include
automated tests (see `docs/testing.md`); capture the test expectation in the
task's acceptance criteria.

#### task.md

Include YAML frontmatter:

---
id: TASK-NNN
title: Short business title
type: task
status: backlog
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

The frontmatter fields are documented in `tasks/README.md`. Do not add other
fields here; `/approve` adds the plan approval fields later, and only
`/decompose --apply` adds `parent`.

Then include:

# Business Task: [Title]

## Business problem
Describe the user's or business's problem.

## Desired outcome
Describe the observable result.

## User scenarios
Include relevant scenarios when supported by the input.

## Acceptance criteria
Write observable, testable outcomes.
Use TODOs or open questions rather than inventing requirements.

## Scope

### Included
List only requirements supported by the description.

### Excluded
List explicit exclusions, or state "Not specified".

## Constraints
Record known business or operational constraints.

## Open questions
List information requiring clarification.

## Links
- Technical plan: plan.md
- Working notes: working-notes.md
- Review: review.md

#### plan.md

Create a technical planning template with:

- Status: not started
- Business goal reference
- Current implementation
- Proposed solution
- Architecture and data flow
- Files and modules to change
- Data and API changes
- Implementation steps
- Testing strategy
- Security and failure handling
- Risks and alternatives
- Acceptance mapping
- Approval status: pending

Do not fill in implementation details at task creation time.
Do not claim that the repository has been inspected.

#### working-notes.md

Create sections for:

- Findings
- Hypotheses
- Decisions needed
- Experiments
- Useful references
- Knowledge to preserve

Explain that unverified assumptions must be labeled
and that temporary notes are not approved decisions.

#### review.md

Create sections for:

- Review status: not started
- Summary
- Findings
- Severity and file locations
- Recommended fixes
- Final review outcome

### Step 4: Register the task

Update `tasks/README.md` by adding a link to the new task
under the Task index section.

Preserve all existing documentation and task links.
Do not duplicate the new entry if it already exists.

### Step 5: Validate the result

Check that:

- The task ID is unique.
- All four files exist.
- The task status is backlog.
- The task notes the expectation of tests when it changes behavior.
- The business description remains business-oriented.
- The task is linked from tasks/README.md.
- No application source files were modified.

### Step 6: Report

Return:

1. The allocated task ID and title.
2. The path to the task directory.
3. The business goal and acceptance criteria.
4. Any unresolved questions.
5. Confirmation that the task is in backlog and planning has not started.

Do not start the planning phase automatically.
