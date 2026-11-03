# ADR 0004: Review loop convergence — severity gate, dispositions, and material plan changes

- Status: accepted
- Date: 2026-11-03
- Task: none; a workflow change applied directly at the user's request. No
  application code or tests changed.
- Motivating evidence: the review histories of TASK-003, TASK-004, and
  TASK-006.

## Context

The task workflow runs `/implement`, then `/review`, then `/implement` in fix
mode, then `/review` again, until a review is clean. In practice the loop did
not converge. TASK-004 went through eight reviews and five plan approvals on
2026-11-03 and was still `review failed`; TASK-003 needed five reviews;
TASK-006 four. From the second review of TASK-004 onward, no review found a
Critical or High issue or an unmet acceptance criterion; the task stayed
blocked on Low findings for six rounds.

The causes were in the workflow definition, not in any single run:

1. `/review` set `review failed` whenever any finding "requires a code, test,
   documentation, or plan change", which is stricter than the policy in
   `tasks/README.md` (a confirmed defect, unmet criterion, or material
   mismatch). Every Low suggestion blocked.
2. Findings had no disposition. Nothing distinguished a must-fix defect from a
   suggestion, so `/implement` treated the whole list as work, and the next
   reviewer could not tell what had been deliberately declined and re-raised
   it.
3. The reviewer received no memory of earlier rounds and re-audited the whole
   uncommitted tree every time, including other tasks' uncommitted work.
4. Fix mode fixed the cited location only. The same pattern was left in a
   sibling route or call site four times, and each omission became the next
   round's finding.
5. Each fix is new code, and new code was then asked for tests, for tests of
   those tests, for a documentation inventory of the tests, and for `plan.md`
   to mirror the ADR. Three fix-induced chains ran five to seven rounds each.
6. "Material plan change" was undefined, so every remediation round went
   through `/approve`; `plan.md` grew into a mirror of `review.md`, and the
   reviewer then demanded plan updates the implementer is not allowed to make.
7. The reviewer agent declared its shell allowlist in an undocumented
   frontmatter shape (`permissions:` as a list of `action`/`resource`/`effect`
   entries; opencode documents `permission:` as an object with a `bash`
   pattern map). The shell was denied in six of eight TASK-004 reviews, so the
   reviewer could not run `npm test` and reported code-reading speculation as
   findings.
8. No rule capped the number of rounds or said what happens when only Low
   findings remain.

## Decision

1. **Finding taxonomy.** Every finding carries `severity` (critical, high,
   medium, low), `type` (defect, ac-gap, plan-deviation, test-gap, hardening,
   docs, process), and `confidence` (confirmed, likely, speculative). A
   reviewer that could not run the validation commands may not mark anything
   `confirmed`. Identifiers are `R<round>-F<n>`.
2. **Blocking rule.** A finding blocks only when it is Critical or High; or
   Medium, confirmed, and a defect, acceptance-criterion gap, or material plan
   deviation; or a missing test for behaviour named in the approved plan's
   acceptance mapping. Low findings, non-blocking Medium findings, tests for
   tests, test inventories in documentation, and `plan.md` not mirroring an
   ADR never block.
3. **Dispositions.** `/review` gives every finding one disposition:
   `must-fix`, `follow-up`, `accepted`, or `rejected`, recorded in a
   Dispositions table in the review section. Non-blocking rows are carried
   forward so the latest table is the complete current state. `review failed`
   is set only when a `must-fix` row exists. `/verify` copies follow-ups into
   the final record; they do not block `done`.
4. **Delta re-review.** `/implement` records each round (identifiers fixed,
   sites, files changed, checks run) in `working-notes.md`. `/review` passes
   the reviewer the previous Dispositions table, the must-fix list, and the
   changed files. The reviewer re-verifies the must-fix findings at every
   affected site, reviews the changed files, does not re-raise dispositioned
   items, and tags findings in unchanged code, which block only if Critical or
   High.
