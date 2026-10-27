# Technical Plan: User accounts schema, roles, and bootstrap admin migration

- Status: approved
- Business goal reference: task.md (child of epic TASK-002 — Authorization)
- Plan revision: draft-3 (2026-10-27)
- Approval:
  - status: approved
  - approved_by: user
  - approved_at: 2026-10-27
  - revised_at: 2026-10-27
  - revision_history:
    - draft-1 (2026-10-27): approved by user via `/approve` with no requested
      content changes. Records the technical decisions confirmed during
      planning (Drizzle ORM + drizzle-kit, Postgres enum role, env-required
      bootstrap admin, Node `crypto.scrypt` hashing).
    - draft-2 (2026-10-27): renewed approval recorded after the first
      independent review (findings F3-1–F3-8) and the user's instruction not to
      use `DATABASE_URL`. Changes: the connection URL is composed only from the
      existing `POSTGRES_*` variables and `POSTGRES_PASSWORD` is required (no
      hardcoded fallback); `DATABASE_URL` support and its `.env.example` entry
      were removed; `tsx` is added to run the TypeScript migration/reset
      scripts; `src/db/migrate.ts` exports parameterized functions for
      testability; the seed fails if it creates no admin row; `db:reset` also
      drops the Drizzle migration schema and refuses non-loopback hosts;
      `@next/env` is declared as an explicit dependency; and stored scrypt
      parameters are bounds-checked.
    - draft-3 (2026-10-27): renewed approval by user after the second review
      (findings F-A–F-G). Changes: the admin seed requires
      `ADMIN_EMAIL`/`ADMIN_PASSWORD` only when it needs to create the first
      admin (relaxed from fail-always); the `ALLOW_DESTRUCTIVE_DB_RESET` guard
      is documented and unit-tested; `verifyPassword` bounds its scrypt memory
      and returns `false` instead of throwing; DB/password tests run in the
      node environment and skip without a password; `db:generate` no longer
      needs the DB password; and the fresh-DB/rollback steps are documented.

## Business goal reference

See `task.md` for the business problem, desired outcome, scope, and
acceptance criteria. This plan must not change the original business goal.

Goal: the PostgreSQL database stores user accounts; each account has a role of
exactly `user` or `admin`; and running the migrations against a fresh database
creates the very first `admin` account so the system can be administered from
the start.

## Current implementation

Verified by repository inspection (no commands executed for this plan):

- Next.js 16.4.3 App Router, React 19.3.0, TypeScript 5, Tailwind CSS 4.
- Local PostgreSQL 17 via Docker Compose (TASK-001, `done`): `compose.yaml`
  defines the `db` service; `docs/local-database.md` documents start/stop;
  `.env` (git-ignored) is templated by `.env.example` with `POSTGRES_USER`,
  `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`; the database is
  reachable at `127.0.0.1:5432`.
- `package.json` has **no** database client, ORM, migration tooling, or
  password-hashing dependency.
- Validation tooling from TASK-006 (Vitest, Prettier, ESLint) is present in the
  working tree; TASK-006 is still in `review`.
- No HTTP API or UI exists yet (`src/app` only). Not inspected beyond this
  summary; nothing was executed.

## Proposed solution

Use **Drizzle ORM with `drizzle-kit`** on **`node-postgres` (`pg`)**:

- A `role` **native Postgres enum** with exactly `user` and `admin`.
- A `users` table storing email, a password hash, role, and timestamps.
- Migrations generated as SQL by `drizzle-kit generate` into `drizzle/`.
- A programmatic migration runner (`src/db/migrate.ts`) that first applies the
  SQL migrations, then **idempotently seeds the first admin** from
  `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars (required, no committed default).
- Passwords hashed with Node's built-in `crypto.scrypt`, in a shared
  `src/lib/password.ts` helper reused by TASK-004 sign-in.

Rationale: Drizzle is TypeScript-first, type-safe, and lightweight; the enum
enforces the role invariant in the database; a programmatic runner lets the
seed read secrets from the environment (a plain SQL migration cannot), keeping
secrets out of committed files; `scrypt` avoids an extra native dependency.

## Architecture and data flow

```
server code ──> src/db/index.ts (pg Pool) ──> drizzle( pool ) ──> PostgreSQL 17
npm run db:generate ─> drizzle-kit generate ─> drizzle/<timestamp>_*.sql
npm run db:migrate  ─> src/db/migrate.ts:
    1) migrate(db, { migrationsFolder: './drizzle' })
    2) seedFirstAdmin(db): read ADMIN_EMAIL/ADMIN_PASSWORD; hash; upsert admin
