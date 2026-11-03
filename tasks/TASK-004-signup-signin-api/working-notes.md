# Working Notes: Sign-up and sign-in API endpoints

Temporary notes about this task. Anything here is unverified unless it is
explicitly labeled as confirmed. Hypotheses and unverified assumptions are
not approved decisions, and nothing here changes the goal or acceptance
criteria in `task.md`.

## Findings

- Dependency check: TASK-003 `task.md` status is `done`, so the blocking
  dependency is satisfied and implementation was allowed (confirmed
  2026-11-03).
- Plan approval is valid: `plan.md` records `draft-1` approved by the user on
  2026-10-27, and `task.md` `plan_revision` is `draft-1` (match confirmed).
- TASK-004 has no recorded review findings yet (`review.md` status: not
  started), so this is a Mode A normal implementation, not a review-fix run.

## Implementation summary (2026-11-03)

Approved plan followed, with small, justified deviations recorded below.

Added:

- `src/db/schema.ts`: new `sessions` table (id uuid PK, user_id FK to
  `users.id` `ON DELETE CASCADE`, created_at, expires_at, last_seen, metadata
  jsonb).
- `drizzle/0001_salty_hedge_knight.sql` and `drizzle/meta/0001_snapshot.json`:
  generated with `npm run db:generate`.
- `src/lib/validators.ts`: `isValidEmail`, `normalizeEmail`,
  `validateSignUpInput`, `validateSignInInput`.
- `src/lib/session.ts`: `SESSION_COOKIE_NAME`, `DEFAULT_SESSION_TTL_MS`,
  `createSession`, `verifySession`, `clearSession`, `isSessionId`,
  `sessionCookieOptions`. Takes the database as an argument so it is testable
  without the shared pool.
- `src/lib/auth.ts`: `signUp`, `signIn`, `getCurrentUser` — the endpoint logic,
  independent of the HTTP layer.
- `src/lib/http.ts`: `json`, `malformedJsonResponse`, `parseJsonBody`.
- `src/app/api/signup/route.ts`, `src/app/api/signin/route.ts`,
  `src/app/api/me/route.ts`: thin route handlers that call `src/lib/auth.ts` and
  set/read the `session` cookie via `next/headers`.
- `src/lib/validators.test.ts` (unit) and `src/lib/auth.test.ts` (integration,
  throwaway database).
- `docs/decisions/0003-signup-signin-api-sessions.md` (ADR) and updates to
  `docs/README.md` and `docs/testing.md`.

## Justified deviations from the approved plan

- **Sign-in does not enforce the 8-character minimum.** The plan says "require
  email (basic format) and password (min 8 characters)". Applying the minimum
  on sign-in would lock out the bootstrap admin, whose password comes from
  `ADMIN_PASSWORD` outside the sign-up policy (the local `.env` uses a 7-char
  value). Sign-in therefore requires only a non-empty password; the stored
  scrypt hash is the source of truth. Not a scope change.
- **`Secure` cookie flag is production-only.** The plan says "HttpOnly Secure
  cookie". A `Secure` cookie is rejected by browsers over the local HTTP dev
  server, so the flag is enabled only when `NODE_ENV=production`; the flag
  remains `HttpOnly` and `SameSite=Lax` everywhere.
- **Extra small modules** (`src/lib/auth.ts`, `src/lib/http.ts`) were added to
  satisfy the plan's own testing strategy ("handler logic (mock DB)" and
  "integration tests ... assert DB rows and cookie behavior") without an
  additional test dependency; the alternative is untestable route handlers that
  depend on the Next.js request context.

## Checks executed (2026-11-03)

- `npm test` → 7 files, 58 tests, all passing (run three times to confirm
  stability). Database integration tests ran against the live local database
  (not skipped).
- `npm run lint` → no errors.
- `npm run format:check` → all files formatted.
- `npm run build` → success; `/api/signup`, `/api/signin`, `/api/me` built as
  dynamic routes.
