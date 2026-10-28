# Working Notes: Validation

Temporary notes about this task. Anything here is unverified unless it is
explicitly labeled as confirmed. Hypotheses and unverified assumptions are
not approved decisions, and nothing here changes the goal or acceptance
criteria in `task.md`.

## Findings

- Verified: the project had no formatter and no test framework before this
  task. Confirmed by `package.json` (scripts `dev`, `build`, `start`, `lint`
  only) and by running the new commands.
- Verified: Node.js v22.21.0 and npm 10.9.4 are in use in this environment.
- The latest `vitest` (v5) requires `@types/node` `^22 || >=24`, but the
  project pins `@types/node` `^20`. Resolved by using `vitest@^4.1` (peer
  `@types/node` `^20 || ^22 || >=24`). Chose this over upgrading `@types/node`
  to keep the change minimal.
- `npm install` hit an npm/arborist peer-resolution bug
  (`TypeError: Cannot read properties of null (reading 'edgesOut')` in
  `loadPeerSet`). Worked around with `--legacy-peer-deps`.
- Consequence of `--legacy-peer-deps`: the peer `@testing-library/dom` was not
  installed automatically, so the first test run failed with
  "Cannot find package '@testing-library/dom'". Fixed by installing
  `@testing-library/dom` explicitly.
- Prettier initially flagged 26 files, mostly hand-wrapped Markdown
  documentation, task files, and `.opencode`/`.agents` instructions. Running
  `prettier --write .` over them would have produced a large unrelated diff.
  Decision: `.prettierignore` excludes `*.md` and the agent/skill instruction
  directories, so Prettier formats code/config only.
- `compose.yaml` (from TASK-001) needed a whitespace-only reformat of its
  `healthcheck.test` array to satisfy `format:check`. Applied; YAML semantics
  are unchanged.
- Vite warned that `vitest.config.ts` was loaded as CommonJS while using ESM
  syntax. Renamed to `vitest.config.mts` to remove the warning (the plan named
  `.ts`; this is a minor, non-material deviation).

## Changes made (implementation)

- Added devDependencies: `prettier`, `eslint-config-prettier`, `vitest@^4.1`,
  `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`,
  `@testing-library/jest-dom`, `@testing-library/dom`.
- Added `.prettierrc.json`, `.prettierignore`.
- Appended `eslint-config-prettier/flat` (last) in `eslint.config.mjs`.
- Added `vitest.config.mts` and `vitest.setup.ts`.
- Added scripts `format`, `format:check`, `test`, `test:watch` to
  `package.json`.
- Added a representative test: `src/app/page.test.tsx` (mocks `next/image`).
- Added `docs/testing.md`; added a "Validation" section to `README.md`;
  updated `docs/README.md` (tests now configured; index entry).
- Process/workflow: `AGENTS.md`, `tasks/README.md`,
  `.opencode/commands/new-task.md`, `.opencode/commands/verify.md`,
  `.opencode/agents/review.md`.

## Verification evidence (executed 2026-10-27)

Final full run after all edits:

- `npm run format:check` -> "All matched files use Prettier code style!"
- `npm run lint` -> no errors or warnings (exit 0).
- `npm test` -> 1 test file passed, 1 test passed (Vitest 4.1.12).
- `npm run build` -> "Compiled successfully", TypeScript finished, static
  pages generated (Next.js 16.4.3). One environmental warning: Turbopack
  noticed a `yarn.lock` in `/home/developer` outside this repo; unrelated to
  this task.

## Review resolution (2026-10-27, plan draft-2)

An independent review (recorded in `review.md`) found no functional defects but
flagged unapproved deviations. The user approved plan revision `draft-2`:

- F1: `.prettierignore` Markdown/instruction-dir exclusions approved; rationale
  added as comments in `.prettierignore` and recorded in `plan.md`.
- F2: install caveat documented in `docs/testing.md` ("Installing"); confirmed
  that a plain `npm install --dry-run` succeeds from the committed lockfile.
- F3: `@testing-library/dom` dependency, `compose.yaml` reformat, and the
  `vitest.config.mts` rename recorded in `plan.md`; Prettier added to the
  `docs/README.md` stack list.
