# Review: Local database running via Docker Compose

- Review status: completed (two independent reviews)
- Reviewers: independent review agents (read-only), 2026-10-26
- Reviewed revision: approved plan `draft-1`; implementation for status `review`

## Summary

Both reviews confirmed the implementation matches the approved plan
file-for-file: `compose.yaml`, `.env.example`, `docs/local-database.md`, and the
ADR were created; `.gitignore`, `README.md`, and `docs/README.md` were edited;
no `src/` or `package.json` changes. No critical or high-severity defects were
found. All accepted-with-low-severity findings are recorded below.

Neither reviewer had shell access, so `git diff`/`git status` and the recorded
runtime evidence were not independently re-executed. The runtime evidence in
`working-notes.md` was produced by the implementer.

## Findings

### R1 — [Medium] Database published on all host interfaces (security) — **FIXED (plan draft-2, user-approved)**
- Original issue: `"${POSTGRES_PORT:-5432}:5432"` bound `0.0.0.0`/`::`, so the
  DB was reachable from the local network. Combined with the committed default
  password, any LAN host could connect.
- Resolution: changed to `"127.0.0.1:${POSTGRES_PORT:-5432}:5432"`. `docker
  compose config` shows `host_ip: 127.0.0.1` and `docker compose ps` shows only
  `127.0.0.1:5432->5432/tcp`. Docs updated to state loopback-only binding.
  This was a material change to the approved plan and was re-approved by the
  user as plan revision `draft-2`.

### R2 — [Low] Fixed `container_name` defeats the `COMPOSE_PROJECT_NAME` mitigation — **FIXED (plan draft-2, user-approved)**
- Original issue: `container_name: educator-db` was not namespaced by project,
  so two checkouts on one host could not run simultaneously and
  `COMPOSE_PROJECT_NAME` did not resolve the conflict.
- Resolution: `container_name` removed; Compose names the container
  `<project>-<service>-1` (observed `educator-db-1`).

### R3 — [Low] Healthcheck has no `start_period` — **FIXED (plan draft-2, user-approved)**
- Original issue: with `interval: 5s` and `retries: 10`, the container could be
  marked unhealthy after ~50s during a slow first `initdb`.
- Resolution: added `start_period: 30s` to the healthcheck.

### R4 — [Low] Documented volume name is directory-dependent — **FIXED**
- Files: `docs/local-database.md`, `README.md`.
- Wording now states the volume is `<project>_pgdata`, defaulting to
  `educator_pgdata` for a checkout directory named `educator`, and mentions
  `COMPOSE_PROJECT_NAME`.

### R5 — [Low] Verify commands hardcoded credentials/port — **FIXED**
- File: `docs/local-database.md`.
- The reachability/verify commands now read `$POSTGRES_USER`,
  `$POSTGRES_PASSWORD`, `$POSTGRES_PORT`, `$POSTGRES_DB` after sourcing `.env`,
  and the in-container checks use the container's own environment variables.

### R6 — [Low / note] Committed placeholder password and AC7 — **CONFIRMED**
- File: `.env.example`, `compose.yaml`.
- The committed value is a non-secret, local-only placeholder. The user
  explicitly confirmed this satisfies AC7. The risk is further reduced by the
  loopback-only binding applied under R1.

### R7 — [Low / hygiene] `review.md` was stale — **FIXED**
- This file previously said "not started"; corrected by this recording.

## Things checked and found correct

- `.gitignore`: `!.env.example` correctly negates `.env*`; `.env` remains
  ignored and `.env.example` is trackable.
- `compose.yaml`: valid Compose v2 shape (no `version:`), named volume mounted
  at `/var/lib/postgresql/data`, healthcheck present, defaults allow startup
  without `.env`.
- No credentials added to tracked application source; no dependency changes;
  docs index and ADR updated consistently with the plan.
- No test framework exists, so the documented manual checklist is the
  appropriate verification strategy.

## Recommended fixes

1. R1 — loopback bind: **applied** under renewed approval (plan `draft-2`),
   re-verified at runtime.
2. R2, R3 — **applied** under renewed approval (plan `draft-2`).
3. R4, R5, R7 — **applied** during review resolution.
4. R6 — **confirmed** by the user as satisfying AC7.

## Unverifiable by reviewers (no shell access)

- `git status` / `git diff` against HEAD (re-checked by the implementer after
  the fixes).
- The runtime evidence recorded in `working-notes.md` was not independently
  re-executed by the reviewers; the implementer re-ran it after the draft-2
  changes (see `working-notes.md`).

## Final review outcome

No critical/blocking defects. All review findings are resolved or explicitly
confirmed. The implementation now matches plan revision `draft-2`. The task can
proceed to `verification`; it must not be marked `done` until the user accepts
the result.