- End-to-end HTTP smoke test against a throwaway database
  (`educator_smoke`, migrations applied, dev server on an alternate port):
  - sign-up valid → `201`, `Set-Cookie: session=...; Path=/; ...; HttpOnly;
    SameSite=lax`, body `{"user":{...}}` with no password field.
  - duplicate sign-up (same and case/whitespace-variant email) → `409`.
  - sign-in valid → `200` and a new session cookie; `GET /api/me` with the
    cookie → `200`; without → `401`.
  - wrong password and unknown email → identical `401 invalid_credentials`.
  - invalid input → `400` with field `details`; malformed JSON → `400`.
  - bootstrap admin (7-char password) → `200`.
  - database showed `password_hash` as `scrypt$...` (130 chars) for both users
    and three session rows. Throwaway database dropped afterwards.

## Unverified / notes

- `next dev` appends a generated `<!-- BEGIN:nextjs-agent-rules -->` block to
  `AGENTS.md`. It was reverted so the task diff stays clean; running `next dev`
  again re-creates it.
- `.env.example` was modified during this session (uncommenting `ADMIN_EMAIL` /
  `ADMIN_PASSWORD`) by an external process, not by this implementation. It is
  unrelated to TASK-004 and was left untouched.
- Not implemented (deferred, consistent with the plan): rate limiting, sweeping
  expired session rows, and a dummy hash on unknown-email sign-in to remove the
  timing side channel.

## Decisions needed

- None. The open questions in `task.md` were resolved by the approved `draft-1`
  plan (session cookies, 409 duplicates, password min 8, sessions table,
  minimal response shape).

## Useful references

- `tasks/TASK-003-user-accounts-schema-and-roles/` — users storage and roles
  this task depends on.
- `docs/decisions/0003-signup-signin-api-sessions.md` — the decisions above.
- `tasks/TASK-002-authorization/task.md` and
  `tasks/TASK-002-authorization/decomposition-plan.md` — parent epic and
  decomposition.

## Knowledge to preserve

- The auth logic lives in `src/lib/auth.ts` and session handling in
  `src/lib/session.ts`, separate from the route handlers, so it is unit- and
  integration-testable without a Next.js server. Preserve that boundary.

## Review-fix round (2026-11-03, Review 1)

Mode B (task status `review failed`). Review 1 recorded 9 findings (F-1–F-9).
The plan approval for `draft-1` remains the basis for the fixes below.

### Findings fixed

- **F-2 [Medium] (HTTP layer and cookie behaviour untested):** added
  `src/lib/session.test.ts` (cookie flags, production-only `Secure`,
  `isSessionId`), `src/lib/http.test.ts` (JSON parsing, 16 KB limit, error
  bodies), and `src/app/api/routes.test.ts` (status mapping, `Set-Cookie`
  attributes, `413`/`500` paths) using `next/headers` and the auth/db modules
  mocked. Added the `@/*` alias to `vitest.config.mts` so route handlers can be
  imported in tests.
- **F-4 [Low] (sign-in timing side channel):** `signIn` now runs an equivalent
  `verifyPassword` against a cached dummy hash when the email is unknown, so the
  unknown-email and wrong-password paths do comparable work.
- **F-5 [Low] (errors did not use the documented JSON shape):** added
  `serverErrorResponse()` (JSON `500`) and wrapped the auth/database calls in
  the handlers. `cookies()` is deliberately left outside the `try/catch` because
  Next.js uses its prerender rejection as control flow (catching it produced a
  `HANGING_PROMISE_REJECTION` log during `next build`).
- **F-6 [Low] (unbounded body):** `parseJsonBody` rejects a declared
  `Content-Length` over 16 KB with `413 payload_too_large`.
- **F-7 [Low] (misleading test name):** the "refreshes last_seen" test now reads
  `last_seen` before and after `verifySession` and asserts it advanced.
- **F-8 [Low] (session housekeeping):** added an index on `sessions.user_id`
  (migration `drizzle/0002_shocking_mantis.sql`). Throttling `last_seen` writes
  and sweeping expired rows are not implemented; recorded as follow-ups in ADR
  0003.