npm run db:reset    ─> documented reset (drop data) then db:migrate
```

Database access is server-only; it must not be imported by client components.

## Files and modules to change

| File | Change | Reason |
| --- | --- | --- |
| `package.json` | add deps + scripts `db:generate`, `db:migrate`, `db:reset` | DB tooling and entry points |
| `package-lock.json` | updated by `npm install` | lockfile consistency |
| `drizzle.config.ts` | new | dialect `postgresql`, schema path, `out: ./drizzle`, credentials from env |
| `src/db/schema.ts` | new | `role` enum and `users` table |
| `src/db/index.ts` | new | `pg` Pool + drizzle client (server-only) |
| `src/db/migrate.ts` | new | programmatic migrate + idempotent admin seed |
| `src/lib/password.ts` | new | scrypt `hashPassword`/`verifyPassword` |
| `drizzle/` | new (generated) | SQL migrations and snapshots |
| `.env.example` | edit | document `POSTGRES_*` (connection), `ADMIN_EMAIL`/`ADMIN_PASSWORD`, and `ALLOW_DESTRUCTIVE_DB_RESET` placeholders (no real secret) |
| `src/lib/password.test.ts` | new | scrypt unit test |
| `src/db/schema.test.ts` | new | DB integration test (schema, role, seed) |
| `docs/decisions/0002-user-accounts-drizzle-scrypt.md` | new | ADR for the decisions above |
| `docs/README.md` | edit | index the ADR; note DB layer |
| `docs/testing.md` | edit | how to run the DB integration tests |
| `README.md` | edit | document `db:*` commands |

No application UI or HTTP API changes.

## Data, API, configuration, and dependency changes

- **Type `role`:** `CREATE TYPE role AS ENUM ('user','admin')` (via `pgEnum`).
- **Table `users`:**
  - `id` — `uuid` primary key, `default gen_random_uuid()`.
  - `email` — `text`/`varchar`, `not null`, **unique**.
  - `password_hash` — `text`, `not null`.
  - `role` — `role` enum, `not null`, `default 'user'`.
  - `created_at`, `updated_at` — `timestamptz`, `default now()`, `not null`.
- **Configuration (env):**
  - Database connection. The URL is composed from the existing `POSTGRES_*`
    variables (`postgresql://...@127.0.0.1:5432/...`). There is no
    `DATABASE_URL` override (draft-2). `POSTGRES_PASSWORD` is required; there is
    no hardcoded fallback credential.
  - `ADMIN_EMAIL`, `ADMIN_PASSWORD` — required by the seed when it needs to
    create the first admin; no committed values.
- **Dependencies:** runtime `drizzle-orm`, `pg`; dev `drizzle-kit`, `@types/pg`.
- **Scripts:** `db:generate` (`drizzle-kit generate`), `db:migrate`
  (run `src/db/migrate.ts`), `db:reset` (documented reset then migrate).
- **Optional dev dep:** a TypeScript script runner (`tsx`) unless Node's
  `--experimental-strip-types` is preferred (see Assumptions).
- **No HTTP API changes** (deferred to TASK-004).

## Implementation steps

1. Install `drizzle-orm`, `pg` and dev `drizzle-kit`, `@types/pg`; add the
   `db:*` scripts.
2. Create `src/lib/password.ts` (`hashPassword`, `verifyPassword` using
   `crypto.scrypt` with a random salt and stored parameters) and a unit test.
3. Create `src/db/schema.ts` with `roleEnum` and the `users` table.
4. Create `drizzle.config.ts`; run `npm run db:generate` to produce the first
   SQL migration under `drizzle/`.
5. Create `src/db/index.ts` (a `pg` Pool and drizzle client from env;
   server-only).
6. Create `src/db/migrate.ts`: run `migrate()`, then `seedFirstAdmin()` which
   reads `ADMIN_EMAIL`/`ADMIN_PASSWORD` only when it needs to create the first
   admin, hashes with `hashPassword`, and inserts the admin if absent
   (idempotent). It fails clearly if no admin exists and the env vars are
   missing, and fails if the email is already used by a non-admin (draft-3).
7. Extend `.env.example` (placeholders/comments only) and document the `db:*`
   commands in `README.md` and the integration-test workflow in
   `docs/testing.md`.
8. On a fresh database (`docker compose down -v` then `docker compose up -d`),
   run `npm run db:migrate`; verify with psql/`docker compose exec`.
