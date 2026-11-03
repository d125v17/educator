# Technical Plan: Sign-up and sign-in API endpoints

- Status: approved
- Business goal reference: task.md (child of epic TASK-002 — Authorization)
- Plan revision: draft-5 (2026-11-03)
- Approval:
  - status: approved
  - approved_by: user
  - approved_at: 2026-11-03
  - revision: draft-5
  - revision_history:
    - draft-1 (2026-10-27): approved by user via `/approve` with the
      recommended defaults (session cookies, 409 for duplicates, password
      minimum length 8, server-side sessions table, minimal response shape).
    - draft-2 (2026-11-03): renewed approval. Records changes decided after
      the first independent review (findings F-1 and F-3) and the review-fix
      hardening:
      - Sign-in does not enforce the sign-up password minimum; the stored hash
        is the source of truth, so the bootstrap admin and other pre-existing
        accounts can authenticate.
      - The session cookie sets `Secure` only when `NODE_ENV === "production"`;
        an unset `NODE_ENV` is treated as development (local HTTP dev).
      - Scope expanded to normalize `ADMIN_EMAIL` in TASK-003's
        `src/db/migrate.ts` seed, so seeded emails match the API's email
        normalization (fixes F-1).
      - Review-fix hardening: `sessions.user_id` index; a 16 KB JSON request
        body limit; a JSON `500` shape for unexpected errors; equivalent scrypt
        work (dummy hash) on unknown-email sign-in; auth/HTTP logic extracted
        into `src/lib/auth.ts` and `src/lib/http.ts` for testability.
    - draft-3 (2026-11-03): renewed approval. Adds the remediation plan for the
      second independent review (Review 2, findings R2-F1–R2-F7):
      - R2-F1 (Medium): validate `ADMIN_EMAIL` in the seed so a malformed value
        cannot silently seed an admin that can never sign in.
      - R2-F2 (Low): document the one-time repair for databases already holding
        a non-normalized admin email.
      - R2-F3 (Low): bound the request body by a streamed 16 KB cap, not only a
        declared `Content-Length`.
      - R2-F4 (Low): test the unknown-email dummy-hash path.
      - R2-F5 (Low): scope the test pool `error` handler to teardown.
      - R2-F6 (Low): make sign-up atomic (user + session in one transaction).
      - R2-F7 (Low): assert the `sessions_user_id_idx` index exists after
        migration.
    - draft-4 (2026-11-03): renewed approval. Adds the remediation plan for the
      third independent review (Review 3, findings R3-F1–R3-F6):
      - R3-F3 (Low, confirmed defect): reset the cached dummy-hash promise on
        rejection so a single `hashPassword` failure cannot make unknown-email
        sign-in return `500` until restart; add a cache-recovery test.
      - R3-F2 (Low): test a request whose declared `Content-Length` is within
        the limit but whose streamed body exceeds it.
      - R3-F4 (Low): reject non-`application/json` bodies with `415`.
      - R3-F5 (Low): move the cookie read/set inside the sign-up/sign-in error
        handling so a cookie failure returns the documented JSON `500` (with a
        control-flow rethrow guard).
      - R3-F1 (Medium) and R3-F6 (Low): cross-task attribution notes for
        TASK-003 (the advisory-lock seed work, its `R3-4` reference, and the
        `schema.test.ts` seed tests). No TASK-004 code change.
    - draft-5 (2026-11-03): renewed approval. Adds the remediation plan for the
      fourth independent review (Review 4, findings R4-F1–R4-F4), all Low and
      test/documentation-only:
      - R4-F1: add tests for the `isNextControlFlowError` guard — a unit test
        plus a route test where the mocked cookie `set` throws an error carrying
        a string `digest` (asserting the handler rejects rather than returning a
        `500`).
      - R4-F2: document the failed-cookie-write-after-commit edge in ADR 0003
        and in the accepted-edge notes (no code change).
      - R4-F3: update `docs/testing.md` for the draft-4/draft-5 test coverage
        (`415`, the cookie-failure `500`, the control-flow rethrow, the
        lying-`Content-Length` test, and the dummy-hash cache-recovery test).
      - R4-F4: add the sign-in cookie-failure `500` test and a request with no
        `Content-Type` header expecting `415`.

