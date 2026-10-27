# Technical Plan: Sign-up and sign-in API endpoints

- Status: approved
- Business goal reference: task.md (child of epic TASK-002 — Authorization)
- Plan revision: draft-1 (2026-10-27)
- Approval:
  - status: approved
  - approved_by: user
  - approved_at: 2026-10-27
  - revision_history:
    - draft-1 (2026-10-27): approved by user via `/approve` with the
      recommended defaults (session cookies, 409 for duplicates, password
      minimum length 8, server-side sessions table, minimal response shape).

## Business goal reference

See `task.md` for the business problem, desired outcome, scope, and
acceptance criteria. This plan must not change the original business goal.

Goal: provide API endpoints to let a person sign up and sign in; new accounts
are created with the `user` role; authentication is implemented securely and
consistently so client code can rely on documented responses.

## Current implementation

This task depends on TASK-003, which provides the `users` table, `role`
enum, and `src/lib/password.ts` (scrypt hashing). The project has Vitest and
validation tooling from TASK-006. No API endpoints exist yet.

## Proposed solution (recommended defaults)

- Authentication mechanism: server-side sessions stored in a `sessions` table,
  with a secure HttpOnly cookie containing the session id. This provides
  easy revocation and works well with Next.js App Router.
- Password hashing: reuse `src/lib/password.ts` (scrypt) implemented in TASK-003.
- Duplicate-account behavior: reject sign-up with 409 Conflict to keep server
  logic simple and predictable.
- Validation: require `email` (basic format) and `password` (min 8 characters).
  Stronger policies are optional.
- API style: JSON REST endpoints under `src/app/api/` (App Router route handlers):
  - POST /api/signup
  - POST /api/signin
  - GET  /api/me (optional, returns authenticated user)

## Architecture and data flow

Client → POST /api/signup → server handler:
- validate input
- check existing user by email
- hash password with scrypt
- insert user with role `user`
- create session row and set cookie
- respond 201 with sanitized user object (id, email, role)

Client → POST /api/signin → server handler:
- validate input
- fetch user by email
- verify password via scrypt helper
- on success create session & cookie, respond 200 with user
- on failure respond 401 (consistent message to avoid enumeration)

Session storage (server-side): `sessions` table with columns (id uuid primary key, user_id uuid references users.id, created_at, expires_at, last_seen, metadata jsonb). A secure cookie stores the session id; handlers verify the session by querying the sessions table via Drizzle.

## Files and modules to change

- `src/app/api/signup/route.ts` — sign-up handler.
- `src/app/api/signin/route.ts` — sign-in handler.
- `src/app/api/me/route.ts` — optional current-user handler.
- `src/lib/session.ts` — session creation/verify/clear helpers (server-only).
- `src/lib/validators.ts` — input validators.
- `src/db/schema.ts` — add `sessions` table (migration via TASK-003's Drizzle setup).
- `drizzle/` migration output — new migration adding `sessions` table.
- `src/app/api/*` tests — integration tests using Vitest + throwaway DB schema (like TASK-003 tests).
- `docs/testing.md` — document how to run API integration tests against local DB.

## Data, API, configuration, and dependency changes

- Data: new `sessions` table; no changes to `users` beyond expected fields from TASK-003.
- API: JSON endpoints as described.
- Config: none new; reuse DB env variables from TASK-003.
- Dependencies: none beyond what TASK-003 added (Drizzle/pg). Consider `cookie` handling helpers if needed (Node builtin or small helper library).

## Implementation steps (small verifiable steps)

1. Add migration for `sessions` table via `drizzle-kit` (generate SQL) and add to repo.
2. Implement `src/lib/session.ts` with createSession(userId, options) → sessionId, verifySession(sessionId) → userId, clearSession(sessionId). Unit-test its helpers (no DB if in-memory or use test DB).
3. Implement `/api/signup` handler:
   - validate payload;
   - check uniqueness (409 on duplicate);
   - hash password; insert user role `user` via Drizzle;
   - create session row; set secure HttpOnly SameSite cookie;
   - return 201 with user metadata.
   Add unit and integration tests.
4. Implement `/api/signin` handler similarly; create session on success; return 200.
5. Implement `/api/me` to return current user when cookie present; adds a simple auth middleware.
6. Add tests: unit tests for validators/session helpers; integration tests hitting endpoints against a throwaway DB (like TASK-003).
7. Run `format:check`, `lint`, `test`, and `build`.
8. Update `docs/testing.md` with integration-test run instructions.

## Testing strategy

- Unit tests: validators, session helpers, handler logic (mock DB) using Vitest.
- Integration tests: run endpoints against a throwaway DB (create DB/schema like TASK-003 tests), assert DB rows and cookie behavior, test duplicate sign-up, wrong-password flows.
- Security checks: ensure password not returned; cookie flags present.

## Security, validation, error handling

- Passwords: scrypt via `src/lib/password.ts`.
- Sessions: store session id in HttpOnly Secure cookie; set SameSite=Lax by default.
- Error responses: consistent messages for sign-in failures (avoid user existence leaks).
- Rate-limiting: note as follow-up; for now keep an exponential backoff or simple in-memory limiter in tests.

## Risks, alternatives, rollback

- Alternative auth: JWTs (future choice); session table enables revocation.
- Rollback: removing endpoints requires removing handlers and reversing migrations.

## Acceptance mapping

AC1: Sign-up creates user with `user` role → `/api/signup` inserts role `user` (integration test asserts DB).

AC2: Sign-in authenticates existing account → `/api/signin` verifies scrypt and creates session (integration test asserts 200 + cookie).

AC3: Invalid input and wrong credentials rejected → validators + 401/400 responses (negative tests).

AC4: Duplicate accounts handled consistently → uniqueness check + 409 (integration test asserts 409).

AC5: Passwords never stored/returned plaintext → password_hash only; responses do not include password (tests assert this).

AC6: No secrets committed → no secrets in repo; admin seed remains env-driven (TASK-003).

## Open questions and assumptions

- Assumptions: TASK-003 is available and database reachable locally; Node >=22 and the validation tooling from TASK-006 are present.
- Open questions (user approved defaults): server-side sessions table, reject duplicates with 409, password min 8, minimal JSON response.

## Approval status

This plan is approved by the user and is ready to be implemented.
