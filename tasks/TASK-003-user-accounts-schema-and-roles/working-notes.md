# Working Notes: User accounts schema, roles, and bootstrap admin migration

Temporary notes about this task. Anything here is unverified unless it is
explicitly labeled as confirmed. Hypotheses and unverified assumptions are
not approved decisions, and nothing here changes the goal or acceptance
criteria in `task.md`.

## Findings

- Confirmed: the project had no DB client/ORM, migrations, or password hashing
  before this task (checked `package.json`).
- The local `.env` already contains an `ADMIN_EMAIL` (set by the user; value
  redacted). The seed read it and created that admin. `.env` is git-ignored.
- Drizzle's migration history lives in the `drizzle` schema, not `public`.
  Dropping only `public` therefore leaves the history intact and `migrate()`
  skips everything. `db:reset` must drop the `drizzle` schema too (fixed).
- `promisify(scrypt)` is typed with only the 3-argument overload, so passing
  scrypt options failed type-check. Replaced with an explicit callback wrapper.
- `NodeJS.ProcessEnv` requires `NODE_ENV`, so passing `{}`/partial objects to
  the seed failed type-check. Introduced `AdminSeedEnv =
  Record<string, string | undefined>` for testability.
- `npm install -D drizzle-kit` reported 4 moderate vulnerabilities in
  transitive dependencies; `npm audit fix` was not run (out of scope). Noted
  for follow-up.
- `drizzle/` (generated SQL + meta snapshots) is excluded from Prettier via
  `.prettierignore` so generated files are not reformatted.

## Deviations from plan (recorded)

- **No `DATABASE_URL`.** Per the user's instruction, the connection URL is
  composed only from the existing `POSTGRES_*` variables (`src/db/url.ts`);
  `DATABASE_URL` support and its `.env.example` entry were removed.
- **`tsx` dev dependency added** to run the TypeScript migration/reset scripts
  (Node `--experimental-strip-types` was not used because the scripts import
  other TS modules with extensionless specifiers).
- **`src/db/migrate.ts` exports parameterized functions** (`runMigrations`,
  `seedFirstAdmin(database, env)`, `migrateAndSeed(database)`) so the
  integration test can target a throwaway database; the CLI entry uses the
  shared client.
- **Seed env requirement scope:** the seed checks for an existing admin first
  and only requires `ADMIN_EMAIL`/`ADMIN_PASSWORD` when it actually needs to
  create one, so re-running migrations on an initialized database is
  non-fatal without the admin variables.

## Changes made (implementation)

- Deps: runtime `drizzle-orm`, `pg`; dev `drizzle-kit`, `@types/pg`, `tsx`.
- `drizzle.config.ts`; `src/db/{schema,url,index,migrate,reset}.ts`;
  `src/lib/password.ts` (scrypt).
- `drizzle/0000_gorgeous_synch.sql` (enum `role`, table `users`).
- Scripts `db:generate`, `db:migrate`, `db:reset`.
- Tests: `src/lib/password.test.ts`, `src/db/schema.test.ts`.
- Docs: `docs/decisions/0002-user-accounts-drizzle-scrypt.md`,
  `README.md`, `docs/README.md`, `docs/testing.md`, `.env.example`,
  `.prettierignore`.

## Verification evidence (executed 2026-10-27)

- `npm run db:generate` → generated `drizzle/0000_gorgeous_synch.sql`
  (confirmed it creates `CREATE TYPE role AS ENUM('user','admin')` and the
  `users` table with a unique `email`).
- Fresh database: dropped `public` + `drizzle` schemas, then
  `npm run db:migrate` with `ADMIN_EMAIL`/`ADMIN_PASSWORD` → "Seeded the first
  admin".
- `psql` checks: `enum_range(null::role)` → `{user,admin}`; one row in `users`
  (`admin@example.com`, role `admin`, `password_hash` starts with `scrypt$`);
  `count(*) where role='admin'` → `1`; inserting role `'superuser'` →
  `ERROR: invalid input value for enum role`.
- Idempotency: a second `npm run db:migrate` → "An admin already exists;
  skipping the admin seed."
- `npm run db:reset` → drops and recreates schema, migrates, seeds; one admin
  afterwards.
- `npm test` → 3 files, 11 tests passed (password unit tests + throwaway-DB
  integration tests).
- `npm run format:check` → clean; `npm run lint` → clean; `npm run build` →
  compiled successfully (TypeScript passed).

## Review resolution (2026-10-27, plan draft-2)

First independent review (`review.md`, findings F3-1–F3-8). Resolved:

- F3-1: `seedFirstAdmin` now uses `.returning({ id })` and throws when it
  creates no row ("already exists but is not an admin"). Added a
  conflicting-email integration test.