## Business goal reference

See `task.md` for the business problem, desired outcome, scope, and
acceptance criteria. This plan must not change the original business goal.

Goal: provide API endpoints to let a person sign up and sign in; new accounts
are created with the `user` role; authentication is implemented securely and
consistently so client code can rely on documented responses.

## Current implementation

This task depends on TASK-003, which provides the `users` table, `role`
enum, and `src/lib/password.ts` (scrypt hashing). The project has Vitest and
validation tooling from TASK-006.

Implementation status at draft-5: the endpoints, session helpers, validators,
tests, migrations, and documentation are implemented; the prior reviews'
findings were addressed (draft-2 through draft-4). The third review (Review 3,
plan draft-3) recorded R3-F1–R3-F6 (R3-F1/R3-F6 being TASK-003 attribution
issues); its TASK-004 findings were addressed by draft-4. A fourth independent
review (Review 4, plan draft-4) found no critical/high issues and recorded four
Low, test/documentation-only findings (R4-F1–R4-F4). This revision adds their
remediation.

## Proposed solution

- Authentication mechanism: server-side sessions stored in a `sessions` table,
  with an opaque session id in an `HttpOnly` cookie. This provides easy
  revocation and works well with the Next.js App Router.
- Password hashing: reuse `src/lib/password.ts` (scrypt) implemented in
  TASK-003.
- Duplicate-account behavior: reject sign-up with `409 Conflict`, enforced by
  the `users.email` unique constraint, so concurrent requests cannot both
  succeed.
- Validation: `email` must be a basic, well-formed address and is normalized
  (trimmed, lower-cased) for storage and lookup. Sign-up requires a password of
  8–200 characters. Sign-in requires only a non-empty password (the sign-up
  minimum is not applied on sign-in). Request bodies must be
  `application/json` (draft-4, R3-F4).
- API style: JSON REST endpoints under `src/app/api/` (App Router route
  handlers):
  - `POST /api/signup`
  - `POST /api/signin`
  - `GET /api/me` (returns the authenticated user)

## Architecture and data flow

Client → `POST /api/signup` → server handler:
- read and validate input (reject non-JSON content types with `415`, malformed
  JSON, and bodies over 16 KB — declared or streamed);
- hash password with scrypt;
- in one transaction: insert the user with role `user` and create a session row
  (draft-3, R2-F6); the insert uses `INSERT ... ON CONFLICT DO NOTHING
  RETURNING` (empty result ⇒ `409`);
- set the session cookie; a cookie failure returns the JSON `500`
  (draft-4, R3-F5);
- respond `201` with the sanitized user object (id, email, role).

Client → `POST /api/signin` → server handler:
- read and validate input;
- fetch user by normalized email;
- on unknown email, perform equivalent scrypt work against a cached dummy hash
  so timing does not reveal account existence (the cache is reset if the hash
  cannot be created — draft-4, R3-F3);
- verify the password via the scrypt helper;
- on success create a session and cookie, respond `200` with the user;
- on failure respond `401` with `invalid_credentials` (same body for unknown
  email and wrong password).

`GET /api/me`:
- read the session cookie;
- resolve it to a user via the `sessions` table;
- respond `200` with the user, or `401` when there is no valid session.

Session storage (server-side): `sessions` table with columns `id` (uuid primary
key), `user_id` (uuid references `users.id`, `ON DELETE CASCADE`),
`created_at`, `expires_at`, `last_seen`, `metadata` (jsonb), plus an index on
`user_id`. The cookie carries only the session id; handlers verify the session
by querying the table via Drizzle. Sessions default to a 30-day lifetime and
`last_seen` is refreshed on each successful verification.