5. **Fix the pattern.** In fix mode `/implement` implements must-fix rows only,
   reproduces each finding first, searches for and fixes every site with the
   same pattern (sibling handlers, call sites, matching tests), and re-runs the
   finding's evidence before returning the task to review. It does not
   implement non-blocking rows "while there".
6. **Material plan changes.** A change is material, and needs `/approve`, when
   it adds or removes user-visible behaviour, changes an API shape, data model,
   dependency, or configuration, expands scope to another task's files, or
   contradicts a recorded plan decision. Tests, error handling, hardening of
   planned behaviour, log sanitisation, documentation, and remediation inside
   the approved scope are not material and get no plan revision.
7. **Exit rule.** From the third review of the same plan revision only
   Critical and High findings block. If a third review is still
   `review failed`, `/review` reports non-convergence and the user decides
   whether to escalate the implementer model, split the work, or accept.
8. **Reviewer agent.** The frontmatter now uses the documented `permission`
   object (`edit: deny`, `bash` deny-all with allows for read-only `git`
   subcommands and the validation commands). The model is pinned to
   `openrouter/anthropic/claude-sonnet-5.5` instead of
   `openrouter/anthropic/claude-haiku-5.5`; the reviewer reports at most ten
   findings and must state when it could not run commands.
9. **Documentation.** `docs/testing.md` maps test files to areas and no
   longer enumerates test cases.
10. **Commits.** Each `/implement` round is committed (task files plus the
    files changed in the round) so a re-review can diff against the previous
    round, and a task's work is committed before the next task starts.

## Rationale

The loop was driven by the gate, not by code quality: reviews 3 to 8 of
TASK-004 would all have ended in `verification` under the blocking rule above,
with their items tracked as follow-ups. Dispositions give the implementer a
bounded work list and the reviewer a record of what was decided, which removes
the two sources of fresh findings (over-fixing and re-raising). Delta review
and pattern-complete fixing address the chains directly. Defining "material"
stops the plan from becoming a second review log. Fixing the permission schema
lets the reviewer verify instead of speculate, and the stronger model is
expected to produce fewer low-confidence findings per round; the user chose it
on 2026-11-03 knowing the price difference.

## Alternatives considered

- **Keep "any change blocks" and only cap rounds.** Rejected: the cap would
  end the loop but still spend two or three rounds on non-defects.
- **Block on any confirmed defect regardless of severity.** Rejected: a
  confirmed Low defect in fix-round code (such as R3-F3 in TASK-004) still
  costs a full round; recording it as a follow-up is cheaper and loses
  nothing, since the follow-up list survives into `/verify`.
- **A separate `fixer` subagent.** Rejected for now: the missing behaviour is a
  checklist, not a different agent. The checklist lives in `/implement` fix
  mode; a subagent can be added later if fix rounds should run on a different
  model.
- **Keep the Haiku reviewer.** Rejected by the user; the rule changes make the
  workflow robust to a weaker reviewer, but the per-round noise was judged
  worth the cost to remove.

## Consequences

- Low and non-blocking Medium findings no longer block a task. Some real but
  minor defects will reach `done` as follow-ups; the Follow-ups list in the
  verification record is the place to open a task for them.
- Review cost per token rises from $0.10 / $0.50 to $2.00 / $10.00 per 1M
  (OpenRouter catalog, 2026-11-03). Fewer rounds are expected to offset part
  of this; measure it on the next tasks.
- Tasks currently in `review failed` (TASK-004, TASK-006) have reviews
  recorded without a Dispositions table. `/implement` treats the findings
  their Outcome paragraph names as `must-fix` and the rest as `follow-up`;
  the next `/review` records the first Dispositions table.
- The first `/review` run after this change also verifies that the pinned
  model id is accepted by OpenRouter and that the reviewer can run `npm test`.
  If either fails, the run reports it rather than silently falling back.
- `AGENTS.md`, `tasks/README.md`, the `/review`, `/implement`, `/verify`, and
  `/approve` commands, and the `review` agent were updated together; keep them
  aligned when any one of them changes.