- **F-9 [Low] (sign-in leaves prior sessions):** documented as accepted in ADR
  0003 (ids are server-generated; `SameSite=Lax`), rather than changing
  behaviour.

### Findings NOT fixed — decision needed

- **F-1 [Medium] (email-normalization mismatch with the bootstrap admin):** the
  fix is to normalize `ADMIN_EMAIL` in the seed, which is in
  `src/db/migrate.ts` — a file owned by TASK-003 (status `done`) and carrying
  TASK-003's uncommitted changes. Editing it would change a completed task's
  delivered behaviour and mix into TASK-003's pending work. This needs a
  decision: either expand TASK-004's approved scope (via `/approve`) to include
  normalizing the seed, or handle it as a TASK-003 follow-up / new task. Not
  guessed or silently changed.
- **F-3 [Medium, process] (plan deviations not re-approved):** the sign-in
  password-minimum relaxation and the production-only `Secure` flag deviate from
  the approved `draft-1` text. The fixes are necessary (enforcing the minimum on
  sign-in would lock out the bootstrap admin; always-`Secure` would break the
  local HTTP dev server), so reverting is not viable. Resolving this needs
  renewed user approval — the user must run `/approve` with a `draft-2` that
  records both deviations (and, if chosen, the F-1 seed normalization). Until
  then the task stays `review failed`.

### Test-stability fix (not a review finding)

- `npm test` intermittently reported an unhandled `pg` error
  (`terminating connection due to administrator command`) during teardown of
  `src/db/schema.test.ts`: `drop database ... with (force)` can terminate an
  idle backend that `pool.end()` has not fully closed. Adding a no-op
  `pool.on("error", ...)` handler to both DB integration test files
  (`schema.test.ts` and `auth.test.ts`) removes the race. The change to
  `schema.test.ts` touches a TASK-003 file; it is test-only and
  behaviour-neutral, and it is required so the project's test command is
  deterministic. Recorded here for transparency.

### Checks executed (2026-11-03)

- `npm test` → 10 files, 76 tests, all passing. Before the stability fix, 5
  full-suite runs produced 1 unhandled teardown error; after the fix, 12
  consecutive full-suite runs produced 0 unhandled errors and 0 failures.
- `npm run lint` → no errors.
- `npm run format:check` → all files formatted.
- `npm run build` → success; no prerender/type errors; `/api/{signup,signin,me}`
  are dynamic routes.
- Diagnostic: the unhandled error appeared only when `src/db/schema.test.ts`
  ran with the full suite; excluding it was clean, confirming the flake was in
  `schema.test.ts`, not in TASK-004's tests.

### Decision needed (summary)

Run `/approve` for a `draft-2` covering: (a) sign-in not enforcing the 8-char
minimum, (b) the production-only `Secure` cookie flag, and (c) optionally the
F-1 fix scope (`src/db/migrate.ts`) — or direct that F-1 be handled as a
TASK-003 follow-up. Then `/implement` can finish F-1 and the task can return to
`review`.

## Review-fix round 2 (2026-11-03)

The user answered both open questions in the `/implement TASK-004` instruction:

- F-1: "apply normalization by default".
- F-3: "if NODE_ENV is not set -> NODE_ENV=development".

### F-1 implemented

- `src/db/migrate.ts`: `seedFirstAdmin` now normalizes `ADMIN_EMAIL` with
  `normalizeEmail` (trimmed, lower-cased) before inserting, so the seeded admin
  matches the emails the API stores/looks up.
- Tests added in `src/lib/auth.test.ts` (`seeded admin email normalization`):
  a mixed-case/whitespace `ADMIN_EMAIL` is stored lower-cased and the admin can
  sign in; and a differently-cased sign-up returns `409` instead of creating a
  duplicate.

### F-3 implemented

- `src/lib/session.ts`: `sessionCookieOptions` now computes
  `const isProduction = process.env.NODE_ENV === "production"` explicitly, so an
  unset `NODE_ENV` is treated as development and the cookie is not `Secure`
  (local HTTP keeps working); `Secure` is set only for `production`.
