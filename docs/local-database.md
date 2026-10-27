# Local database

The project uses a local PostgreSQL database running via Docker Compose. This
document covers starting, verifying, stopping, and resetting it.

## Prerequisites

- Docker with the Compose v2 plugin (`docker compose`). Check with:
  ```
  docker compose version
  ```
- No PostgreSQL server needs to be installed on the machine.

## Configuration

Database settings are read from a local `.env` file. A non-secret template is
committed as `.env.example`. Create your local file once:

```
cp .env.example .env
```

Variables (defaults from `.env.example`, all local-only):

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_USER` | `educator` | Database user. |
| `POSTGRES_PASSWORD` | `educator_local_pw` | Database password (local-only placeholder). |
| `POSTGRES_DB` | `educator` | Database name. |
| `POSTGRES_PORT` | `5432` | Host port mapped to the container. |

`.env` is git-ignored by the `.env*` rule in `.gitignore` and **must never be
committed**. The committed `.env.example` is allowed by an explicit
`!.env.example` exception. If port `5432` is already in use, set a different
`POSTGRES_PORT` in `.env` (for example `5433`).

## Start

```
docker compose up -d
```

Wait for the container to become healthy:

```
docker compose ps
```

The `STATUS` column should read `Up ... (healthy)`.

## Verify reachability

The commands below read your settings from `.env`, so they stay correct if you
changed the user, password, database, or port. Load them into your shell first:

```
set -a; . ./.env; set +a
```

From the local machine, without a host `psql` installed:

```
docker run --rm --network host postgres:17 \
  psql "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}" -c "select 1;"
```

If a host `psql` is available:

```
psql -h 127.0.0.1 -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "select 1;"
```

Inside the container (uses the values the container was started with):

```
docker compose exec db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select version();"'
```

The database is reachable at **host `127.0.0.1`, port `5432`** by default, or
the `POSTGRES_PORT` you configured in `.env`. The port is published on
`127.0.0.1` only (loopback), so the database is **not** reachable from other
machines on the network.

## Data storage and restart behavior

Data is stored in a named Docker volume, declared as `pgdata` in
`compose.yaml`. Compose prefixes the declared name with the project name, so
the actual volume is `educator_pgdata` for a checkout directory named
`educator` (and `<project>_pgdata` otherwise; set `COMPOSE_PROJECT_NAME` to
control it). The volume is managed by Docker and lives outside the repository.

- `docker compose stop` / `docker compose restart` **keep** the data.
- `docker compose down` stops and removes the container but **keeps** the data
  volume, so a later `docker compose up -d` restores the same data.
- `docker compose down -v` **deletes** the data volume; the next start begins
  with an empty database.

## Stop and cleanup

Stop the database, keeping its data:

```
docker compose down
```

Stop and delete all stored data:

```
docker compose down -v
```

To verify the container is gone:

```
docker compose ps
```

## Migrations and reset

The schema is managed with Drizzle (see `decisions/0002-user-accounts-drizzle-scrypt.md`).
The migration commands are documented in the project `README.md`
(`npm run db:generate`, `npm run db:migrate`, `npm run db:reset`).

To reproduce from a completely fresh database:

```
docker compose down -v   # delete the data volume
docker compose up -d     # start a new, empty database
npm run db:migrate       # apply migrations and seed the first admin
```

### Rollback

`drizzle-kit` generates forward-only migrations, so rollback is a documented
reset rather than an automatic down migration:

- `npm run db:reset` drops the `public` and `drizzle` schemas, then reapplies
  the migrations and the admin seed.
- For a fully clean database, use `docker compose down -v`, then `up -d`, then
  `npm run db:migrate` (commands above).

`npm run db:reset` refuses to run unless the database host is loopback
(`127.0.0.1`, `localhost`, or `::1`). To allow a non-local host, set
`ALLOW_DESTRUCTIVE_DB_RESET=true` in `.env` — destructive, use with care.
