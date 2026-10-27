# Review: Validation

Review status: completed (independent review, 2026-10-27)

- Reviewer: independent review agent (read-only; no shell access).
- Reviewed revision: approved plan `draft-1`; implementation for status
  `review`.
- Parent supplementary checks: `git status`/`git diff` inspected; the full
  changed-file set was confirmed (see below).

## Summary

The independent reviewer could not run shell commands, so it inspected the
planned files directly and did not execute tests or builds. It reported no
critical or high findings. It found three medium findings (F1–F3) and three
low findings (F4–F6).

No confirmed functional defect was identified. However, F1 and F3 are
deviations from the approved plan that were not recorded in `plan.md`, so
under `AGENTS.md` §2 they need a user decision or a renewed plan approval
before the task can proceed to verification.

Parent-verified facts:

- The implementation's own recorded checks passed when executed
  (`format:check`, `lint`, `test`, `build`; see `working-notes.md`). The
  reviewer did not reproduce them.
- `npm install --dry-run` (plain, without `--legacy-peer-deps`) now succeeds
  against the committed lockfile. The `--legacy-peer-deps` workaround was
  needed only while resolving the new dependencies, not for a clean install
  from the lockfile. This partially addresses F2.
- F6 is pre-existing: `git log` shows the review-agent model line predates
  this task (commit `ac780a5 updated model to review`). Not introduced here.

## Findings

### F1 — [Medium] `.prettierignore` excludes all Markdown; not in `plan.md`
- Files: `.prettierignore` (lines 13–18).
- Problem: The plan's `.prettierignore` was to cover `.next`, build output,
  lockfiles, and `node_modules`. The implementation additionally ignores
  `*.md`, `.agents`, `.claude`, `.grok`, `skills-lock.json`, and `coverage`.
  The Markdown exclusion is recorded only in `working-notes.md` and
  `docs/testing.md`, not in the approved plan.
- Why it matters: `AGENTS.md` §2 requires renewed user approval for a material
  change to an approved plan. The approval record covers `draft-1` only.
- Corrective action: get a user decision on the Markdown exclusion (approve as
  a plan revision, or narrow the ignore list back to the plan). Justify or
  remove the `.agents`/`.claude`/`.grok`/`skills-lock.json` entries.

### F2 — [Medium] Install caveat not documented (partially resolved)
- Files: `docs/testing.md`, `README.md`.
- Problem: `working-notes.md` records an npm arborist bug requiring
  `--legacy-peer-deps` and an explicit `@testing-library/dom` install; the
  docs do not mention this.
- Why it matters: AC3 / business outcome require the tooling to be usable
  "without extra guidance."
- Parent verification: a plain `npm install --dry-run` now succeeds from the
  committed lockfile, so a fresh clone using the lockfile does not hit the
  resolution bug. A short note in `docs/testing.md` (use the committed
  lockfile; if a re-resolve is ever needed, `--legacy-peer-deps` plus an
  explicit `@testing-library/dom` may be required) would close the gap.

### F3 — [Medium] Unplanned dependency and file changes
- Files: `package.json`, `compose.yaml`, `vitest.config.mts`, `docs/README.md`.
- Problem: `@testing-library/dom@^10.4.2` was added though the plan's
  dependency list omitted it; `compose.yaml` (from TASK-001) was reformatted
  (whitespace-only) though it is not in the plan's file table;
  `vitest.config.ts` was renamed to `vitest.config.mts`; `docs/README.md`
  mentions Vitest but not Prettier.
- Why it matters: `AGENTS.md` says "Do not modify unrelated files" and "Keep
  implementation consistent with the approved plan."
- Corrective action: record these deviations in `plan.md` and obtain approval
  for the added dependency (or revert the `compose.yaml` reformat if
  `format:check` can pass without it); add Prettier to the `docs/README.md`
  stack list.