- `src/lib/session.test.ts`: the cookie test now also asserts that an unset
  `NODE_ENV` yields `secure: false`.

### Approval recorded (2026-11-03, round 3)

`/approve` recorded `draft-2` in `plan.md` and `task.md` (`plan_approved:
2026-11-03`, `plan_revision: draft-2`). `draft-2` covers the sign-in
password-minimum relaxation, the production-only `Secure` cookie flag (unset
`NODE_ENV` = development), the F-1 seed-normalization scope expansion, and the
review-fix hardening. F-1 and F-3 are therefore both implemented and consistent
with the approved plan; the task moved to `review`.

### Checks executed (2026-11-03, round 3)

- `npm test` → 10 files, 78 tests, all passing.
- `npm run lint` → no errors.
- `npm run format:check` → all files formatted.
- `npm run build` → success; no type or prerender errors.

## Review-fix round 4 (2026-11-03, plan draft-3)

Plan `draft-3` was approved and executed; the Review 2 findings (R2-F1–R2-F7)
are addressed.

- **R2-F1:** `seedFirstAdmin` now validates `ADMIN_EMAIL` with `isValidEmail`
  after normalizing and throws before hashing/inserting. Test added in
  `src/lib/auth.test.ts`: seeding `root@localhost` rejects and inserts no row.
- **R2-F2:** documented the one-time repair for databases holding a
  non-normalized admin email in ADR 0003 and `docs/local-database.md` (an
  `update users set email = lower(trim(email)) …` or a re-seed).
- **R2-F3:** `parseJsonBody` now reads the body as a stream capped at 16 KB (in
  addition to the `Content-Length` pre-check), so a chunked body is bounded
  too. Tests cover oversized bodies with and without `Content-Length`.
- **R2-F4:** new `src/lib/auth.timing.test.ts` (mocks `./password`) asserts
  `signIn` calls `verifyPassword` once with a `scrypt$…` dummy hash for an
  unknown email.
- **R2-F5:** the test pool `error` handler is now attached in `afterAll`
  (teardown only) in `src/db/schema.test.ts` and `src/lib/auth.test.ts`, so it
  no longer silences run-time errors. Note: the extra seed tests in
  `schema.test.ts` are TASK-003's, not TASK-004's (the Review 2 wording
  attributed them to TASK-004; only the `pool.on("error")` line was added by
  TASK-004).
- **R2-F6:** `signUp` now inserts the user and creates the first session inside
  one transaction; `src/lib/session.ts` exposes a minimal `SessionExecutor`
  type so a transaction satisfies it. Test forces the session insert to fail
  with a temporary CHECK constraint and asserts no orphan user row remains.
- **R2-F7:** `src/lib/auth.test.ts` asserts `sessions_user_id_idx` exists after
  migration (via `pg_indexes`).

### Checks executed (2026-11-03, round 4)

- `npm test` → 11 files, 83 tests, all passing.
- `npm run lint` → no errors.
- `npm run format:check` → all files formatted.
- `npm run build` → success; no type or prerender errors.
- Stability: 10 consecutive full-suite runs with parallel files → 0 unhandled
  errors, 0 failures (the scoped teardown handler still prevents the flake).

Accepted follow-ups (unchanged, not review findings): rate limiting,
expired-session sweep, `last_seen` write throttling, and prior-session
revocation on re-authentication (documented in ADR 0003).

## Review-fix round 5 (2026-11-03, plan draft-4)

Plan `draft-4` was approved and executed; the TASK-004 Review 3 findings
(R3-F2–R3-F5) are addressed.

- **R3-F3:** `getDummyPasswordHash` (`src/lib/auth.ts`) no longer caches a
  rejected promise — it clears the cache and rethrows, so a single
  `hashPassword` failure cannot make every later unknown-email sign-in return
  `500`. Test added in `src/lib/auth.timing.test.ts`: after a failed dummy-hash
  creation the next unknown-email sign-in recovers (`401`, `hashPassword`
  called twice).