9. Add `src/db/schema.test.ts` integration test.
10. Write the ADR `docs/decisions/0002-*.md`; update `docs/README.md`.
11. Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build`.
12. `git status` to confirm no secrets are committed and only intended files
    changed.

## Testing strategy

- **Unit test (no DB):** `src/lib/password.test.ts` — `hashPassword` produces a
  verifiable hash; `verifyPassword` accepts the correct password and rejects a
  wrong one; hashes are salted (two hashes of the same input differ).
- **Integration test (requires the Compose database):** `src/db/schema.test.ts`
  — connect using the env URL, apply migrations and the seed against a throwaway
  database or schema, then assert:
  - the `users` table and `role` enum exist and the enum values are exactly
    `user` and `admin`;
  - inserting an invalid role is rejected;
  - after migrate+seed there is exactly one account with role `admin`;
  - the seed is idempotent (re-running still yields exactly one admin).
  - If the database is unreachable, the test is skipped with an explicit
    message (recorded as `unverified` at verification, not a pass).
- **Reproducibility / rollback:** document a fresh-database reset (`down -v` +
  `up -d`) followed by `npm run db:migrate`, and provide an optional hand-written
  down step (drop `users`, drop the `role` enum) because `drizzle-kit` does not
  emit down migrations by default. Record the exact commands and their output.
- Existing Vitest tooling (TASK-006) is reused.

## Security, validation, error handling, and compatibility

- **Passwords:** store only scrypt hashes with a random per-user salt and stored
  parameters; never store or log plaintext. `verifyPassword` uses a
  constant-time comparison.
- **Bootstrap secret:** `ADMIN_EMAIL`/`ADMIN_PASSWORD` come only from the
  environment; `.env` is git-ignored; `.env.example` holds no real secret. The
  seed requires them only when it needs to create the first admin (draft-3),
  and fails clearly in that case.
- **No secrets in SQL:** the generated migration contains only schema; no
  credentials or hashes are committed.
- **Connectivity:** the pool reads the connection URL from env; the database is
  loopback-only (TASK-001). Set a sane pool size and close the pool on exit in
  the migration script.
- **Idempotency:** the seed uses an email uniqueness/`on conflict do nothing`
  strategy so repeated runs do not create duplicate admins.
- **Server-only:** DB modules must not be imported into client bundles;
  consider a `server-only` guard.
- **Compatibility:** do not change existing scripts or TASK-006 tooling; keep
  `lint`, `build`, `test` working.

## Risks and alternatives

Risks:

- **Down migrations:** `drizzle-kit` is forward-only; rollback is a documented
  reset/reapply plus an optional manual down SQL. Documented, not automated.
- **Running TypeScript scripts:** `db:migrate` needs TS execution — either a
  `tsx` dev dependency or Node's `--experimental-strip-types`. Adds a dev dep or
  relies on an experimental flag.
- **Integration tests need the database:** they may be skipped when Docker/DB
  is unavailable, leaving the criterion to manual verification.
- **Bundling `pg` in the client:** mitigated by keeping DB code server-only.

Alternatives considered (rejected per the user's decisions):

- Prisma — heavier, codegen step.
- Raw `pg` + `node-pg-migrate` — less type safety.
- Text + CHECK role or a separate roles table — native enum preferred.
- `bcrypt`/`argon2` — `crypto.scrypt` avoids a native/binary dependency.

Rollback: remove the new DB scripts and modules, drop the generated migrations,
`npm uninstall` the added packages, and reset the database (`down -v`). No
application behavior is affected.

## Acceptance mapping

| AC | Criterion | Implementation | Verification |
| --- | --- | --- | --- |
| 1 | Migrations apply successfully | drizzle SQL + `db:migrate` | Integration test: migrate succeeds |
| 2 | Reproducible from a fresh DB | reset + `db:migrate` | Documented steps + integration test |
| 3 | Users storage; role restricted to `user`/`admin` | `role` enum + `users` table | Enum assertions; invalid-role rejected |
| 4 | Exactly one `admin` after migration | idempotent seed | Integration test: one admin; idempotency re-run |
| 5 | Migrations rolled back and reapplied as documented | reset/reapply doc (+ optional down SQL) | Execute and record the documented commands |
| 6 | No hardcoded/committed secrets | env-only admin secret; no secrets in SQL | `git status`; review of committed files |

## Assumptions and unresolved questions

Assumptions (non-blocking; adopted unless the user says otherwise):

- TASK-006's Vitest tooling is available for tests.
- Node.js ≥22 in the environment (matches the installed tooling from TASK-006).
- The database runs locally via Docker Compose at `127.0.0.1:5432`.
- **DB URL:** composed from the existing `POSTGRES_*` variables; there is no
  `DATABASE_URL` override (draft-2).
- **Script runner:** `tsx` is used (adopted in draft-2) to run the TypeScript
  migration/reset scripts.
- **Integration-test isolation:** use a throwaway database (for example
  `educator_test`) created and dropped by the test, falling back to skip if the
  database is unreachable.
- Password rules/validation and duplicate-account handling belong to TASK-004.

Unresolved (non-blocking):

- Exact scrypt parameters (cost/blockSize/parallelization) — to be chosen and
  recorded; defaults such as N=16384, r=8, p=1 are acceptable for local use.
- Whether to add a `server-only` dependency or rely on convention.

## Approval status

Approved by the user via `/approve` on 2026-10-27. The approved plan revision is
`draft-3` (see the approval record at the top of this file): `draft-1` was the
initial approval; `draft-2` recorded the review-driven changes and the user's
instruction not to use `DATABASE_URL`; `draft-3` records the relaxed seed
env requirement and the other second-review fixes. `draft-3` supersedes the
earlier revisions.

This approval authorizes the implementation phase. `done` is determined later
by independent review and verification, not by this approval. This section does
not itself implement anything.