### F4 — [Low] Representative test is weak
- File: `src/app/page.test.tsx`.
- Problem: asserts only the create-next-app boilerplate heading; fragile if the
  default page copy changes, and not a meaningful regression guard.
- Note: accepted by the approved plan as "makes `npm test` verifiable"; not a
  defect against the plan. Optional improvement only.

### F5 — [Low] Review-agent wording differs from the plan
- File: `.opencode/agents/review.md` (lines 52–55).
- Problem: the plan's AC mapping says the reviewer "verifies tests exist and
  pass"; the implementation says the (read-only) reviewer does not execute
  tests. Reasonable, but the discrepancy should be recorded.
- Corrective action: record the wording change in `plan.md`, or align the text.

### F6 — [Low] Pre-existing docs/code conflict (out of this task's scope)
- Files: `docs/README.md` (lines 48–49) vs `.opencode/agents/review.md`
  (line 4).
- Problem: docs say the review agent is pinned to
  `openrouter/deepseek/deepseek-v4.1-flash`; the agent pins
  `openrouter/anthropic/claude-haiku-5.5`.
- Parent verification: predates this task (`git log`). Not introduced here.
- Corrective action: resolve in a separate task (or an explicit decision);
  out of TASK-006's approved scope.

## Acceptance criteria evidence (from the review)

| AC | Result | Evidence |
| --- | --- | --- |
| 1. Prettier + format command | Met, with scope deviation (F1) | `.prettierrc.json`, `.prettierignore`, `format`/`format:check`, `eslint-config-prettier/flat` last in `eslint.config.mjs` |
| 2. Test setup + command | Met | `vitest.config.mts`, `vitest.setup.ts`, `src/app/page.test.tsx`, `test` script |
| 3. Commands documented | Met, with gap (F2) | `docs/testing.md`, `README.md`, `docs/README.md` |
| 4. Existing commands work | Not independently verified | reviewer had no shell; implementation recorded `lint`/`build` passing |
| 5. No secrets | Met by inspection | no credentials in new config/test files |
| 6. Tests expected per task | Met | `AGENTS.md` §2/§4, `tasks/README.md`, `new-task.md` |
| 7. `/verify` requires passing tests | Met | `verify.md` §1/§3 |
| 8. Review agent checks tests | Met, with wording drift (F5) | `.opencode/agents/review.md` |

All acceptance criteria are at least statically satisfied; F1/F3 are
plan-adherence issues rather than unmet business criteria.

## Severity and file locations

- F1 Medium — `.prettierignore` (13–18); `plan.md`.
- F2 Medium — `docs/testing.md`; `README.md`.
- F3 Medium — `package.json`; `compose.yaml`; `vitest.config.mts`;
  `docs/README.md`.
- F4 Low — `src/app/page.test.tsx`.
- F5 Low — `.opencode/agents/review.md` (52–55).
- F6 Low (pre-existing, out of scope) — `docs/README.md` (48–49);
  `.opencode/agents/review.md` (4).

## Recommended fixes

1. F1 — obtain a user decision on the Markdown/agent-dir exclusions, or narrow
   `.prettierignore`; record the outcome in `plan.md`.
2. F2 — add a short install note to `docs/testing.md` about the committed
   lockfile (and the `--legacy-peer-deps` + explicit `@testing-library/dom`
   fallback if a re-resolve is needed).
3. F3 — record the added `@testing-library/dom` dependency, the `compose.yaml`
   reformat, and the `.mts` rename in `plan.md` with approval; add Prettier to
   the `docs/README.md` stack list.
4. F4 — optional; leave or strengthen the representative test.
5. F5 — record the reviewer wording change in `plan.md`, or align the text.
6. F6 — handle outside this task.

## Final review outcome

No critical or high findings and no confirmed functional defect. Medium
findings F1 and F3 are unapproved deviations from the approved plan and
require a user decision or a renewed plan approval before verification.
Because these are material mismatches with the approved plan that remain
unresolved, the review outcome is `review failed`; implementation must resume
to reach an approved, plan-consistent state, after which review must be
repeated.