- **R3-F2:** `src/lib/http.test.ts` now covers a request that declares
  `Content-Length: 10` but streams a body over 16 KB → `too_large` (exercises
  the streamed cap, not the header pre-check).
- **R3-F4:** `parseJsonBody` (`src/lib/http.ts`) now requires an
  `application/json` content type (charset parameters allowed) and rejects
  others with `415 unsupported_media_type`. Added `unsupportedMediaTypeResponse`
  and the `unsupported_media_type` reason; wired via `bodyErrorResponse`.
  Tests in `http.test.ts` (415 body/status, charset accepted) and
  `routes.test.ts` (`text/plain` POST → `415`).
- **R3-F5:** the sign-up and sign-in route handlers now keep the cookie
  read/set inside the JSON-error `try`, so a cookie failure returns the JSON
  `500`; an `isNextControlFlowError` guard rethrows Next.js control-flow
  signals. Test in `routes.test.ts`: a throwing cookie `set` → `500`
  `internal_error`. `/api/me` is unchanged (its `cookies()` stays outside the
  `try` for the documented prerender reason).
- **R3-F1 / R3-F6:** no TASK-004 code change — verified as TASK-003 items
  (advisory-lock seed work, `R3-4` reference, `schema.test.ts` seed tests);
  attribution recorded in `review.md` (Review 3).
- Updated the ADR (`docs/decisions/0003-...md`) to record the `415` decision.

### Checks executed (2026-11-03, round 5)

- `npx tsc --noEmit` → no type errors.
- `npm test` → 11 files, 89 tests, all passing.
- `npm run lint` → no errors.
- `npm run format:check` → all files formatted.
- `npm run build` → success; `/api/{signup,signin,me}` dynamic routes.
- Stability: 10 consecutive parallel full-suite runs → 0 unhandled errors,
  0 failures.
- Not re-run this round: the manual `npm run dev` end-to-end smoke test (the
  draft-4 changes are covered by the unit, route, and build checks).

## Review-fix round 6 (2026-11-03, plan draft-5)

Plan `draft-5` was approved and executed; the Review 4 findings (R4-F1–R4-F4,
all Low and test/documentation-only) are addressed. No behavior or API change.

- **R4-F1:** added `isNextControlFlowError` unit tests in
  `src/lib/http.test.ts` (a string `digest` → true; plain `Error`, `null`,
  `undefined`, a string, and a non-string `digest` → false) and a route test in
  `src/app/api/routes.test.ts` where the mocked cookie `set` throws an `Error`
  with `digest` and the handler rejects (rethrows) instead of returning `500`.
- **R4-F2:** documented the failed-cookie-write-after-commit edge in ADR 0003
  (a cookie failure returns `500` while the account/session exist; the client
  must sign in) — no code change.
- **R4-F3:** refreshed the `docs/testing.md` API/authentication bullets to list
  the `415` gate (including a missing header), the lying-`Content-Length` test,
  `isNextControlFlowError`, the cookie-failure `500` for sign-up and sign-in,
  the control-flow rethrow, and the dummy-hash cache-recovery test.
- **R4-F4:** added the sign-in cookie-failure `500` test and a
  missing-`Content-Type` → `415` test. Note: undici auto-sets
  `text/plain;charset=UTF-8` for string bodies, so the unit test for the
  truly-missing header uses a `Headers` stub, and the route-level test is named
  "returns 415 for a request without the JSON content type".

### Checks executed (2026-11-03, round 6)

- `npx tsc --noEmit` → no type errors.
- `npm test` → 11 files, 95 tests, all passing.
- `npm run lint` → no errors.
- `npm run format:check` → all files formatted.
- `npm run build` → success; `/api/{signup,signin,me}` dynamic routes.
- Stability: 8 consecutive parallel full-suite runs → 0 unhandled errors,
  0 failures.

## Review-fix round 7 (2026-11-03, Review 5)

