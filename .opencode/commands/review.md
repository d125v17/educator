---
description: Independently review an implemented task
agent: review
---

Task file: $ARGUMENTS

Read AGENTS.md, tasks/README.md, task.md, plan.md,
and the current Git diff.

Confirm that the task is in review status.
Compare the implementation with the approved plan
and business acceptance criteria.

Do not edit application files and do not modify repository files.

Return actionable findings with file locations and severity to the parent.
A separately authorized action records the review result in review.md.

If findings require changes, recommend that implementation resume.
If no blocking findings remain, recommend moving the task to verification.

Do not change task status. Do not mark the task as done.

Report findings and the recommended next action.
