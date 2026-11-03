# Review: User accounts schema, roles, and bootstrap admin migration

Review status: completed (independent review, 2026-10-27)

- Reviewer: independent review agent (read-only; shell denied in that session,
  so findings come from reading files; implementer's recorded runs were not
  reproduced).
- Reviewed revision: approved plan `draft-1`; implementation for status
  `review` (first review).

## Summary

No critical or high findings. Eight findings, labelled F3-1–F3-8. Four are
Medium (a seed correctness gap, a hardcoded fallback credential, a destructive
reset without a guard, and material plan deviations not recorded). Four are
Low (test gaps, an undeclared dependency, personal data in an artifact, and
hardening notes).

Confirmed: the schema and role enum match the plan, and the integration tests
cover the enum and the happy-path seed. However, F3-1 means AC4 (exactly one
admin) is not guaranteed for all inputs, and F3-2 conflicts with AGENTS.md §4
("Never hardcode credentials"), so the task must not move to verification yet.

## Findings

### F3-1 — [Medium] Seed reports success when it creates no admin
- File: `src/db/migrate.ts`, `seedFirstAdmin` (the insert using
  `.onConflictDoNothing({ target: users.email })`).
- Problem: if a `users` row already exists for `ADMIN_EMAIL` with role `user`,
  the insert is silently skipped, but the code still logs "Seeded the first
  admin" and exits 0. AC4 (exactly one `admin`) then fails with no signal.
- Reproduction: pre-create `users(ADMIN_EMAIL, role='user')`, run
  `npm run db:migrate`, then `select count(*) from users where role='admin'`
  → 0 while output claims success.
- Fix: use `.returning({ id: users.id })`; if no row is returned, throw a clear
  error. Do not silently promote an existing user. Add a conflicting-email test.

### F3-2 — [Medium] Hardcoded fallback credential
- File: `src/db/url.ts` (`?? "educator_local_pw"`).
- Problem: if `POSTGRES_PASSWORD` is unset, the app connects with a committed
  password instead of failing — violates AGENTS.md §4 and the plan constraint.
- Fix: throw when `POSTGRES_PASSWORD` (and the other required `POSTGRES_*`
  values) is unset. Keep the placeholder only in `.env.example`/`compose.yaml`
  (TASK-001). Add a unit test for `databaseUrl()`.

### F3-3 — [Medium] `db:reset` is destructive without a target guard
- File: `src/db/reset.ts` (drops `public` and `drizzle` schemas).
- Problem: it drops schemas on whatever database `POSTGRES_*` points to, with no
  confirmation or host check.
- Fix: refuse unless the host is loopback (or require an explicit confirmation
  flag/env var); document the guard.

### F3-4 — [Medium] Material plan deviations not recorded in `plan.md`
- Files: `plan.md` (approval still `draft-1`); `working-notes.md`.
- Problem: `DATABASE_URL` support and its `.env.example` entry were removed, and
  `tsx` added, recorded only in working notes. AGENTS.md §2 requires renewed
  approval with the approver/revision in `plan.md`.
- Fix: record the deviations as a plan revision with approval, or revert.

### F3-5 — [Low] Test gaps
- No conflicting-email seed test (F3-1); no `databaseUrl()` test (F3-2);
  `reset.ts`/rollback (AC5) rely on manual evidence only; the DB integration
  suite silently skips when Postgres is unreachable (a skip is not a pass).

### F3-6 — [Low] Undeclared dependency
- `@next/env` is imported directly (`src/db/index.ts`, `src/db/migrate.ts`,
  `src/db/reset.ts`, `drizzle.config.ts`) but is only a transitive dependency of
  `next`. Declare it or stop importing it directly.

### F3-7 — [Low] Personal data in a committed artifact
- `working-notes.md` records the real local `ADMIN_EMAIL`. Redact to a
  placeholder.

### F3-8 — [Low] Hardening notes
- `verifyPassword` trusts stored N/r/p without bounds; the `server-only` guard
  for `src/db` is not implemented; `npm audit` reports 4 moderate transitive
  issues (deferred).

## Severity and file locations

