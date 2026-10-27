# ADR 0002: User accounts with Drizzle, a role enum, and scrypt-hashed passwords

- Status: accepted
- Date: 2026-10-27
- Task: TASK-003 — User accounts schema, roles, and bootstrap admin migration
- Epic: TASK-002 — Authorization

## Context

The project had no user storage, no roles, and no way to obtain a first
administrator. The local PostgreSQL 17 database exists (ADR 0001), but the
application had no database client, ORM, migration tooling, or password
hashing. Account storage, a `user`/`admin` role, and a bootstrap admin were
needed as the foundation for sign-up and sign-in (TASK-004/TASK-005).

## Decision

1. Use **Drizzle ORM** with **`node-postgres` (`pg`)**, and **`drizzle-kit`**
   to generate SQL migrations into `drizzle/`.
2. Store the role as a **native PostgreSQL enum** `role AS ENUM ('user','admin')`.
3. Seed the **first admin** from required `ADMIN_EMAIL` / `ADMIN_PASSWORD`
   environment variables, as part of the migration step
   (`src/db/migrate.ts`), idempotently.
4. Hash passwords with Node's built-in **`crypto.scrypt`** (salted, with stored
   parameters), in `src/lib/password.ts`.

## Rationale

- Drizzle is TypeScript-first and type-safe, keeps migrations as reviewable SQL,
  and is lightweight compared to generated-client ORMs.
- A native enum is enforced by the database, guaranteeing the role is exactly
  `user` or `admin`.
- A plain SQL migration cannot read secrets, so the seed runs in a programmatic
  migration runner that reads the admin credentials from the environment. This
  keeps secrets out of committed SQL and files.
- `crypto.scrypt` avoids a native/binary dependency (`argon2`) or an extra
  library (`bcrypt`), while still providing a strong, salted, tunable KDF.

## Alternatives considered

- **Prisma** — rejected: heavier tooling and a code-generation step.
- **Raw `pg` + `node-pg-migrate`** — rejected: less type safety.
- **`role` as text + CHECK, or a separate `roles` table** — rejected in favour
  of a native enum.
- **`bcrypt` / `argon2`** — rejected to avoid an extra or native dependency.
- **`DATABASE_URL`** — not introduced; the connection URL is composed from the
  existing `POSTGRES_*` variables established by ADR 0001.

## Consequences

- `users` table: `id` (uuid, `gen_random_uuid()`), `email` (unique),
  `password_hash`, `role` (enum, default `user`), `created_at`, `updated_at`.
- Running `npm run db:migrate` on a fresh database applies the migration and,
  when no admin exists, seeds one from `ADMIN_EMAIL`/`ADMIN_PASSWORD`. It fails
  clearly if those variables are missing.
- `npm run db:generate` produces SQL migrations from `src/db/schema.ts`.
- `drizzle-kit` does not emit down migrations; rollback is a documented reset.
  `npm run db:reset` drops the `public` and `drizzle` schemas and re-migrates;
  for a fully clean database, `docker compose down -v`, `up -d`, then
  `npm run db:migrate`. `db:reset` refuses non-loopback hosts unless
  `ALLOW_DESTRUCTIVE_DB_RESET=true` (see `docs/local-database.md`).
- Database modules are server-only and must not be imported by client code.
- `tsx` is used to run the TypeScript migration/reset scripts.