- F5: reviewer wording recorded in `plan.md`.
- F6: `docs/README.md` review-agent model corrected to match
  `.opencode/agents/review.md` (`openrouter/anthropic/claude-haiku-5.5`).
- F4 (weak example test): accepted as-is; optional follow-up only.

Re-verified after the fixes (2026-10-27): `format:check`, `lint`, `test`, and
`build` all pass.

## Re-review resolution (2026-10-27, draft-2)

A second independent review (`review.md`, findings G1–G8) found no functional
defects, only artifact/documentation inconsistencies. Resolved by the parent:

- G1: `plan.md` "Approval status" updated to name `draft-2` (supersedes
  `draft-1`), with approver and date.
- G2: `plan.md` `vitest.config.ts` references updated to `vitest.config.mts`.
- G4: `docs/README.md` model table — removed "review" from the default-stage
  row and added an explicit row for the review subagent
  (`openrouter/anthropic/claude-haiku-5.5`).
- G3: `opencode.json` change is the separately-requested Context7 MCP server
  (`opencode mcp add context7 --url ...`); out of TASK-006 scope, left as-is.
- G5: `.agents/`, `.claude/`, `.grok/`, `skills-lock.json` are external skill
  bundles; out of scope, left untracked.
- G6: deferred to verification (run `npm ci` on a clean tree).
- G8: accepted as-is (optional follow-up).

No application-code changes were needed for this round.

## Third-review resolution (2026-10-27, draft-3)

The third independent review (`review.md`, findings F-A–F-F) ran with shell
access and confirmed `format:check`, `lint`, and `test` pass. Findings and the
user's decisions:

- F-A/F-B (reviewer shell permission and test-execution wording): narrowed to a
  shell allowlist in `.opencode/agents/review.md` — `shell "*"` deny, then
  allows for `git *`, `npm test *`, `npm run lint *`, `npm run format:check *`,
  and `npm run build *`. Recorded as plan revision `draft-3`. Ordering follows
  OpenCode V2 semantics (last matching rule wins; base policy otherwise allows).
- F-C (`opencode.json` Context7 MCP): kept; documented as out of TASK-006 scope
  (added at the user's separate request) in `plan.md`.
- F-D (Node version): documented the real engine requirements in
  `docs/testing.md` and corrected the plan assumption.
- F-E (clean `npm ci`): deferred to verification.
- F-F (`tasks/README.md` index not in the plan table): noted; the index update
  belonged to earlier task-creation/decomposition steps, not TASK-006's code.

No application-code changes were needed for this round.

## Decisions needed

- None blocking. Optional follow-ups (not requested, out of scope): a
  `typecheck` script, coverage reporting, CI, or pre-commit hooks.

## Experiments

- Confirmed the test runner detects and runs `src/app/page.test.tsx` via
  `include: ["src/**/*.{test,spec}.{ts,tsx}"]`.

## Useful references

- `docs/testing.md` — commands and conventions (created by this task).
- `AGENTS.md`, `tasks/README.md` — project and task lifecycle rules.
- `docs/README.md` — documented stack and decisions index.

## Knowledge to preserve

- Vitest must stay on the 4.x line while `@types/node` is pinned to `^20`.
- `--legacy-peer-deps` is currently needed for `npm install` in this
  environment (npm arbiter bug); when it is used, Testing Library's peer
  `@testing-library/dom` must be installed explicitly.
- Prettier intentionally ignores Markdown here; documentation is hand-wrapped.

## Workflow fix affecting F6-1 and F6-2 (2026-10-28)

Changed outside this task's `/implement` cycle, as part of the workflow fix
requested by the user; recorded here for the next `/review` of this task:

- F6-1: the `git *` allow rule in `.opencode/agents/review.md` was replaced by
  read-only subcommands (`git status *`, `git diff *`, `git log *`,
  `git show *`, `git blame *`, `git rev-parse *`, `git ls-files *`). The body
  text now lists the same allowlist.
- F6-2: no change needed. OpenCode v2 documents that a shell pattern ending in
  ` *` also matches the bare command, so `npm test *` matches `npm test`.
