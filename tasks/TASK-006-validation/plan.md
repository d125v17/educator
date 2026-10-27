# Technical Plan: Validation

- Status: approved
- Business goal reference: task.md
- Plan revision: draft-3 (2026-10-27)
- Approval:
  - status: approved
  - approved_by: user
  - approved_at: 2026-10-27
  - revised_at: 2026-10-27
  - revision_history:
    - draft-1 (2026-10-27): approved by user via `/approve` with no requested
      content changes. Includes the process/workflow integration requested
      during planning (see "Scope decision").
    - draft-2 (2026-10-27): renewed approval by user after independent review
      (TASK-006 review findings F1–F3, F5, F6). Changes: `.prettierignore`
      additionally excludes Markdown, the `.agents`/`.claude`/`.grok`
      instruction directories, `skills-lock.json`, and `coverage`, so Prettier
      formats code/config only; the dev dependency `@testing-library/dom` is
      approved (peer required by Testing Library v16); a whitespace-only
      reformat of `compose.yaml` is approved so `format:check` passes; the
      Vitest config file is `vitest.config.mts`; the read-only review agent
      inspects test coverage but does not execute tests; and the docs/agent
      model conflict for the review agent is corrected in `docs/README.md`.
    - draft-3 (2026-10-27): renewed approval by user after the third review
      (findings F-A–F-D). Changes: the review sub-agent keeps a narrow shell
      allowlist (git and the validation commands `npm test`, `npm run lint`,
      `npm run format:check`, `npm run build`; all other shell denied) and may
      execute the project's test command; `opencode.json` (Context7 MCP) is
      recorded as out of TASK-006 scope; and the supported Node.js versions are
      documented in `docs/testing.md`.

## Scope decision (recorded)

During planning the user added three process-level requirements beyond
formatter + tests:

1. Test creation must be part of every new task.
2. Code must pass all tests during the `/verify` process.
3. Sub-agent instructions must be updated.

The plan recommends — and this approval adopts — folding these into TASK-006
(a single "Validation" task) rather than creating a separate task, because
they are the same validation concern. These requirements touch project-process
files outside `tasks/` listed below. The alternative (a separate process task)
was considered and rejected as unnecessary fragmentation; the user approved
without objection.

## Business goal reference

See `task.md` for the business problem, desired outcome, and acceptance
criteria. This plan must not change the original business goal.

Goal: contributors can validate the project with documented, runnable
tooling — consistent formatting (Prettier) and runnable tests — and the task
workflow expects tests to be created and to pass at verification time.

## Current implementation

Verified by repository inspection (no commands executed):

- Next.js 16.4.3 (App Router), React 19.3.0, TypeScript 5, Tailwind CSS 4,
  ESLint 9 flat config (`eslint.config.mjs`).
