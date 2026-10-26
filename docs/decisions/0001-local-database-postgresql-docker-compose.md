# ADR 0001: Local database via PostgreSQL 17 on Docker Compose

- Status: accepted
- Date: 2026-10-26
- Task: TASK-001 — Local database running via Docker Compose

## Context

The project had no local database. Developers needed a way to start one with a
single documented command, without installing a database server manually, so
that later backend tasks have something to connect to. The database technology
had not been chosen.

## Decision

Run a single **PostgreSQL 17** service using **Docker Compose v2**
(`compose.yaml`), exposing host port `5432`, persisting data in a named Docker
volume (`pgdata`), and supplying credentials through environment variables read
from a git-ignored `.env` templated by a committed `.env.example`.

## Rationale

- PostgreSQL is the common pairing for a Next.js/TypeScript backend and is
  expected by follow-up backend tasks.
- The official `postgres:17` image avoids custom build work.
- PostgreSQL 17 is pinned deliberately: PostgreSQL 18 changed the default data
  directory, so pinning avoids a data-directory mismatch.
- A named volume survives restarts without writing database files into the
  repository.
- Environment-based credentials keep secrets out of version control.

## Alternatives considered

- **MySQL 8** — rejected; PostgreSQL chosen for backend alignment.
- **Bind-mount `./data`** — rejected; risk of committing database files.
- **Legacy `docker-compose`** — rejected; Compose v2 is the current standard
  and the only version present in the development environment.
- **Bundling Adminer/pgAdmin** — rejected as out of scope for this task.
- **Inline credentials only, no `.env`** — rejected; an example plus local file
  gives clearer onboarding.

## Consequences

- Developers need Docker with Compose v2 only.
- `.gitignore` requires a `!.env.example` exception so the template can be
  committed while `.env` stays ignored.
- Host port `5432` may conflict with an existing local PostgreSQL; the
  `POSTGRES_PORT` variable covers that case.
- The backend connection to this database is a separate follow-up task.
