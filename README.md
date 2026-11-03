# Educator

A Next.js 16 (App Router) application with a local PostgreSQL database managed
through Drizzle ORM.

This guide explains how to get the project running locally from a fresh
checkout: install dependencies, start the database, apply migrations and the
bootstrap admin seed, and run the development server.

## Prerequisites

- **Node.js 22.13 or newer** and npm (the installed tooling requires it).
  Check with:
  ```bash
  node --version
  npm --version
  ```
- **Docker with the Compose v2 plugin** (`docker compose`). No PostgreSQL
  server needs to be installed on the host. Check with:
  ```bash
  docker compose version
  ```

## Quick start

```bash
# 1. Install dependencies (uses the committed package-lock.json)
npm install

# 2. Create your local environment file (once)
cp .env.example .env

# 3. Start the local PostgreSQL database
docker compose up -d

# 4. Wait until the database reports "(healthy)"
docker compose ps

# 5. Apply migrations and seed the first admin
npm run db:migrate

# 6. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Step 5 needs `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` the first time, so the
seed can create the bootstrap admin. Once an admin exists, later `db:migrate`
runs do not require them.

## Environment variables

`npm install` does not need any variables. The database and migration commands
read a locally created `.env` file (git-ignored). Start from the committed
`.env.example`.

| Variable | Default (`.env.example`) | Purpose |
| --- | --- | --- |
| `POSTGRES_USER` | `educator` | Database user. |
| `POSTGRES_PASSWORD` | `educator_local_pw` | Database password (local-only placeholder). Required; there is no hardcoded fallback in code. |
| `POSTGRES_DB` | `educator` | Database name. |
| `POSTGRES_PORT` | `5432` | Host port mapped to the container. Change it if `5432` is already in use (e.g. `5433`). |
| `ADMIN_EMAIL` | — (commented out) | Bootstrap admin email. Used only when no admin exists yet. |
| `ADMIN_PASSWORD` | — (commented out) | Bootstrap admin password. Used only when no admin exists yet. |
| `ALLOW_DESTRUCTIVE_DB_RESET` | — (commented out) | Set to `true` to let `db:reset` run against a non-loopback host. Destructive; local use only. |

`.env` is git-ignored and **must never be committed**. The committed
`.env.example` only contains local, non-secret placeholders.

## Database

The database runs in Docker and is reachable at **`127.0.0.1:5432`** by default
(or the `POSTGRES_PORT` you configured). It is published on loopback only.

```bash
docker compose up -d      # start the database
docker compose ps         # check health ("Up ... (healthy)")
docker compose down       # stop it (data is kept)
docker compose down -v    # stop it and delete all stored data
```

Data is stored in the Docker volume `educator_pgdata` and survives restarts.

### Migration commands

The schema lives in `src/db/schema.ts`; SQL migrations are generated into
`drizzle/`.

```bash
npm run db:generate   # generate SQL migrations from the schema
npm run db:migrate    # apply migrations and seed the first admin
npm run db:reset      # drop and recreate the schema, then migrate + seed
```

`db:reset` refuses to run unless the database host is loopback
(`127.0.0.1`, `localhost`, or `::1`). Set `ALLOW_DESTRUCTIVE_DB_RESET=true` in
`.env` to override.

### Reproduce from a fresh database

```bash
docker compose down -v   # delete the data volume
docker compose up -d     # start a new, empty database
npm run db:migrate       # apply migrations and seed the first admin
```

Rollback is a documented reset rather than an automatic down migration; see
[docs/local-database.md](docs/local-database.md) for details.

The `users` table stores accounts with a role of `user` or `admin` and a scrypt
password hash. See
[docs/decisions/0002-user-accounts-drizzle-scrypt.md](docs/decisions/0002-user-accounts-drizzle-scrypt.md).

## Run the app

```bash
npm run dev     # development server with hot reload
npm run build   # production build (also type-checks)
npm start       # serve the production build
```

The development server runs at
[http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
npm run format:check  # check formatting without writing
npm run format        # format with Prettier
npm run lint          # run ESLint
npm test              # run the test suite (Vitest)
npm run test:watch    # run tests in watch mode
npm run build         # production build / type-check
```

The database integration tests (`src/db/schema.test.ts`) need the local
database running and `POSTGRES_PASSWORD` set. If the database is unreachable or
the password is missing, those tests are **skipped with a reason** — a skipped
run is not a pass. See [docs/testing.md](docs/testing.md).

## Troubleshooting

- **Port `5432` is already in use.** Set a different `POSTGRES_PORT` (for
  example `5433`) in `.env`, then run `docker compose up -d` again.
- **`docker compose ps` does not show `(healthy)`.** Wait a few seconds and
  re-run it; inspect logs with `docker compose logs db`.
- **`db:migrate` fails with `POSTGRES_PASSWORD is not set`.** Create `.env`
  from `.env.example` (`cp .env.example .env`).
- **`db:migrate` fails asking for `ADMIN_EMAIL` / `ADMIN_PASSWORD`.** Set both
  in `.env` before seeding the first admin (needed only when no admin exists).
- **`db:reset` refuses to run.** It only runs against a loopback database host;
  that is a safety guard, not a bug.
- **Database tests are skipped.** Start the database (`docker compose up -d`)
  and ensure `.env` has `POSTGRES_PASSWORD`.

## Documentation

- [docs/README.md](docs/README.md) — documentation index.
- [docs/local-database.md](docs/local-database.md) — full database start,
  verification, persistence, and cleanup guide.
- [docs/testing.md](docs/testing.md) — testing and validation conventions.
- [docs/decisions/](docs/decisions/) — architecture decision records.
- [tasks/README.md](tasks/README.md) — task workflow and status rules.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [Next.js GitHub repository](https://github.com/vercel/next.js)

## Deploy

The easiest way to deploy this Next.js app is the
[Vercel Platform](https://vercel.com/new). See the
[Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying)
for more details.
