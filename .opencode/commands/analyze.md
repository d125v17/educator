
---
description: Analyze a task and prepare an implementation plan
agent: plan
model: openrouter/deepseek/deepseek-v4.1-flash
---

Task file: $ARGUMENTS

1. Read AGENTS.md and tasks/README.md.
2. Read the specified task.md and its current status.
3. Confirm that the task is in backlog or planning.
4. Inspect relevant source code and project documentation.
5. Record discoveries and unresolved questions in working-notes.md.
6. Create or update plan.md with the technical implementation plan.
7. If critical business questions remain, record them and stop.
8. Otherwise set task.md status to planned and update its date.

Do not modify application source code.
Do not approve the plan on behalf of the user.
Stop after preparing the plan and report what requires approval.
