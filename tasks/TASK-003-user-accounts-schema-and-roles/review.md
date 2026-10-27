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