- F3-2: `databaseUrl()` requires `POSTGRES_PASSWORD` and throws if unset; no
  hardcoded fallback. Added `src/db/url.test.ts`.
- F3-3: `db:reset` refuses non-loopback hosts unless
  `ALLOW_DESTRUCTIVE_DB_RESET=true`; verified it refuses `POSTGRES_HOST=db.example.com`
  and still resets on loopback.
- F3-4: recorded as plan revision `draft-2` (DATABASE_URL removed per the user,
  `tsx` added, parameterized migrate functions, reset drops the Drizzle schema,
  seed ordering, `@next/env` declared).
- F3-5: added the two missing tests; skip-vs-pass behavior remains documented.
- F3-6: `@next/env` declared as an explicit dependency.
- F3-7: the real admin email was redacted from these notes.
- F3-8: `verifyPassword` now bounds-checks stored scrypt parameters; the
  `server-only` guard and `npm audit` remediation remain optional follow-ups.

Re-verified after the fixes (2026-10-27): `npm test` → 4 files, 16 tests
passed; `npm run lint` clean; `db:reset` guard confirmed.

## Second-review resolution (2026-10-27, draft-3)

Second independent review (`review.md`, findings F-A–F-G). Resolved:

- F-A: the relaxed seed behavior (admin env required only when a new admin is
  created) was **approved as plan revision `draft-3`**, and the stale plan text
  (the removed `DATABASE_URL` mention and the "fail if missing" wording) was
  corrected.
- F-B: the `ALLOW_DESTRUCTIVE_DB_RESET` guard was extracted to
  `src/db/reset-guard.ts`, documented in `.env.example`,
  `docs/local-database.md`, `README.md`, and the ADR, and covered by
  `src/db/reset-guard.test.ts`.
- F-C: `verifyPassword` now sizes scrypt `maxmem` for the stored parameters and
  returns `false` instead of throwing on derivation errors; a test covers an
  in-bounds `N` above the default `maxmem`.
- F-D: the DB, password, URL, and reset-guard tests run under
  `@vitest-environment node`; the DB suite skips (does not fail) when
  `POSTGRES_PASSWORD` is absent.
- F-E: `drizzle.config.ts` uses a placeholder URL so `db:generate` works without
  the DB password.
- F-F: the schema tests reset the `users` table in `beforeEach`, removing
  order dependence.
- F-G: fresh-database and rollback steps are documented in
  `docs/local-database.md` and the ADR.

Re-verified after the fixes (2026-10-27): `npm test` → 5 files, 20 tests passed;
`npm run format:check`, `npm run lint`, and `npm run build` clean;
`npm run db:generate` works offline.

## Decisions needed

- None blocking. Optional follow-ups (out of scope): `npm audit` remediation;
  a `server-only` guard for `src/db`; whether to add a `typecheck` script.

## Useful references

- `docs/decisions/0002-user-accounts-drizzle-scrypt.md` — the decisions.
- `docs/local-database.md` — local PostgreSQL via Docker Compose.
- `docs/testing.md` — validation and DB integration test notes.

## Knowledge to preserve

- Drizzle migration history is in the `drizzle` schema; resetting requires
  dropping it or re-migrating is skipped.
- The DB URL is composed from `POSTGRES_*` (ADR 0001); no `DATABASE_URL`.
- `crypto.scrypt` needs a callback wrapper under TypeScript (promisify loses
  the options overload).

## Status reset (2026-10-28)

`task.md` was set back from `done` to `review`. `done` had been written
without a recorded third review and without a verification record: `review.md`
ends with the second review's `review failed`, and no `/verify` evidence exists.
The workflow files were corrected the same day (`/review` now appends the review
to `review.md` and sets `review failed` or `verification`; only `/verify` may set
`done`). Next steps: run `/review TASK-003`, then `/verify TASK-003`. TASK-004
(`/implement`) waits until this task is `done`.

## Third-review fixes (2026-10-28, plan draft-3)

Third independent review (`review.md`, Review 3, findings R3-1–R3-7). Addressed:

- **R3-1 (Low):** `hashPassword` now accepts optional `ScryptParameters`
  (`N`, `r`, `p`) and sizes `maxmem` for them. `password.test.ts` replaces the
  weak assertion with a positive test: a valid hash produced at `N=65536, r=8`
  (~64 MiB, above Node's 32 MiB default `maxmem`) must verify `true`, and a
  wrong password on that hash must verify `false`. Removing the `maxmem` sizing
  now makes this test fail.
- **R3-2 (Low):** `src/db/url.ts` uses `||` instead of `??` so empty variables
  fall back to defaults, and brackets IPv6 hosts (`::1` → `[::1]`). Added
  `url.test.ts` cases for empty values and IPv6.
- **R3-3 (Low):** `drizzle.config.ts` fallback URL no longer embeds
  credential-shaped text; it is now `postgresql://127.0.0.1:5432/educator`.
  `npm run db:generate` still runs and reports "No schema changes".
- **R3-4 (Low):** `seedFirstAdmin` now runs the existence check and the insert
  inside one transaction guarded by `pg_advisory_xact_lock`, so concurrent
  `db:migrate` runs serialize and cannot create two admins. No schema change
  was made (the partial-unique-index option was not used, so no renewed plan
  approval is needed).
- **R3-5 (Low):** `verifyPassword` rejects stored parameters whose scrypt
  memory (`128 * N * r`) exceeds a 256 MiB cap, and rejects an expected key
  longer than `KEY_LENGTH`. (A false-return test cannot distinguish this guard
  from a normal hash mismatch, so it is not separately unit-tested; the
  positive `maxmem` test covers the sizing path.)
- **R3-6 (Low):** the "Files and modules to change" table in `plan.md` was
  synchronized with the modules actually added in the already-approved
  draft-2/draft-3 narrative (`url.ts`, `reset.ts`, `reset-guard.ts`, the two
  new test files, `docs/local-database.md`, `.prettierignore`). This is a
  documentation correction, not a behavioral or scope change.
- **R3-7 (Low):** `isLoopbackHost` is exported from `reset-guard.ts`;
  `schema.test.ts` skips creating/dropping its throwaway database unless the
  host is loopback, mirroring the `db:reset` guard.

### Checks executed (2026-10-28)

- `npm test` → 5 files, 22 tests passed (DB integration tests ran; local
  PostgreSQL reachable via Docker Compose). Started from 20 tests before this
  pass; the net count reflects one weak test replaced by a stronger one.
- `npm run lint` → clean.
- `npm run format:check` → clean (all files use Prettier style).
- `npm run build` → compiled successfully, TypeScript passed.
- `npm run db:generate` → "No schema changes, nothing to migrate" (works with
  the credential-free fallback URL).

No unresolved findings; the next independent `/review` assesses this work.

## Fourth-review fixes (2026-10-28, plan draft-3)

Fourth independent review (`review.md`, Review 4, findings R4-1–R4-5). Addressed:

- **R4-1 (Low):** `src/db/url.test.ts` `beforeEach` now deletes
  `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST`, and
  `POSTGRES_PORT` before each case, so URL tests cannot inherit `.env` values
  loaded by other suites in a shared worker.
- **R4-2 (Low):** `src/db/schema.test.ts` now records a `skipReason` for each
  `beforeAll` early-return branch (non-loopback host, missing
  `POSTGRES_PASSWORD`, unreachable DB) and passes it to `ctx.skip(skipReason)`.
  `docs/testing.md` wording updated to "skipped with a reason" and to mention
  the non-loopback case.
- **R4-3 (Low):** `isLoopbackHost` now strips one pair of surrounding brackets,
  so `[::1]` (valid in a URL) is treated as loopback, matching `url.ts`. Added a
  `[::1]` case to `reset-guard.test.ts`.
- **R4-4 (Low):** added tests for the previously untested behavior:
  - `schema.test.ts`: two concurrent `seedFirstAdmin` calls with different
    emails settle and leave exactly one admin (guards the advisory lock).
  - `schema.test.ts`: `seedFirstAdmin(testDb, {})` resolves when an admin
    already exists (relaxed seed branch).
  - `password.test.ts`: `isSupportedStoredHash` rejects oversized scrypt
    memory (`N=2^20, r=8`) and an over-length derived key, and accepts a
    well-formed hash. `verifyPassword` was refactored to share a
    `parseStoredHash` bound-check, making the caps deterministically testable.
- **R4-5 (Low):** added a "Post-approval clarifications (2026-10-28)" section
  to `plan.md` recording the file-table sync (R3-6), the advisory-lock seed
  (R3-4), and the scrypt memory cap (R3-5), and explaining why they are
  non-material (no change to goal, acceptance criteria, architecture, schema,
  API, dependencies, or configuration). No renewed approval was requested on
  that basis; the section notes it can be superseded by an approved draft-4 if
  the user disagrees.

### Checks executed (2026-10-28)

- `npm test` → 5 files, **27 tests passed** (DB integration tests executed
  against the running local PostgreSQL).
- `npm run lint` → clean.
- `npm run format:check` → clean.
- `npm run build` → compiled successfully, TypeScript passed.

No unresolved findings; the next independent `/review` assesses this work.