Cookie attributes: `HttpOnly`, `SameSite=Lax`, `Path=/`, and an `expires`
matching the session. `Secure` is set only when `NODE_ENV === "production"`; an
unset `NODE_ENV` is treated as development.

Error shape: success is `{ "user": { "id", "email", "role" } }`; errors are
`{ "error": { "code", "message", "details"? } }`. Statuses: `400` invalid
request, `401` invalid credentials / unauthenticated, `409` duplicate email,
`413` payload too large, `415` unsupported media type (draft-4),
`500` unexpected error. The password hash is never serialized.

## Files and modules to change

Existing (draft-1/draft-2):

- `src/db/schema.ts` — the `sessions` table and the `user_id` index.
- `drizzle/0001_*.sql`, `drizzle/0002_*.sql` (+ `drizzle/meta/`) — generated
  migrations for the `sessions` table and the `user_id` index.
- `src/db/migrate.ts` — normalize `ADMIN_EMAIL` in the first-admin seed.
- `src/lib/session.ts` — session create/verify/clear helpers and cookie options.
- `src/lib/validators.ts` — email/password input validators.
- `src/lib/auth.ts` — core sign-up/sign-in/current-user logic.
- `src/lib/http.ts` — JSON response helpers, body parsing, size limit.
- `src/app/api/{signup,signin,me}/route.ts` — thin route handlers.
- Tests: `src/lib/validators.test.ts`, `src/lib/session.test.ts`,
  `src/lib/http.test.ts`, `src/lib/auth.test.ts`, `src/app/api/routes.test.ts`.
- `vitest.config.mts` — mirror the `@/*` alias for tests.
- `docs/decisions/0003-signup-signin-api-sessions.md`, `docs/README.md`,
  `docs/testing.md`.

Added by draft-3 (Review 2 remediation):

- `src/db/migrate.ts` — validate `ADMIN_EMAIL` with `isValidEmail` (R2-F1).
- `src/lib/http.ts` — streamed, 16 KB-capped body read (R2-F3).
- `src/lib/auth.ts` — wrap sign-up user + session creation in one transaction;
  `src/lib/session.ts` — accept a minimal executor type so a transaction
  satisfies it (R2-F6).
- `src/lib/auth.test.ts` — malformed-`ADMIN_EMAIL` rejection test (R2-F1), the
  `sessions_user_id_idx` presence test (R2-F7), and an atomic-sign-up test
  (R2-F6).
- `src/lib/http.test.ts` — oversized body without `Content-Length` (R2-F3).
- New `src/lib/auth.timing.test.ts` — asserts the unknown-email dummy-hash
  `verifyPassword` call (R2-F4).
- `src/db/schema.test.ts`, `src/lib/auth.test.ts` — scope the test pool `error`
  handler to teardown (R2-F5).
- `docs/decisions/0003-signup-signin-api-sessions.md`, `docs/local-database.md`
  — document the one-time repair for existing non-normalized admin emails
  (R2-F2).

Added by draft-4 (Review 3 remediation):

- `src/lib/auth.ts` — reset the cached dummy-hash promise on rejection
  (R3-F3).
- `src/lib/http.ts` — an `application/json` content-type gate returning `415`
  (R3-F4), and an `isNextControlFlowError` guard (R3-F5).
- `src/app/api/signup/route.ts`, `src/app/api/signin/route.ts` — wire the
  `415` path (R3-F4) and move the cookie read/set inside the error handling
  (R3-F5).
- `src/lib/auth.timing.test.ts` — dummy-hash cache-recovery test (R3-F3).
- `src/lib/http.test.ts` — lying-`Content-Length` streamed-cap test (R3-F2)
  and the `415` body/status test (R3-F4).
- `src/app/api/routes.test.ts` — `text/plain` → `415` and a throwing cookie
  `set` → `500` (R3-F4, R3-F5).