- F3-1 Medium — `src/db/migrate.ts`.
- F3-2 Medium — `src/db/url.ts`.
- F3-3 Medium — `src/db/reset.ts`.
- F3-4 Medium — `plan.md`; `working-notes.md`.
- F3-5 Low — tests.
- F3-6 Low — `@next/env` imports.
- F3-7 Low — `working-notes.md`.
- F3-8 Low — `src/lib/password.ts`; `src/db/*`; dependencies.

## Acceptance criteria evidence (from the review)

- AC1, AC2, AC5: implementer's manual runs recorded in working notes; not
  reproduced by the reviewer.
- AC3: covered by `schema.test.ts` (enum restricted to `user`/`admin`).
- AC4: covered by `schema.test.ts` for the happy path, but **F3-1** breaks the
  guarantee for a conflicting-email input.
- AC6: **F3-2** (fallback credential) and **F3-7** (recorded email) conflict.

## Recommended fixes

1. F3-1 — check `.returning()`, throw if no admin row was created; add a test.
2. F3-2 — require `POSTGRES_PASSWORD` (etc.) and fail otherwise; unit-test
   `databaseUrl()`.
3. F3-3 — guard `db:reset` to loopback / explicit confirmation.
4. F3-4 — record the deviations as an approved plan revision (or revert).
5. F3-5–F3-8 — add the missing tests, declare/route `@next/env`, redact the
   recorded email, and address the hardening notes.

## Final review outcome

`review failed`. No critical/high defects, but F3-1 leaves AC4 unguaranteed,
F3-2 breaks the "no hardcoded credentials" constraint, and F3-4 requires a
recorded plan revision. Implementation must resume to address F3-1–F3-4 (with
the associated tests), then return to `review`.

## Checks executed

- Reviewer: none (shell denied).
- Not reproduced: `format:check`, `lint`, `test`, `build`, `db:*` — recorded as
  passing by the implementation; to be re-run at verification.

## Second review (2026-10-27, plan draft-2)

Second independent review of TASK-003 (read-only; shell denied). No critical or
high findings. It confirmed F3-1, F3-2, F3-3, and F3-6 are fixed, but raised two
Medium and five Low findings (F-A–F-G). `review failed` remains.

### F-A — [Medium] Seed env-requirement relaxation not recorded in `plan.md`
- Files: `src/db/migrate.ts` (`seedFirstAdmin`); `plan.md`.
- Problem: the plan says the seed fails if `ADMIN_EMAIL`/`ADMIN_PASSWORD` are
  missing, but the code only requires them when no admin exists. The relaxation
  is recorded only in `working-notes.md`, not as a plan revision (AGENTS.md §2).
  `plan.md` also still mentions the removed `DATABASE_URL` entry in one place.
- Fix: record a `draft-3` revision approving the relaxation (with the stale text
  corrected), or restore fail-fast behaviour.

### F-B — [Medium] `ALLOW_DESTRUCTIVE_DB_RESET` guard undocumented and untested
- File: `src/db/reset.ts`.
- Problem: the override is referenced nowhere except `reset.ts` and working
  notes; no automated test covers the guard.
- Fix: document the override (`.env.example`, `docs/local-database.md` or
  `docs/testing.md`, README) and add unit tests (loopback allowed, non-loopback
  refused, override accepted); extracting `assertResetAllowed` eases testing.

### F-C — [Low] `verifyPassword` can throw instead of returning `false`
- File: `src/lib/password.ts`.
- Problem: Node's default `maxmem` (32 MiB) is exceeded by in-bounds `N` values
  (e.g. `N=65536, r=8`), so `scrypt` rejects and `verifyPassword` rejects rather
  than returning `false`.
- Fix: catch derivation errors and return `false`, and/or pass a `maxmem` sized
  to the bounds; add a test for an in-bounds-but-too-large `N`.

### F-D — [Low] DB tests run under jsdom and fail hard without `POSTGRES_PASSWORD`
- Files: `vitest.config.mts`; `src/db/schema.test.ts`.
- Problem: `schema.test.ts` fails at import (via `./migrate` → `./index` calling
  `databaseUrl()`) when no `.env` is present, instead of skipping; DB tests also
  run in the jsdom environment.
- Fix: add `// @vitest-environment node` to the DB/password tests and document
  that the DB suite needs `POSTGRES_PASSWORD` (or skip explicitly).

