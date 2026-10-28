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