## Checks executed

- Parent: `git status`, `git diff` (changed-file set confirmed);
  `npm install --dry-run` (plain) succeeded; `git log` on
  `.opencode/agents/review.md`.
- Reviewer: none (no shell access).
- Not executed by the reviewer: `format:check`, `lint`, `test`, `build`
  (recorded as passing by the implementation; to be re-run at verification).

## Re-review (2026-10-27, plan draft-2)

Second independent review (read-only; no shell access) of revision `draft-2`.
Outcome: **no functional defects and no unmet acceptance criteria**; several
artifact/documentation inconsistencies were found. Findings are labelled
G1–G8 below. The parent resolved the artifact/doc findings after this
re-review; resolutions are recorded in `working-notes.md`.

### G1 — [Medium] Plan approval record was stale (`draft-1` vs `draft-2`)
- File: `plan.md`, "Approval status" section.
- Resolved: the section now names `draft-2`, the approver, and the date, and
  states that `draft-2` supersedes `draft-1`.

### G2 — [Low] Stale `vitest.config.ts` references in `plan.md`
- Resolved: all references updated to `vitest.config.mts`.

### G3 — [Medium] `opencode.json` modified but not in the plan
- Attribution verified by the parent: `git diff -- opencode.json` shows only the
  addition of the Context7 MCP server (`mcp.servers.context7`), added at the
  user's explicit request via `opencode mcp add context7 --url ...` in a
  separate step. It is not part of TASK-006's scope.
- Decision: leave as-is; documented as out of scope for this task.

### G4 — [Low] `docs/README.md` model table still listed review under the default row
- Resolved: "review" removed from the default-stage row, and an explicit row
  added for the review subagent (`openrouter/anthropic/claude-haiku-5.5`).

### G5 — [Low] Untracked `.agents/`, `.claude/`, `.grok/`, `skills-lock.json`
- Verified out of this task's change set: external skill bundles
  (`skills-lock.json` lists skills such as `next-bundle-optimizer`). Not
  modified by TASK-006; left untracked.

### G6 — [Low] `docs/testing.md` install claim not reproduced
- Deferred to verification: run `npm ci` on a clean tree and record the result.

### G7 — [Low] `review.md` must be appended, not overwritten
- This re-review is appended; the F1–F6 history above is preserved.

### G8 — [Low, no action] Representative test is weak
- Accepted as-is per the approved plan; optional follow-up only.

### Re-review outcome

The artifact/documentation findings (G1, G2, G4) were resolved by the parent
after this re-review; no application-code changes were required. G3 and G5 are
out of scope; G6 is deferred to verification; G8 needs no action. The task
returns to `review` for a further independent review, then verification
(`format:check`, `lint`, `test`, `build`, and a clean `npm ci`).

## Third review (2026-10-27, draft-2, shell-enabled reviewer)

Third independent review, now with shell access (after the user requested
`shell` permission for the review sub-agent). The reviewer executed
`npm run format:check` (passed), `npm run lint` (exit 0), and `npm test`
(1/1 passed). It did not run `npm run build` or a clean `npm ci`.

Outcome: functional tooling matches the approved plan and no secrets were
found, but the reviewer reported permission/scope deviations. Findings F-A–F-F
below.

### F-A — [High] Reviewer shell permission widened (unapproved)
- File: `.opencode/agents/review.md` (frontmatter).
- The reviewer's `shell: "*"` deny and read-only git allowlist were replaced
  with `shell: "*"` allow.
- Change was made at the user's explicit request in a separate step, not under
  TASK-006's approved plan; it weakens the reviewer's read-only guarantee to
  prompt text only.
- Status: conflicts with the approved plan; needs a user decision (revert, or
  record as an approved plan revision, optionally narrowed to a
  validation-command allowlist).