- Package manager: npm (`package-lock.json` present).
- `package.json` scripts: `dev`, `build`, `start`, `lint` only.
- No code formatter, no test framework, no `typecheck` script, no CI.
- `eslint.config.mjs` uses `defineConfig` from `eslint/config` with
  `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
- `docs/README.md` lists `docs/testing.md` as "planned, not written".
- `AGENTS.md` §4 already says "Add or update tests when behavior changes".
- `.opencode/commands/verify.md` already reads `docs/testing.md` if present
  and requires "relevant automated checks" to pass.
- `.opencode/agents/review.md` is the single subagent (read-only reviewer);
  it already lists "Missing or inadequate tests" as something to look for.
- Not done: no `npm install`, no test run, no build run. Behavior below is
  proposed, not verified.

## Proposed solution

Dev-only tooling plus workflow integration:

1. **Prettier 3.x** with a committed config and ignore file, and
   **`eslint-config-prettier/flat`** appended last in `eslint.config.mjs` so
   ESLint no longer enforces rules that conflict with Prettier formatting.
2. **Vitest** (with `@vitejs/plugin-react`, `jsdom`,
   `@testing-library/react`, `@testing-library/jest-dom`) configured through
   `vitest.config.mts` and `vitest.setup.ts`, with one representative test so
   the test command is meaningful.
3. **npm scripts** for `format`, `format:check`, `test`, and `test:watch`.
4. **Documentation** in `docs/testing.md` and a short section in `README.md`,
   plus a `docs/README.md` stack update.
5. **Workflow integration** so every new task includes tests, `/verify`
   requires all tests to pass, and the review subagent checks test adequacy.

Rationale: Vitest is TypeScript/ESM-native, fast, and works with React and
Next.js with minimal configuration (less config burden than Jest); Prettier +
`eslint-config-prettier/flat` is the current, documented way to run
formatting and linting without conflict on ESLint 9 flat config.

## Architecture and data flow

No application behavior, data model, or runtime path changes. Tooling is
development-only:

```
npm run format        -> Prettier writes formatting across the repo
npm run format:check  -> Prettier reports unformatted files (non-zero exit)
npm run lint          -> ESLint (formatting rules disabled by eslint-config-prettier)
npm test              -> Vitest run (jsdom + React Testing Library)
/verify               -> runs the project's test command; all tests must pass
```

## Files and modules to change

| File | Change | Reason |
| --- | --- | --- |
| `package.json` | add devDeps + scripts `format`, `format:check`, `test`, `test:watch` | tooling entry points (AC1, AC2) |
| `package-lock.json` | updated by `npm install` | lockfile consistency |
| `.prettierrc.json` | new | formatting configuration |
| `.prettierignore` | new | skip build output, lockfiles, `node_modules`, Markdown, and instruction dirs (draft-2) |
| `eslint.config.mjs` | append `eslint-config-prettier/flat` last | avoid Prettier/ESLint rule conflicts (AC1) |
| `vitest.config.mts` | new | jsdom + React plugin + setup file (`.mts` avoids a Vite CJS/ESM warning, draft-2) |
| `compose.yaml` | whitespace-only reformat | required so `format:check` passes (draft-2) |
| `vitest.setup.ts` | new | `@testing-library/jest-dom` matchers |
| `src/app/page.test.tsx` (representative) | new | makes `npm test` verifiable (AC2) |
| `docs/testing.md` | new | commands and expectations (AC3) |
| `README.md` | add "Validation" section | surface commands to contributors (AC3) |
| `docs/README.md` | mark tests configured; index `testing.md` | keep docs accurate (AC3) |
| `AGENTS.md` | require tests for every new task / behavior change | process (AC6) |
| `tasks/README.md` | workflow: tests expected; `/verify` gate | process (AC6, AC7) |
| `.opencode/commands/new-task.md` | task template notes the test expectation | process (AC6) |
| `.opencode/commands/verify.md` | require all tests to pass | process (AC7) |
| `.opencode/agents/review.md` | reviewer checks tests and may run a narrow validation shell allowlist | process (AC8, draft-3) |

No files under `src/` change except the added representative test. No
application logic changes.

## Data, API, configuration, and dependency changes

- **Data/API:** none.
- **Configuration files added:** `.prettierrc.json`, `.prettierignore`,
  `vitest.config.mts`, `vitest.setup.ts`.
- **Dependencies added (dev only):**
  - `prettier`, `eslint-config-prettier`
  - `vitest`, `@vitejs/plugin-react`, `jsdom`,
    `@testing-library/react`, `@testing-library/jest-dom`,
    `@testing-library/dom` (peer required by Testing Library v16; approved in
    draft-2)
- **npm scripts added:**
  - `"format": "prettier --write ."`
  - `"format:check": "prettier --check ."`
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`
  - `"lint": "eslint"` (unchanged)
- **Not added (out of scope, not selected):** `typecheck` script, coverage,
  pre-commit hooks, CI.

## Implementation steps

1. `npm install --save-dev prettier eslint-config-prettier`
2. Create `.prettierrc.json` and `.prettierignore`.
3. Edit `eslint.config.mjs`: import `eslint-config-prettier/flat` and append it
   **last** in the `defineConfig([...])` array.
4. `npm install --save-dev vitest @vitejs/plugin-react jsdom
   @testing-library/react @testing-library/jest-dom`
5. Create `vitest.config.mts` (React plugin, `environment: "jsdom"`,
   `setupFiles: "./vitest.setup.ts"`) and `vitest.setup.ts`
   (import `@testing-library/jest-dom`).
6. Add the four new scripts to `package.json`.
7. Add one representative test (render `src/app/page.tsx` and assert a stable
   element, or a small pure-function test, whichever is more robust).
8. Run and record: `npm run format:check`, `npm run lint`, `npm test`,
   `npm run build`.
9. Create `docs/testing.md` documenting commands and expectations; add a
   "Validation" section to `README.md`; update `docs/README.md`.
10. Update process/workflow files: `AGENTS.md`, `tasks/README.md`,
    `.opencode/commands/new-task.md`, `.opencode/commands/verify.md`,
    `.opencode/agents/review.md`.
11. `git status` to confirm no secrets and only intended files changed.

## Testing strategy

- Project test command: `npm test` (Vitest, `vitest run`); developer watch
  command `npm run test:watch`.
- No existing tests exist to migrate.
- Verification for this task: `format:check` passes, `lint` passes, the
  representative test passes, and `npm run build` still succeeds.
- The representative test exists specifically so the "documented test
  command" acceptance criterion is demonstrable, not just configured.

## Security, validation, error handling, and compatibility