Review 5 recorded two Low, test-only findings (R5-F1, R5-F2); the approved plan
is draft-5 and these are test corrections within its testing scope.

- **R5-F1:** the route-level `415` test for a missing `Content-Type` was
  mislabelled — a string body is sent as `text/plain` by the Fetch
  implementation. It now uses a streamed (`ReadableStream`) body via a new
  `jsonStreamRequest` helper and asserts `content-type` is `null` before the
  handler returns `415`.
- **R5-F2:** added a sign-in twin of the control-flow rethrow test (the mocked
  cookie `set` throws an `Error` with a string `digest`; the handler rejects).

### Checks executed (2026-11-03, round 7)

- `npx tsc --noEmit` → no type errors.
- `npm test` → 11 files, 96 tests, all passing.
- `npm run lint` → no errors.
- `npm run format:check` → all files formatted.
- `npm run build` → success; `/api/{signup,signin,me}` dynamic routes.
- Stability: 8 consecutive parallel full-suite runs → 0 unhandled errors,
  0 failures.

## Review-fix round 8 (2026-11-03, Review 6)

Review 6 recorded three Low findings (R6-F1–R6-F3). The approved plan is
draft-5; these are fixes within its intent.

- **R6-F1:** the 500 path no longer logs the raw error. Added
  `describeErrorForLog` (`src/lib/http.ts`) which keeps only the error name and
  the first message line with any `params:` portion removed; both POST handlers
  now log `describeErrorForLog(error)`. This prevents emails/password hashes
  bound to a failed Drizzle query from reaching the log (verified that
  `node_modules/drizzle-orm/errors.js` embeds `params: ${params}`). Unit test in
  `http.test.ts`; route test in `routes.test.ts` asserts a Drizzle-shaped error
  does not log `scrypt$` or the email.
- **R6-F2:** recorded the first-unknown-email-signin double-scrypt difference as
  an accepted edge in ADR 0003 (kept rather than warming the hash at import
  time). Note: `plan.md`'s accepted-edge list was not modified — plan content is
  owned by `/approve`; the ADR is the substantive record and the plan should be
  refreshed on the next `/approve` if the reviewer wants it there too.
- **R6-F3:** added sign-in route tests for `400` (malformed JSON), `415`
  (`text/plain`), and `413` (oversized body), mirroring the sign-up block.

### Checks executed (2026-11-03, round 8)

- `npx tsc --noEmit` → no type errors.
- `npm test` → 11 files, 102 tests, all passing.
- `npm run lint` → no errors.
- `npm run format:check` → all files formatted.
- `npm run build` → success; `/api/{signup,signin,me}` dynamic routes.
- Stability: 6 consecutive parallel full-suite runs → 0 unhandled errors,
  0 failures.

## Review-fix round 9 (2026-11-03, Review 7)

Review 7 recorded one Medium finding (R7-F1) and two Low notes (R7-F2–R7-F3).
The approved plan remains draft-5; the Medium item was a real logging gap in
`GET /api/me`, and the Low notes were documentation / test-quality items.

- **R7-F1:** `GET /api/me` now logs `describeErrorForLog(error)` instead of the
  raw error, matching the POST handlers. Added a route test that rejects with a
  `DrizzleQueryError` whose params include the session id and asserts the log
  output does not contain that credential.
- **R7-F3:** the error-logging unit test now uses a real `DrizzleQueryError`
  instead of a synthetic plain `Error`, so the Drizzle shape is exercised.
  `describeErrorForLog` comment now says the first-line cut removes the separate
  `params:` line.
- **R7-F2:** left unchanged. The accepted dummy-hash timing edge remains
  documented in ADR 0003; `plan.md` was not revised because that file is owned
  by `/approve`.

### Checks executed (2026-11-03, round 9)

- `npx tsc --noEmit` → no type errors.
- `npm run lint` → no errors.
- `npm run format:check` → all files formatted.
- `npm test` → 11 files, 103 tests, all passing.
- `npm run build` → success; `/api/{signup,signin,me}` dynamic routes.