### F-B — [Medium] Reviewer test-execution wording contradicts draft-2
- Files: `.opencode/agents/review.md` (body); `plan.md` (draft-2 history).
- draft-2 says the review agent "inspects test coverage but does not execute
  tests"; the agent text now permits running tests. The plan's AC8 text also
  still says the reviewer verifies tests "exist and pass."
- Status: same decision as F-A (align text with draft-2, or renew approval).

### F-C — [Medium] Unplanned `opencode.json` MCP change
- File: `opencode.json` (Context7 remote MCP added).
- Added at the user's explicit separate request; not in the plan and not part
  of TASK-006's acceptance criteria.
- Status: pre-existing relative to TASK-006; needs a decision (revert, keep and
  record out of scope, or move to its own task).

### F-D — [Medium] Node.js version assumption inaccurate
- Files: `docs/testing.md`; `plan.md` ("Node.js 20+" assumption).
- Installed engines require more than Node 20.0: `@testing-library/jest-dom@7`
  needs Node >=22; `jsdom@29` needs `^20.19 || ^22.13 || >=24`;
  `@vitejs/plugin-react@6` needs `^20.19 || >=22.12`.
- Status: open; fix by documenting the supported Node versions in
  `docs/testing.md` (and recording the decision in `plan.md`), or pin a
  jest-dom major that supports Node 20.

### F-E — [Low] `docs/testing.md` install claim not reproduced (carry-over G6)
- Deferred to verification: run `npm ci` on a clean tree and record the result.

### F-F — [Low] `tasks/README.md` index not in the plan's file table
- The task index lists TASK-002–TASK-006. Needed, but not listed in the plan.
- `src/app/page.test.tsx` remains the accepted weak representative test (no
  action).

### Third-review recommendation

Implementation should resume. F-A and F-B are material deviations; F-C and F-D
need a revert or recorded approval. After resolution, re-review, then
verification (`format:check`, `lint`, `test`, `build`, clean `npm ci`).

## Fourth review (2026-10-27, draft-3)

Fourth independent review (read-only; shell denied in that session). Confirmed
the draft-3 items are present (narrow allowlist, `vitest.config.mts`, Markdown
excluded from Prettier, `@testing-library/dom`, Node version table). No critical
or high findings. Findings F6-1–F6-5 below.

### F6-1 — [Medium] `git *` allows mutating git commands
- File: `.opencode/agents/review.md` (permissions).
- Problem: described as "read-only git inspection", but `git *` also allows
  `git checkout`, `git reset --hard`, `git clean`, `git stash`, `git commit` —
  contradicting AGENTS.md §6 (review must not modify the repo).
- Fix: narrow to read-only subcommands (`git status*`, `git diff*`,
  `git log*`, `git show*`, `git rev-parse*`, `git ls-files*`), or record the
  broader allowlist as an approved plan revision.

### F6-2 — [Low] Bare validation commands may not match
- File: `.opencode/agents/review.md`.
- `npm test *` / `npm run build *` may not match bare `npm test` /
  `npm run lint` while the body says to run `npm test`.
- Fix: add bare-command entries alongside the wildcard entries.

### F6-3 — [Low] Out-of-scope change in the working tree
- `opencode.json` (Context7 MCP) is out of TASK-006 scope (recorded in
  `plan.md` draft-3); it must not be committed as part of this task.

### F6-4 — [Low] Verification steps still pending
- The clean `npm ci` (G6/F-E) has not been run; validation commands pass only
  per the implementer's records. Verification items, not review defects.

### F6-5 — [Low] Plan record slightly stale
- The `tasks/README.md` index change (F-F) is not in the plan file table or the
  draft-3 history; `review.md` has no re-review record after the draft-3 fixes
  (this section addresses the latter).

### Fourth-review recommendation

Resume implementation: fix F6-1 and F6-2, keep `opencode.json` out of the
TASK-006 change set (F6-3), and record the remaining plan details. Then
re-review; `npm ci` and the final checks go to verification.
