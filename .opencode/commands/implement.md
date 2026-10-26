---
description: Implement an explicitly approved task
agent: build
---

Task file: $ARGUMENTS

Read AGENTS.md, tasks/README.md, task.md, plan.md,
working-notes.md, and relevant project documentation.

Before editing:
- Confirm that task.md status is implementation.
- Confirm that plan.md contains recorded user approval, including the approver
  and an approval reference.
- Confirm that the recorded approval refers to the exact current plan revision.
- If any condition is not satisfied, stop without editing application code.
- If you must change the approved plan materially, stop and ask for renewed
  approval instead of expanding the scope.

Implement the approved plan only.
Update working-notes.md with important findings.
Add or update tests.
Run relevant checks when possible.
Inspect the final diff.

When implementation is ready for independent review,
update task.md status to review and update its date.

Report changes, test results, and remaining risks.