### F-E — [Low] `drizzle.config.ts` needs the password for `db:generate`
- `db:generate` does not connect, but the config calls `databaseUrl()` at load.
- Fix: allow generate without a password, or use a placeholder URL for generate.

### F-F — [Low] Schema tests depend on execution order
- `schema.test.ts` conflict/no-admin tests rely on prior state; reset state per
  test or use distinct emails.

### F-G — [Low] AC5 rollback and AC2 fresh-DB steps only partly documented
- The ADR/README document reset but not the `docker compose down -v` + `up -d`
  fresh-DB path or the optional down SQL. Consistent with the plan's wording, so
  not a defect by itself; the reviewer suggests adding it.

## Second-review outcome

`review failed`. F-A needs a user decision (or revert); F-B requires docs and
tests; F-C/F-D are correctness/hardening fixes. After those, return to `review`.
The implementer's recorded checks were not reproduced here and belong to
verification.

## Review 3 (2026-10-28, plan draft-3)

- Reviewer: `review` subagent (read-only)
- Commands run by the reviewer: none. Every shell call was denied
  (`permission.rejected`), including `git status`/`git diff`/`git ls-files` and
  `npm test`, `npm run lint`, `npm run format:check`, `npm run build`. Findings
  come from reading files only; the implementer's recorded results are not
  reproduced by this review.
- Summary: No critical or high findings. All previously recorded findings
  (F3-1–F3-8, F-A–F-G) are resolved or explicitly deferred. Seven new Low
  findings were raised (R3-1–R3-7), covering a test that does not guard the
  hash-verification fix, config edge cases, a credential-shaped placeholder, a
  non-atomic admin seed, loose scrypt bounds, a stale plan file table, and a
  test that creates a database without a loopback guard. None of them breaks an
  acceptance criterion on the current code path, but R3-1, R3-2, and R3-6
  identify changes that the reviewer considers warranted.

### R3-1 — [Low] Test does not guard the `maxmem` sizing fix
- File: `src/lib/password.test.ts`, "returns false (does not throw) for
  in-bounds parameters above the default maxmem" (~lines 46–53).
- Problem: the test rewrites `N` from 16384 to 32768 on a hash derived with
  16384, so the derived key never matches and `false` is returned regardless of
  `maxmem`. The `catch` in `password.ts` alone satisfies the assertion.
- Evidence: removing `maxmem` from the options still passes the test, so the
  F-C fix ("valid hashes above the default `maxmem` still verify") is untested.
- Fix: generate a hash with `N=32768` (via a helper accepting parameters) and
  assert `verifyPassword` returns `true`; keep the wrong-password `false` case.

### R3-2 — [Low] `databaseUrl()` mishandles empty and IPv6 hosts
- File: `src/db/url.ts:17-24`.
- Problem: `??` does not treat empty strings as unset, so `POSTGRES_HOST=`
  yields `@:5432/…`; an IPv6 host such as `::1` is inserted without brackets,
  yielding `@::1:5432`, not a valid URL authority. `reset-guard.ts` accepts
  `::1` as loopback, so the guard allows a host the URL builder cannot express.
- Evidence: set `POSTGRES_HOST=` or `POSTGRES_HOST=::1` and call
  `databaseUrl()`; the returned URL is malformed.
- Fix: use `||` for defaults, bracket IPv6 hosts, and add `url.test.ts` cases
  for empty and IPv6 values.

### R3-3 — [Low] Credential-shaped placeholder committed in `drizzle.config.ts`
- File: `drizzle.config.ts:14-19`.
- Problem: the fallback `postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder`
  is a credential-shaped string committed in code. It is not used to connect,
  but AC6 and AGENTS.md §4 discourage hardcoded credentials.
- Fix: use a URL without credentials (e.g. `postgresql://127.0.0.1:5432/educator`)
  since `drizzle-kit generate` does not connect, and re-run `npm run db:generate`.

### R3-4 — [Low] Admin seed check-then-insert is not atomic
- File: `src/db/migrate.ts:34-74` (`seedFirstAdmin`).
- Problem: the admin-exists check and the insert are not atomic. Two concurrent
  `db:migrate` runs on a fresh database can both pass the check; with the same
  `ADMIN_EMAIL` the second insert conflicts and throws "exists but is not an
  admin", misreporting a just-created admin. With different emails, two admins
  are created, violating AC4, and no database constraint prevents it.
