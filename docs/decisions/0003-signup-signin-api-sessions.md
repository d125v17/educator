# ADR 0003: Sign-up/sign-in API with server-side sessions

- Status: accepted
- Date: 2026-11-03
- Task: TASK-004 — Sign-up and sign-in API endpoints
- Epic: TASK-002 — Authorization

## Context

Accounts can be stored (TASK-003: `users` with a `role` enum and scrypt
password hashes), but there was no way to create an account or authenticate
over HTTP. TASK-004 needed an authentication mechanism, a duplicate-account
behavior, input validation rules, and a response shape. The plan approved these
with the recommended defaults (session cookies, 409 for duplicates, password
minimum length 8, a server-side sessions table, and a minimal JSON response).

## Decision

1. **Authentication mechanism:** server-side sessions stored in a `sessions`
   table (`id` uuid primary key, `user_id` references `users.id` with
   `ON DELETE CASCADE`, `created_at`, `expires_at`, `last_seen`, `metadata`
   jsonb). The client receives only the opaque session `id` in a `session`
   cookie. Revocation is a row delete.
2. **Endpoints** (Next.js App Router route handlers under `src/app/api/`):
   - `POST /api/signup` → `201` with the public user and a session cookie.
   - `POST /api/signin` → `200` with the public user and a session cookie.
   - `GET /api/me` → `200` with the public user, or `401`.
3. **Cookie attributes:** `HttpOnly`, `SameSite=Lax`, `Path=/`, and an
   `expires` matching the session. `Secure` is set only when
   `NODE_ENV=production`, because the local dev server runs on plain HTTP and a
   browser rejects a `Secure` cookie there.
4. **Response shape:** success is `{ "user": { "id", "email", "role" } }`;
   errors are `{ "error": { "code", "message", "details"? } }`. The password
   hash is never serialized.
5. **Duplicate accounts:** rejected with `409 Conflict`. Uniqueness is enforced
   by the `users.email` unique constraint via `INSERT ... ON CONFLICT DO
   NOTHING RETURNING`, so concurrent requests cannot both succeed.
6. **Validation:** email must be a basic well-formed address (normalized by
   trimming and lower-casing); sign-up requires a password of 8–200
   characters. The sign-up length policy is **not** applied on sign-in, so
   accounts created outside sign-up (for example the bootstrap admin seeded
   from `ADMIN_PASSWORD`) can still authenticate; the stored hash is the
   source of truth.
7. **Sign-in failures:** unknown email and wrong password both return the same
   `401 invalid_credentials` body, and the unknown-email path performs an
   equivalent scrypt verification against a cached dummy hash, so neither the
   response body nor the timing reveals whether an account exists.
8. **Hashing:** reuse `src/lib/password.ts` (scrypt) from TASK-003.
9. **Request limits:** request bodies must be `application/json` (a charset
   parameter is allowed); other content types are rejected with `415`
   `unsupported_media_type`. Bodies whose declared `Content-Length` exceeds
   16 KB, or whose streamed body exceeds 16 KB, are rejected with `413`.
10. **Unexpected errors:** the handlers catch unexpected failures — including a
    cookie read/write failure in the POST handlers — and return a generic JSON
    `500` body, so the documented error shape is preserved. Errors carrying a
    Next.js control-flow `digest` are rethrown instead, so request-context
    signals are not swallowed. Error logging is sanitized: only the error name
    and the first message line are logged, with any `params:` portion removed,
    so bound query parameters (emails, password hashes) do not reach the log.

## Rationale

- A server-side session table enables revocation and avoids shipping a signing
  secret, unlike stateless tokens; it fits the Next.js App Router cookie model.
- Constraint-based duplicate handling is race-free and simpler than a
  check-then-insert.
- Keeping sensitive logic out of the HTTP layer (`src/lib/auth.ts`,
  `src/lib/session.ts`, `src/lib/validators.ts`, `src/lib/http.ts`) makes it
  testable against a throwaway database without a running Next.js server.

## Alternatives considered

- **Stateless JWTs** — deferred: revocation and key management are more work
  than a sessions table at this stage.
- **`Secure` cookie always** — rejected: it breaks local HTTP development.
- **Enforcing the password minimum on sign-in** — rejected: it would lock out
  the bootstrap admin, whose `ADMIN_PASSWORD` is set outside the sign-up policy.
- **Returning a richer user object (timestamps, etc.)** — rejected to keep the
  public shape minimal and avoid leaking internal fields.

## Consequences

- A new `sessions` table and migrations (`drizzle/0001_*.sql` and
  `0002_*.sql`, the latter adding an index on `sessions.user_id`); sessions are
  removed automatically with their user.
- Sessions expire after 30 days by default; `last_seen` is refreshed on each
  successful verification. Expired rows are not yet swept and `last_seen` is
  written on every authenticated request — performance follow-ups.
- Sign-in does not revoke a caller's existing sessions on re-authentication.
  This is accepted: session ids are server-generated (so it is not fixation),
  and it is documented rather than changed.
- The session cookie is set after the sign-up transaction commits. If the
  cookie write fails, the response is a JSON `500` but the account (and its
  session row) already exists, so a client retry of sign-up returns `409`
  `email_taken`. This is accepted: sign-up and `GET /api/me` are consistent, and
  the client recovers by signing in. Extending the transaction to cover the
  cookie write is not possible (cookies are outside the database transaction).
- The first unknown-email sign-in after process start performs two scrypt
  operations (creating the cached dummy hash, then verifying), while a
  known-email sign-in performs one. The one-time difference is accepted rather
  than eliminated by warming the hash at import time (which would add work to
  every process start); subsequent requests are equal work.
- The first-admin seed normalizes and validates `ADMIN_EMAIL`. A database seeded
  before this change may hold a non-normalized admin email; the seed returns
  early when an admin already exists, so it does not repair it. Run the
  documented one-time normalization (`update users set email = lower(trim(email))
  …` in `docs/local-database.md`) or re-seed.
- Rate limiting is not implemented; noted as a follow-up in the plan.