- No credentials or secrets are added; the new config files contain none.
- `.prettierignore` and the Vitest config must exclude build output
  (`.next`, `out`, `build`) so tooling does not touch generated files.
- `eslint-config-prettier/flat` **must be last** so it can disable conflicting
  stylistic rules; otherwise lint and formatting can disagree.
- `environment: "jsdom"` is required for component tests. React Server
  Components / async server components are not supported by React Testing
  Library; tests should target client components or pure logic.
- Compatibility: keep the existing `lint` script and ESLint 9 flat config
  working; do not change `tsconfig.json` behavior beyond what tests need.
- Failure handling: `prettier --check` and `vitest run` exit non-zero on
  failure, which makes them suitable as pass/fail gates.

## Risks and alternatives

Risks:

- Vitest/Next.js 16 integration edge cases (for example server components)
  could complicate the representative test. Mitigation: keep the example test
  minimal (client component or pure logic).
- Adding devDependencies increases install size and lockfile churn. Accepted
  as the cost of the requested tooling.
- Editing process files under `.opencode/` and `AGENTS.md` is a meta change to
  the development workflow; changes must stay minimal and consistent with
  existing wording.
- Ordering mistakes with `eslint-config-prettier/flat` would leave conflicting
  rules. Mitigation: place it last and verify with `npm run lint`.

Alternatives considered:

- **Jest + React Testing Library** — rejected; more configuration (transform/
  SWC setup) for the same result.
- **Node built-in `node:test`** — rejected; no DOM/React component testing.
- **No representative test** — rejected; the test command would be configured
  but unproven.
- **Separate process/workflow task** — rejected in favor of a single
  "Validation" task (see "Scope decision").

Rollback: remove the added config/test files, revert the doc and process
edits, remove the new scripts, and `npm uninstall` the added devDependencies.
No application behavior is affected.

## Acceptance mapping

| AC | Criterion | Implementation | Verification |
| --- | --- | --- | --- |
| 1 | Prettier set up with a documented command | `prettier` dep, `.prettierrc.json`, `.prettierignore`, `format`/`format:check` scripts, `eslint-config-prettier/flat` | `npm run format:check` |
| 2 | Test setup with a documented command | Vitest deps, `vitest.config.mts`, `vitest.setup.ts`, `test` script, representative test | `npm test` |
| 3 | Validation commands documented | `docs/testing.md`, `README.md` section, `docs/README.md` update | Read the docs |
| 4 | Existing commands still work | unchanged `lint`; no app changes | `npm run lint`, `npm run build` |
| 5 | No secrets added | config files contain none | `git status` / review of changed files |
| 6 | Tests expected for every new task | `AGENTS.md`, `tasks/README.md`, `.opencode/commands/new-task.md` | Read the updated workflow docs |
| 7 | All tests must pass at `/verify` | `.opencode/commands/verify.md`, `tasks/README.md` | Read the updated verify workflow |
| 8 | Sub-agent instructions updated | `.opencode/agents/review.md` | Read the updated reviewer instructions |

ACs 6–8 reflect the process requirements the user requested during planning;
they are recorded in `task.md` as part of this approval.

## Assumptions and unresolved questions

Assumptions (non-blocking):

- npm remains the package manager. Node.js: the tooling needs more than
  Node 20.0 — recommended Node 22.13+; `@testing-library/jest-dom@7` requires
  Node >=22, `jsdom@29` requires `^20.19 || ^22.13 || >=24`, and
  `@vitejs/plugin-react@6` requires `^20.19 || >=22.12` (see `docs/testing.md`).
- Prettier defaults are acceptable (no custom style preferences given).
- `jsdom` is used rather than `happy-dom`.
- A single representative test is enough to make the test command meaningful.
- `typecheck`, coverage, pre-commit hooks, and CI are out of scope because the
  user did not select them.

Unresolved (non-blocking):

- Whether to add a `typecheck` script later (not requested).
- Whether additional example tests should be added for other modules.

## Approval status

Approved by the user via `/approve` on 2026-10-27. The approved plan revision is
`draft-3` (see the approval record at the top of this file): `draft-1` was
approved initially, `draft-2` was approved after the first independent review
(findings F1–F3, F5, F6), and `draft-3` was approved after the third review
(findings F-A–F-D) to record the review-agent shell allowlist, the
out-of-scope `opencode.json` MCP change, and the documented Node.js versions.
`draft-3` supersedes the earlier revisions.

Note: `opencode.json` (Context7 MCP) is present in the working tree but is out
of TASK-006 scope — it was added at the user's separate request and is recorded
here only for traceability.

This approval authorizes the implementation phase. After the review-driven
fixes, the task returns to `review` for independent re-review; a `done` status
is determined by review and verification, not by this approval. This section
does not itself implement anything.
