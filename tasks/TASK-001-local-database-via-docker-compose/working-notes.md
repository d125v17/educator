# Working Notes: Local database running via Docker Compose

Temporary working notes for this task. Notes here are raw observations and
must not be treated as approved decisions. Anything unverified must be
explicitly labeled as an unverified assumption.

## Findings

- Verified in the development environment: Docker 28.1.1 and Docker Compose v2
  (`docker compose` v2.35.1) are installed; the legacy `docker-compose` binary
  is not present. Compose v2 file format (`compose.yaml`, no `version:` key) is
  therefore used.
- The repository had no database, Compose file, `.env`, or `.env.example`
  before this task.
- `.gitignore` had `.env*`, which also ignored `.env.example`; a `!.env.example`
  negation was required so the template can be committed while `.env` stays
  ignored.
- `postgres:17` resolves to PostgreSQL 17.11 and places data in
  `/var/lib/postgresql/data` (PostgreSQL 18 changed this path — pinning 17
  avoids the mismatch).
- The named volume is actually created as `educator_pgdata` because Compose
  prefixes the project name (`educator`) to the declared volume `pgdata`.
- Compose project name (from the directory) is `educator`; `docker compose config`
  validated the file before running.

## Verification evidence (executed 2026-10-26)

- `docker compose config` — valid; service `db`, volume `educator_pgdata`,
  port `5432:5432`.
- `cp .env.example .env && docker compose up -d` — image pulled, container
  `educator-db` started.
- Health: `docker inspect --format '{{.State.Health.Status}}' educator-db`
  reported `healthy` after ~5s.
- Reachability from host: `docker run --rm --network host postgres:17 psql
  "postgresql://educator:educator_local_pw@127.0.0.1:5432/educator" -c
  "select 1;"` returned `1`.
- In-container: `pg_isready` → "accepting connections";
  `select version()` → PostgreSQL 17.11.
- Persistence: created `t_persist`, `docker compose restart`, `select
  to_regclass('public.t_persist')` still returned `t_persist`; then dropped it.
- Stop: `docker compose down` removed container and network; `docker compose ps`
  empty afterwards.

## Hypotheses

- (Confirmed) A single service in a Compose file is sufficient for the local
  development need.
- (Unconfirmed) The backend application in a later task will connect over the
  host machine's exposed port (`127.0.0.1:5432`).

## Decisions needed

All planning decisions were resolved and approved (see `plan.md`): PostgreSQL
17, host port 5432, `.env` + committed `.env.example`, named volume, no admin
UI. Remaining non-blocking question: include an optional
`scripts/verify-local-db.sh` (deferred — not part of minimum scope).

## Experiments

- Manual verification checklist executed above; no automated test framework is
  configured in the project, so verification is documented and manual.

## Review resolution (2026-10-26, plan draft-2)

Two independent reviews were recorded in `review.md`. Findings R1 (loopback
bind), R2 (remove fixed `container_name`), and R6 (AC7 placeholder password)
were put to the user; the user approved the R1/R2/R3 changes and confirmed R6.
R4 and R5 were fixed in the docs during review.

Re-verification after the draft-2 changes (executed 2026-10-26):

- `docker compose config` — `host_ip: 127.0.0.1`, no `container_name`,
  healthcheck includes `start_period: 30s`.
- `docker compose up -d` — container named `educator-db-1` (project/service
  namespaced), reached `healthy`.
- `docker compose ps` — ports shown as `127.0.0.1:5432->5432/tcp` (loopback
  only, no `0.0.0.0`/`::` binding).
- Reachability via the documented `.env`-driven command returned `1`.
- Persistence: `t_persist` survived `docker compose restart`, then dropped.
- `docker compose down` removed the container and network.

Notes for verification:

- The container is now named `educator-db-1`, not `educator-db`; commands use
  the service name (`docker compose exec db ...`) and are unaffected.
- The volume remains `educator_pgdata` for this checkout directory.

## Useful references

None yet.

## Knowledge to preserve

Anything reusable discovered here (for example a validated Compose pattern or
a documented verification command) should be promoted into `docs/`, and any
durable architectural decision into `docs/decisions/`, once confirmed.
