---
description: Run checks and verify task acceptance criteria
agent: build
---

Task file: $ARGUMENTS

Read AGENTS.md, tasks/README.md, task.md, plan.md,
review.md, and docs/testing.md if it exists.

Confirm that task.md status is verification.
Discover and run the actual relevant test, lint,
type-check, and build commands.

Do not claim success for checks that were not executed.

If checks fail, report the failures and return the task
to implementation when code changes are required.

If all required checks pass, summarize the evidence
for each business acceptance criterion.

Do not mark the task done until the user accepts the result.
After acceptance, update task.md status to done.
Update the task's date and summarize the verification result.