- Evidence: on a fresh database, start two `npm run db:migrate` processes in
  parallel with different `ADMIN_EMAIL` values.
- Fix: wrap the check and insert in a transaction guarded by
  `pg_advisory_xact_lock` and re-check inside it. A partial unique index on
  `role` where `role='admin'` would enforce this at the database level but is a
  schema change needing renewed plan approval.

### R3-5 — [Low] scrypt verification bounds looser than implied memory
- File: `src/lib/password.ts:18-21, 91-104`.
- Problem: the upper bounds allow about `128·N·r` bytes of memory (at
  `N=2^20, r=32` that is ~4 GiB per verify), and `expected.length` is used as
  `keylen` without an upper bound. Stored hashes are server-written, so this
  needs DB tampering to trigger.
- Fix: cap the memory budget (e.g. `128·N·r ≤ 256 MiB`) and bound `keylen` to
  `KEY_LENGTH`.

### R3-6 — [Low] Plan file table out of date
- File: `tasks/TASK-003-user-accounts-schema-and-roles/plan.md:96-112`.
- Problem: the "Files and modules to change" table omits modules that now exist:
  `src/db/url.ts`, `src/db/reset.ts`, `src/db/reset-guard.ts`,
  `src/db/url.test.ts`, `src/db/reset-guard.test.ts`, `docs/local-database.md`,
  and `.prettierignore`. The behavior is covered by the draft-2/draft-3
  narrative, but the file list is incomplete (same class as F3-4).
- Fix: record the file additions as an approved revision, or update the table
  with the user's confirmation. Do not change the status from this review.

### R3-7 — [Low] Integration test creates/drops a database without a loopback guard
- File: `src/db/schema.test.ts:38-54`.
- Problem: the suite creates and drops a database on whatever `POSTGRES_HOST`
  points to, with no loopback check, whereas `db:reset` has one (F3-3). The test
  drops only its own random database, so the risk is low.
- Fix: skip unless the host is loopback, apply the same guard, or document the
  behavior.

### Acceptance criteria notes
- AC1: partly covered — `schema.test.ts` runs `runMigrations` on a throwaway
  DB, but the suite skips without `POSTGRES_PASSWORD`/a reachable DB; the
  recorded pass is the implementer's, not reproduced here.
- AC2: partly covered — the `down -v` / `up -d` / `db:migrate` path is
  documented in `local-database.md`; only `db:reset` is recorded as executed.
- AC3: covered — the enum is in `drizzle/0000_gorgeous_synch.sql`
  (`CREATE TYPE "public"."role" AS ENUM('user','admin')`); `schema.test.ts`
  asserts `enum_range` and rejects an invalid role.
- AC4: covered for the sequential happy path and the conflict case; concurrency
  can violate it (R3-4) and no database constraint enforces it.
- AC5: partly covered — reset/reapply are documented and `db:reset` was
  recorded as executed; optional down SQL was not written (the plan allowed it).
- AC6: mostly covered — the admin secret comes only from env and `.env*` is
  git-ignored; the committed `educator_local_pw` default predates this task and
  F3-2 accepted it as a placeholder. R3-3 is the one new credential-shaped
  string in this task's code. `.env` untracked status could not be confirmed
  (`git ls-files` denied).

### Outcome
`review failed`. No critical or high findings, and all F3-*/F-A–F-G findings are
resolved or deliberately deferred, but R3-1 (a test that does not guard its
fix), R3-2 (a reproduced malformed-URL defect), and R3-6 (a plan file list that
is out of date) each identify a code/test/documentation change that is
warranted. Implementation must address these (and should consider R3-3–R3-5 and
R3-7), then return to `review`.

## Review 4 (2026-10-28, plan draft-3)

- Reviewer: `review` subagent (read-only)
- Commands run by the reviewer: none. The shell and execute tools were denied,
  so `npm test`, `npm run lint`, `npm run format:check`, `npm run build`,
  `npm run db:generate`, and all `git` inspection commands were not run.
  Findings come from reading files; execution results remain unverified by this
  review.
