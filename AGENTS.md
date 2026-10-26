<!-- BEGIN:nextjs-agent-rules -->
# AI Development Rules

## Documentation entry points

- `docs/README.md` — project documentation index.
- `tasks/README.md` — task lifecycle and status rules.

## 1. Source of truth
- Follow this file and relevant documentation in `docs/`.
- Inspect the existing repository before making assumptions.
- If documentation conflicts with the code, report the conflict.
- Do not invent APIs, dependencies, or project requirements.

## 2. Workflow
- Analysis and planning must not modify source code.
- For non-trivial tasks, produce a plan before implementation.
- Implement only the approved scope.
- Ask before making major architectural decisions.
- Do not silently expand the task.

## 3. Implementation
- Follow the existing architecture and conventions.
- Prefer simple, maintainable solutions.
- Avoid unnecessary dependencies.
- Handle errors explicitly.
- Never hardcode credentials, tokens, or secrets.

## 4. Testing
- Add or update tests when behavior changes.
- Run relevant checks when possible.
- Never claim that a test passed unless it was actually executed.
- Report failed or skipped checks honestly.

## 5. Review
- Inspect the final diff for unintended changes.
- Check correctness, edge cases, security, and regressions.
- Separate confirmed defects from suggestions.

## 6. Documentation
- Update relevant documentation when architecture or behavior changes.
- Record important architectural decisions in `docs/decisions/`.

## 7. Completion report
At the end of implementation, report:
1. What changed
2. Files changed
3. Tests and commands executed
4. Test results
5. Remaining risks or unfinished work


## Task management

- All development work must belong to a task in `tasks/`.
- Read `tasks/README.md` before starting work on a task.
- Each task has a business description in `task.md`.
- Technical implementation details belong in `plan.md`.
- Temporary discoveries and hypotheses belong in `working-notes.md`.
- Review findings belong in `review.md`.
- Never silently change the original business goal.
- Update the task status when a phase is completed.
- Do not start implementation until the user approves the plan.
- Do not mark a task as done until acceptance criteria and required checks pass.
- If blocked, record the reason and the decision needed.
- Record durable architectural decisions in `docs/decisions/`.
- Promote reusable project knowledge into `docs/` instead of leaving it only in working notes.


<!-- END:nextjs-agent-rules -->