- `docs/decisions/0003-signup-signin-api-sessions.md` — record the `415` and
  cookie error-handling decisions.

Added by draft-5 (Review 4 remediation, tests and docs only):

- `src/lib/http.test.ts` — unit tests for `isNextControlFlowError` (a string
  `digest` → true; plain `Error`, `null`, non-string `digest` → false) and a
  no-`Content-Type` request → `415` (R4-F1, R4-F4).
- `src/app/api/routes.test.ts` — a route test where the cookie `set` throws an
  error carrying a string `digest` and the handler rejects (R4-F1), plus a
  sign-in cookie-failure `500` test (R4-F4).
- `docs/decisions/0003-signup-signin-api-sessions.md` — document the
  failed-cookie-write-after-commit edge (R4-F2).
- `docs/testing.md` — refresh the API/authentication test bullets (R4-F3).

## Data, API, configuration, and dependency changes

- Data: `sessions` table (with a `user_id` index); no changes to `users` beyond
  the fields from TASK-003. The seed normalizes and validates `ADMIN_EMAIL`.
- API: JSON endpoints as described; the body-size limit is enforced for bodies
  without a `Content-Length` (draft-3, R2-F3), and non-JSON content types are
  rejected with `415` (draft-4, R3-F4).
- Config: none new; reuse the DB environment variables from TASK-003.
- Dependencies: none beyond what TASK-003 added (Drizzle/`pg`).

## Implementation steps

1. Add the `sessions` table to `src/db/schema.ts`; generate `drizzle/0001_*.sql`.
2. Implement `src/lib/session.ts`, `src/lib/validators.ts`, `src/lib/auth.ts`,
   and `src/lib/http.ts`.
3. Implement the three route handlers.
4. Add tests (unit + integration + route-level).
5. Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build`.
6. Update `docs/testing.md`, `docs/README.md`, and add ADR 0003.
7. (draft-2) Add the `sessions.user_id` index (`drizzle/0002_*.sql`) and
   normalize `ADMIN_EMAIL` in `src/db/migrate.ts`, with tests.
8. (draft-3, R2-F1) Validate `ADMIN_EMAIL` in `seedFirstAdmin` with
   `isValidEmail`; throw a clear error before hashing/inserting; add a rejection
   test for a malformed value (for example `root@localhost`).
9. (draft-3, R2-F3) Bound the request body: keep the `Content-Length`
   pre-check, and read the stream with a 16 KB cap that returns `too_large`
   once exceeded, then parse; add tests with and without `Content-Length`.
10. (draft-3, R2-F6) Make sign-up atomic: wrap the user insert and session
    creation in one `database.transaction`; adjust the session helper's
    executor type; add a test asserting no orphan user row when session
    creation fails.
11. (draft-3, R2-F4, R2-F7) Add tests: the unknown-email dummy-hash
    `verifyPassword` call, and the `sessions_user_id_idx` presence check.
12. (draft-3, R2-F5) Scope the test pool `error` handler to teardown in both
    database integration test files.
13. (draft-3, R2-F2) Document the one-time repair for existing non-normalized
    admin emails in ADR 0003 and `docs/local-database.md`.
14. (draft-4, R3-F3) Reset the cached dummy-hash promise on rejection in
    `src/lib/auth.ts`; add a cache-recovery test in `src/lib/auth.timing.test.ts`
    (mock `hashPassword` to reject once, then assert a later unknown-email
    sign-in recovers).
15. (draft-4, R3-F2) Add a test in `src/lib/http.test.ts` for a small declared
    `Content-Length` with an over-limit streamed body → `too_large`.
16. (draft-4, R3-F4) Add the `application/json` content-type gate, the
    `unsupported_media_type` reason, and `unsupportedMediaTypeResponse()`
    (`415`); wire the handlers; add tests in `http.test.ts` and
    `routes.test.ts`.
17. (draft-4, R3-F5) Move the cookie read/set inside the `try` in the
    sign-up/sign-in routes; add the `isNextControlFlowError` guard in
    `src/lib/http.ts`; add a route test where the mocked cookie `set` throws →
    `500` JSON. Keep `/api/me` as documented (its `cookies()` stays outside the
    `try` for the prerender reason).
18. (draft-4) Update ADR 0003 with the `415` and cookie error-handling
    decisions.
19. Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build`
    again.