- Summary: No critical or high findings. All R3-1–R3-7 items are addressed in
  the code and docs, and the earlier F3-*/F-A–F-G findings remain resolved. Five
  new Low findings were raised (R4-1–R4-5): environment leakage in the URL
  tests, inaccurate/silent skip messaging, a bracketed-IPv6 host inconsistency
  between `url.ts` and `reset-guard.ts`, missing tests for the advisory-lock
  seed / relaxed-seed branch / scrypt memory cap, and post-approval changes not
  recorded in the plan's approval record.

### R4-1 — [Low] URL tests can inherit environment values from other tests
- File: `src/db/url.test.ts` (IPv6 and defaults tests, ~lines 42–59).
- Problem: the IPv6 test expects `educator:pw@[::1]:5432/educator` but does not
  clear `POSTGRES_USER`, `POSTGRES_PORT`, or `POSTGRES_DB`. The file snapshots
  `process.env` as already populated by the worker; `schema.test.ts` loads
  `.env`, so a shared worker can carry values (e.g. `POSTGRES_PORT=5433` from
  `local-database.md`) into this test.
- Evidence: with `POSTGRES_PORT=5433` in `.env` and a shared worker, the IPv6
  assertion expecting `:5432` fails. (Reasoned, not executed.)
- Fix: in `beforeEach`, delete `POSTGRES_USER`, `POSTGRES_HOST`,
  `POSTGRES_PORT`, and `POSTGRES_DB`, then set only what each case needs.

### R4-2 — [Low] Skip messaging is silent and the docs overstate it
- File: `src/db/schema.test.ts` (header ~16–22; every `ctx.skip()`);
  `docs/testing.md` ~80–83.
- Problem: the header and `docs/testing.md` say each test is skipped with a
  clear message, but `ctx.skip()` is called with no message and the `beforeAll`
  early-return branches (missing `POSTGRES_PASSWORD`, unreachable DB,
  non-loopback host) log nothing. Skipped runs are silent, and the docs are
  inaccurate.
- Fix: pass a reason to `ctx.skip("…")` or log a `console.warn` per early-return
  branch, and keep the docs in step.

### R4-3 — [Low] Bracketed IPv6 host is accepted by `url.ts` but not `reset-guard.ts`
- File: `src/db/reset-guard.ts:1` (`isLoopbackHost`) vs `src/db/url.ts`
  (`normalizeHost`).
- Problem: `url.ts` keeps an already-bracketed `[::1]` as-is, but
  `isLoopbackHost("[::1]")` returns `false` because the set holds `::1`. So
  `POSTGRES_HOST=[::1]` builds a valid URL yet `db:reset` refuses it (and the
  schema suite skips) unless the override is set. Conservative, not unsafe.
- Evidence: `assertResetAllowed({ POSTGRES_HOST: "[::1]" })` throws "not
  loopback".
- Fix: strip one pair of surrounding brackets in `isLoopbackHost` before the
  lookup, and add a `[::1]` case to `reset-guard.test.ts`.

### R4-4 — [Low] Missing tests for the advisory-lock seed, relaxed seed, and scrypt caps
- Files: `src/db/schema.test.ts`; `src/lib/password.test.ts`.
- Problem: three behavior changes have no test, though `docs/testing.md` expects
  tests for behavior changes:
  1. R3-4 advisory-lock seed (`migrate.ts` 45–84) — no concurrency test;
     removing the lock would not be caught.
  2. draft-3 relaxed seed (`migrate.ts` 54–57) — "admin already exists and
     `ADMIN_*` are unset → resolves" is untested; only "no admin and env
     missing" is covered.
  3. R3-5 caps (`password.ts` 121–135) — the `MAX_MEMORY` rejection and the
     `expected.length > KEY_LENGTH` rejection have no test.
- Evidence: removing `pg_advisory_xact_lock` leaves all existing tests passing
  because they seed sequentially.
- Fix: (a) run two concurrent `seedFirstAdmin` calls via `Promise.allSettled`
  with different emails and assert exactly one admin; (b) after an admin exists,
  assert `seedFirstAdmin(testDb, {})` resolves; (c) add a `verifyPassword` case
  with an oversized stored `N`/`r` asserting `false`.

