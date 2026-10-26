---
id: TASK-001
title: Local database running via Docker Compose
status: done
created: 2026-10-26
updated: 2026-10-26
plan_approved: 2026-10-26
plan_approved_by: user
plan_revision: draft-2
plan_revised: 2026-10-26
accepted: 2026-10-26
accepted_by: user
---

# Business Task: Local database running via Docker Compose

## Business problem

The project does not yet have a database that developers can run locally.
Without one, the team cannot store or read application data, and future work
on backend data features has nothing to connect to.

Setting up a database by hand on each machine is slow and inconsistent, and
it makes onboarding new developers harder.

## Desired outcome

A developer can start a local database with a single documented Docker
Compose command, without installing or configuring a database server
manually. The database is ready to be used by the backend application in
follow-up tasks.

## User scenarios

- As a developer joining the project, I follow the documented instructions
  and get a working local database on my machine.
- As a developer, I start the database before running the backend
  application, and stop it when I am finished.
- As a developer, I restart the database without losing previously stored
  data while I am still working on the same setup.

## Acceptance criteria

- Docker Compose instructions exist and are documented, so a developer can
  follow them without additional guidance.
- Running the documented command starts the database successfully.
- Running the documented stop/cleanup command shuts the database down.
- The database is reachable on a documented host and port from the local
  machine, verified by a described check.
- A second developer following the same instructions reaches the same result.
- The instructions state where the data is stored and what happens to it on
  restart.
- No credentials or secrets are hardcoded in a way that would be committed to
  the repository.

Open questions that affect these criteria are listed under "Open questions".

## Scope

### Included

- Docker Compose configuration for running one local database.
- Documented start, stop, and verification instructions for developers.
- A data storage approach that keeps data between restarts of the local
  setup.
- Placeholder or environment-based configuration for database credentials.

### Excluded

- Connecting the backend application to the database (planned as a separate,
  follow-up task).
- Database schema, migrations, or seed data.
- Production, staging, or other hosted database environments.
- Choosing or changing the database technology as an architectural decision
  (still to be confirmed — see "Open questions").

## Constraints

- Must run locally via Docker Compose.
- Must not require a manually installed database server on the developer
  machine.
- Must not commit real secrets to the repository.
- The developer must be able to start and stop it with documented commands.

## Open questions

- Which database technology and version should be used (for example
  PostgreSQL or MySQL)? The description says "new database" but does not name
  a technology.
- Which port should the database be exposed on locally?
- How should credentials be supplied locally (environment file, Compose
  variables, default local-only values)?
- Should the data volume be a named Docker volume or a folder in the
  repository, and should it be excluded from version control?
- Is Docker Compose (V2, `docker compose`) or the older `docker-compose`
  required by the team's machines?
- Should a database administration/UI tool be included for inspecting data,
  or is that out of scope?

## Verification and acceptance

Verified on 2026-10-26 against plan revision `draft-2` (evidence in
`working-notes.md`; review findings in `review.md`).

| Acceptance criterion | Evidence |
| --- | --- |
| Documented Compose instructions | `README.md` "Local database" section; `docs/local-database.md` |
| Running the documented command starts the DB | `docker compose up -d` → container became `healthy`; `docker compose ps` shows `Up ... (healthy)` |
| Stop/cleanup command shuts it down | `docker compose down` → container and network removed; `docker compose ps` empty |
| Reachable on documented host/port, with a described check | `127.0.0.1:5432` (loopback only); `psql "postgresql://...@127.0.0.1:5432/educator" -c "select 1;"` → `1` |
| Second developer reaches the same result | Documented from-scratch path (copy `.env.example` → `.env`, `docker compose up -d`, verify); verified by following the docs. Note: a clean-checkout run on another machine remains a human check. |
| Data location and restart behavior stated | `docs/local-database.md`: volume `<project>_pgdata`; data survives `stop`/`restart`/`down`, deleted by `down -v`; persistence test passed |
| No hardcoded committed secrets | `.env.example` holds a non-secret local placeholder; `.env` is git-ignored; user confirmed the placeholder satisfies this criterion |

Accepted by the user on 2026-10-26.

## Links

- Technical plan: plan.md
- Working notes: working-notes.md
- Review: review.md