20. (draft-5, R4-F1) Add `isNextControlFlowError` unit tests in
    `src/lib/http.test.ts` and a route test where the cookie `set` throws an
    error carrying a string `digest` (asserting the handler rejects).
21. (draft-5, R4-F4) Add the sign-in cookie-failure `500` test and a
    no-`Content-Type` → `415` test in `src/app/api/routes.test.ts` and
    `src/lib/http.test.ts`.
22. (draft-5, R4-F2, R4-F3) Document the failed-cookie-write-after-commit edge
    in ADR 0003 and refresh the `docs/testing.md` API/authentication bullets.
23. Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build`
    again.

## Testing strategy

- Unit tests: validators; session cookie attributes and session-id validation;
  HTTP body parsing, the 16 KB limit (declared, streamed, and lying-header —
  draft-4), the `415` path (including a missing `Content-Type` — draft-5),
  `isNextControlFlowError` (draft-5, R4-F1), and error bodies.
- Integration tests: run `signUp`/`signIn`/`getCurrentUser` and the session
  helpers against a throwaway database (created and migrated like TASK-003's
  tests), asserting DB rows, duplicate handling, wrong-password flows, session
  expiry/clear, cascade deletion, seed email normalization and validation
  (R2-F1), atomic sign-up (R2-F6), and the `user_id` index (R2-F7).
- Unit tests with mocks: the unknown-email dummy-hash path and its
  cache-recovery behavior (`vi.mock` of `./password` with a stub database)
  (R2-F4, R3-F3).
- Route-handler tests: status mapping, the JSON error shape (including
  `413`/`415`/`500`), the cookie-failure `500` for both sign-up and sign-in
  (draft-4 R3-F5, draft-5 R4-F4), the control-flow rethrow branch
  (draft-5, R4-F1), and `Set-Cookie` attributes with `next/headers` mocked.
- Manual/end-to-end: run `npm run dev` and call the endpoints (documented in
  `docs/testing.md`).
- Security checks: password never returned; cookie flags present; identical
  `401` for unknown email and wrong password.

## Security, validation, error handling

- Passwords: scrypt via `src/lib/password.ts`; never stored or returned in
  plain text.
- Sessions: opaque server-side id in an `HttpOnly`, `SameSite=Lax` cookie;
  `Secure` only in production; ids are UUID-validated before querying.
- Sign-in: unknown email and wrong password return the same `401`; the
  unknown-email path performs equivalent scrypt work (dummy hash) to reduce a
  timing side channel, and the dummy hash cache recovers from a creation
  failure so sign-in cannot get stuck returning `500` (draft-4, R3-F3).
- Validation: basic email format with normalization on requests **and** the
  seeded `ADMIN_EMAIL` (draft-3, R2-F1); sign-up password 8–200 characters;
  sign-in requires a non-empty password; request bodies must be
  `application/json` (`415` otherwise — draft-4, R3-F4); JSON bodies over 16 KB
  are rejected with `413`, including bodies without a declared `Content-Length`
  (draft-3, R2-F3).
- Errors: consistent JSON error bodies, including a generic `500` shape; a
  cookie read/write failure in the POST handlers also returns the JSON `500`
  (draft-4, R3-F5), with a rethrow guard for Next.js control-flow signals.
- Consistency: sign-up creates the account and its session atomically, so a
  session failure cannot leave an orphan account (draft-3, R2-F6).
- Accepted edge (documented, draft-5, R4-F2): the session cookie is set after
  the sign-up transaction commits, so a failed cookie write returns `500` while
  the account (and its session row) exists; the client must sign in rather than
  retry sign-up.

## Risks, alternatives, rollback

- Alternative auth: stateless JWTs were deferred; a session table enables
  revocation and needs no signing secret.
- Rollback: removing the endpoints requires removing the handlers and
  reversing the migrations.
- Draft-3 risk: the transaction executor typing in `createSession` may need a
  small structural type; if awkward, fall back to documenting the narrow
  partial-failure edge case. (Resolved in draft-3.)
- Draft-3 risk: the streamed body read must still parse normal JSON correctly
  and not regress the route tests.
- Draft-4 risk: the R3-F3 cache-recovery test depends on isolating module
  state (`vi.resetModules()` + dynamic import); if flaky, assert recovery at
  the function level.
- Draft-4 risk: the `isNextControlFlowError` guard relies on a string `digest`
  property; if that proves brittle, keep `cookies()` outside the `try` in the
  POST handlers too and document it. (draft-5 adds a test that pins the guard's
  behavior.)
- Draft-5 risk: none material — the revision is tests and documentation only.
- Follow-ups (not in scope): rate limiting; sweeping expired session rows;
  throttling `last_seen` writes; revoking a caller's prior sessions on
  re-authentication (documented as accepted in ADR 0003).

## Acceptance mapping

AC1: Sign-up creates user with `user` role → `/api/signup` inserts role `user`
(integration test asserts DB; a test ignores a client-supplied role).

AC2: Sign-in authenticates existing account → `/api/signin` verifies scrypt and
creates a session (integration test asserts `200` + session; a test authenticates
the pre-existing admin with a short password). Seed email normalization and
validation keep the seeded admin sign-in-able (F-1, R2-F1).

AC3: Invalid input and wrong credentials rejected → validators + `400`/`401`
responses (negative tests, route tests), including a rejected malformed
`ADMIN_EMAIL` at seed time (R2-F1) and rejected non-JSON content types
(`415` — draft-4, R3-F4).

AC4: Duplicate accounts handled consistently → unique-constraint insert + `409`
(integration test asserts `409`, including case/whitespace variants; the seed
normalization prevents duplicating the admin).

AC5: Passwords never stored/returned plaintext → `password_hash` only;
responses do not include the password (tests assert this).

AC6: No secrets committed → no secrets in the repo; the admin seed remains
env-driven (TASK-003).

## Open questions and assumptions

- Assumptions: TASK-003 is available and the database is reachable locally;
  Node >=22 and the validation tooling from TASK-006 are present. The
  `sessions` table migration applies via the TASK-003 Drizzle setup.
- Resolved by draft-1: server-side sessions table, reject duplicates with `409`,
  minimal JSON response.
- Resolved by draft-2: sign-in does not enforce the sign-up password minimum;
  `Secure` is production-only (unset `NODE_ENV` = development); the F-1 seed
  normalization is in scope.
- Resolved by draft-3: the Review 2 remediation approach. R2-F2 is resolved by
  documentation (a one-time repair SQL), not by an automatic data migration.
- Resolved by draft-4: implement `415` for non-JSON content types (R3-F4,
  rather than document-only); make R3-F5 a code change (move the cookie
  read/set inside the error handling). R3-F1/R3-F6 are TASK-003 attribution
  notes and need no TASK-004 code change.
- Resolved by draft-5: R4-F1–R4-F4 are all Low and test/documentation-only —
  no behavior or API change. R4-F2 is documented as an accepted edge (no code
  change).
- Accepted follow-ups (not findings): rate limiting; expired-session sweep;
  `last_seen` write throttling; prior-session revocation on re-authentication.

## Approval status

This plan (draft-5) is approved by the user on 2026-11-03 and is ready for the
implementation phase to be finalized.