### R4-5 — [Low] Post-approval changes not recorded in the plan approval record
- File: `tasks/TASK-003-user-accounts-schema-and-roles/plan.md` (approval record
  and revision history, ~5–34) and `working-notes.md`.
- Problem: `plan.md` still records only draft-3. Three post-approval changes are
  not recorded there: (a) the R3-6 file-table edit, made without the user
  confirmation the review suggested; (b) the advisory-lock transaction in
  `seedFirstAdmin` (R3-4), where plan step 6 says only "inserts the admin if
  absent"; (c) the 256 MiB verification memory cap (R3-5). AGENTS.md §2
  requires renewed approval for material plan changes. These appear
  non-material, but the decision is not recorded either way.
- Fix: record (a)–(c) as a draft-4 revision for the user to approve, or record
  in `plan.md` why they are not material. (R3-6 asked for either an approved
  revision or the user's confirmation; neither was obtained.)

### Acceptance criteria notes
- AC1: not assessed — the migration SQL and `schema.test.ts` exist, but the
  suite was not executed (shell denied); rests on the implementer's recorded
  run.
- AC2: not assessed — `down -v` / `up -d` / `db:migrate` are documented in
  `docs/local-database.md` but not executed here.
- AC3: covered by reading — `drizzle/0000_gorgeous_synch.sql` creates the
  `role` enum (`user`,`admin`) and `users` table; `schema.test.ts` asserts
  `enum_range` and rejects `superuser`. Pass status not verified by execution.
- AC4: partly covered — sequential happy path and conflict case covered by
  reading; the advisory lock is correct by reasoning but has no test (R4-4) and
  was not executed.
- AC5: partly covered — reset/reapply documented and `db:reset` drops the
  `drizzle` schema; no down SQL (plan allows that); execution not verified.
- AC6: covered by reading — code throws without `POSTGRES_PASSWORD` /
  `ADMIN_*`; `drizzle.config.ts` has no credentials; `.env.example` holds only
  the TASK-001 placeholder accepted by F3-2. `.env` untracked status not
  confirmed (`git ls-files` denied).

### Outcome
`review failed`. No critical or high findings, but R4-1 (test isolation), R4-2
(test/doc skip messaging), R4-3 (host-normalization inconsistency), R4-4
(missing tests for behavior changes), and R4-5 (post-approval plan changes not
recorded / not approved) each identify changes that are warranted. R4-5 in
particular needs a user decision: record the changes as an approvable draft-4
revision, or document why they are non-material. Implementation must address
these, then return to `review`.

## Review 5 (2026-10-28, plan draft-3)

- Reviewer: `review` subagent (read-only)
- Commands run by the reviewer: none. The shell tool was denied
  (`permission.rejected`) and the execute runtime exposes no shell, so
  `npm test`, `npm run lint`, `npm run format:check`, `npm run build`,
  `npm run db:generate`, and all `git` inspection commands were not run.
  Findings come from reading files; execution results remain unverified by this
  review.
- Summary: No critical or high findings. The R4-1–R4-4 fixes are present and
  sound by reading, and R4-5 is addressed by the plan's justification section
  (with a residual process note). The earlier F3-*, F-A–F-G, and R3-* fixes
  remain in place. Five new Low findings were raised (R5-1–R5-5): `hashPassword`
  accepts out-of-bounds parameters, a misconfigured password is reported as an
  unreachable database, one cap test exercises the helper rather than
  `verifyPassword`, the ADR/`.env.example` still say `ADMIN_*` are always
  required, and the materiality of the advisory-lock change is self-assessed.

### R5-1 — [Low] `hashPassword` can produce hashes that `verifyPassword` always rejects
- File: `src/lib/password.ts`, `hashPassword` (~66–87) vs `parseStoredHash`
  bounds (~142–168).
- Problem: `hashPassword` accepts any `ScryptParameters` without applying the
  bounds `verifyPassword` enforces (`MIN_N`, `MAX_N`, `MAX_R`, `MAX_P`, and the
  256 MiB cap). `hashPassword("pw", { N: 1024, r: 8, p: 1 })` returns a
  valid-looking hash that `verifyPassword` always rejects; `N=2^21` can never
  verify and may exhaust memory. No current caller passes non-default
  parameters, so it is latent (TASK-004 could be exposed).
- Evidence: reason from the code paths; not executed.
- Fix: validate `parameters` in `hashPassword` with the same bounds (extract a
  shared `assertParametersInBounds`) and throw on violation; add a test that
  `hashPassword` rejects out-of-bounds `N`.

### R5-2 — [Low] Connection errors are swallowed into a misleading skip reason
- File: `src/db/schema.test.ts`, `beforeAll` (~57–65).
- Problem: the `catch {}` treats every `select 1` failure as "unreachable". An
  authentication failure from a wrong `POSTGRES_PASSWORD` therefore skips the
  suite with "local PostgreSQL is unreachable", losing the real cause.
- Evidence: set a wrong `POSTGRES_PASSWORD` and run `npm test`; the suite skips
  with a misleading reason rather than surfacing the auth error.
- Fix: include `error.message` in `skipReason`, or rethrow anything that is not
  a connection-level error (e.g. `ECONNREFUSED`).

### R5-3 — [Low] R4-4(c) test exercises the helper, not `verifyPassword`
- File: `src/lib/password.test.ts` (~58–71).
- Problem: the cap tests assert `isSupportedStoredHash(...) === false`; they do
  not assert `verifyPassword` returns `false`. If `verifyPassword` stopped
  calling `parseStoredHash` and derived directly, no test would fail, so the
  public behavior the cap protects is not asserted.
- Evidence: remove the `parseStoredHash` call from `verifyPassword`; the
  oversized-`N` and over-length-key tests still pass.
- Fix: add `await expect(verifyPassword("some-password", oversizedHash)).resolves.toBe(false)`
  and the same for the 65-byte key, keeping the helper assertions if desired.

### R5-4 — [Low] Documentation still calls `ADMIN_*` unconditionally required
- File: `.env.example:16`; `docs/decisions/0002-user-accounts-drizzle-scrypt.md`
  (~21, ~53).
- Problem: since draft-3 the variables are needed only when no admin exists, but
  `.env.example` says "required by `npm run db:migrate`" and the ADR says
  "from required … variables". This overstates the requirement for an operator
  re-running migrations on an initialized database.
- Fix: reword to "required only when no admin exists yet", matching `README.md`
  and the ADR consequences section.

### R5-5 — [Low, process] Materiality of the advisory-lock change is self-assessed
- File: `tasks/TASK-003-user-accounts-schema-and-roles/plan.md` (~287–301
  post-approval clarifications; ~208 Idempotency bullet).
- Problem: the plan's idempotency strategy names email uniqueness and
  `on conflict do nothing`; the implementation adds a transaction with
  `pg_advisory_xact_lock`. The plan records this as non-material, but the user
  has not confirmed that. AGENTS.md §2 requires renewed approval for material
  changes, and the review cannot make that call for the user.
- Fix: obtain the user's explicit confirmation at the next approval step, or
  record a draft-4 revision naming the lock as an approved part of the
  strategy, stating who judged materiality.

### Acceptance criteria notes
- AC1: not assessed — migration SQL and runner exist and are wired correctly;
  no execution possible (shell denied).
- AC2: not assessed — `down -v` / `up -d` / `db:migrate` documented in
  `docs/local-database.md`; not executed.
- AC3: covered by reading — enum and `users` table in the migration SQL;
  `schema.test.ts` asserts `enum_range` and rejects `superuser`; not executed.
- AC4: covered by reading — seed/lock logic plus sequential, conflict, relaxed,
  and concurrent tests; not executed.
- AC5: partly covered — rollback is a whole-database reset (`db:reset` or
  `down -v`), not a migration-level rollback; the plan approved this and made
  down SQL optional; not executed.
- AC6: covered by reading — `.env*` git-ignored with `!.env.example`;
  `drizzle.config.ts` credential-free; `ADMIN_*` from env only and
  `ADMIN_PASSWORD` never logged. Tracked-file status not confirmable (git
  unavailable).

### Outcome
`review failed`. No critical or high findings, but R5-1 (latent unverifiable
hash), R5-2 (misleading skip), R5-3 (cap test not asserting `verifyPassword`),
and R5-4 (stale docs) each identify changes that are warranted, and R5-5 needs
a user decision on whether the advisory-lock change is material. Implementation
must address these, then return to `review`.
