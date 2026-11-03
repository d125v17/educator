# Review: Sign-up and sign-in API endpoints

## Review 1 (2026-11-03, plan draft-1)

- Reviewer: `review` subagent (read-only)
- Commands run by the reviewer: none. The reviewer's session denied the shell
  tool, so `npm test`, `npm run lint`, `npm run format:check`, `npm run build`,
  and the allowlisted `git` inspection were all unavailable; findings come from
  reading the files directly. The implementer's recorded runs were not
  reproduced by the reviewer.
- Summary: The core design is sound and no critical or high defects were found.
  Duplicate handling uses the unique constraint with
  `ON CONFLICT DO NOTHING`; the sign-in error body is identical for unknown
  email and wrong password; the password hash is never serialized; the role is
  fixed to `user` server-side; session ids are UUID-validated before reaching
  Postgres; and the migration and journal entry are present. Three medium
  findings and six low findings were recorded; the medium findings require
  changes.

### F-1 — [Medium] Email normalization mismatch can lock out the bootstrap admin
- File: `src/db/migrate.ts:59-71` (seed stores `env.ADMIN_EMAIL` verbatim)
  versus `src/lib/auth.ts:143` and `src/lib/validators.ts:48-66` (sign-in and
  sign-up lowercase and trim).
- Problem: TASK-004 introduced lowercase normalization for lookups, but the
  TASK-003 seed never normalizes. The stored email and the lookup email can
  differ.
- Evidence: set `ADMIN_EMAIL=Admin@Example.com`, run the seed, then
  `POST /api/signin` with the same string: the lookup uses
  `admin@example.com`, finds no row, and returns 401 on every attempt.
  Separately, `POST /api/signup` with `admin@example.com` succeeds because the
  unique index is case-sensitive, creating a second account for the same
  mailbox.
- Fix: normalize in the seed with `normalizeEmail` (or compare on
  `lower(email)`), and add a test that seeds a mixed-case `ADMIN_EMAIL` and then
  signs in. Consider a one-time data check for existing rows.

### F-2 — [Medium] HTTP layer and cookie behaviour have no automated tests
- File: `src/app/api/{signup,signin,me}/route.ts`,
  `src/lib/session.ts:140-148` (`sessionCookieOptions`), `src/lib/http.ts`.
- Problem: The plan's testing strategy called for integration tests that
  "assert cookie behavior" and a security check that "cookie flags present".
  Nothing asserts `HttpOnly`, `SameSite=lax`, `Path=/`, `expires`, or the
  `Secure` toggle. Nothing tests 400 for malformed JSON, the `/api/me` 401 path,
  or status mapping. The only verification is the manual curl smoke test in
  `working-notes.md`, which is not reproducible in CI. This is a behaviour
  change without automated coverage.
- Evidence: change `httpOnly: true` to `false` in `sessionCookieOptions`, or
  change the status in `malformedJsonResponse`; `npm test` still passes.
- Fix: add a unit test for `sessionCookieOptions` covering the flags, and stub
  `NODE_ENV` to check `secure` in production. Add tests for `parseJsonBody` and
  `malformedJsonResponse`. Ideally add route-level tests that call `POST`/`GET`
  with `next/headers` mocked, to assert status codes and `Set-Cookie`
  attributes.

### F-3 — [Medium] (process) Approved-plan deviations were not re-approved
- File: `plan.md` (step 4 and the "Security, validation" section) versus
  `src/lib/validators.ts:113-146`, `src/lib/session.ts:134-148`, and the ADR.
- Problem: The approved draft-1 says "require … password (min 8 characters)"
  and "HttpOnly Secure SameSite cookie". The implementation relaxes the minimum
  for sign-in and makes `Secure` conditional on `NODE_ENV === "production"`.
  Both are documented in the ADR and working notes and are reasonable, but
  `AGENTS.md` §2 requires renewed user approval for a material change to an
  approved plan, and no such approval is recorded.
- Note: if a deployment runs in production over plain HTTP, or with `NODE_ENV`
  unset, session cookies are sent without `Secure` — a security-relevant
  default that depends on environment configuration.
- Fix: record a plan revision (`draft-2`) with user approval covering both
  deviations, or revert to the approved behaviour. Consider making `Secure` an
  explicit config flag rather than inferring it from `NODE_ENV`.

### F-4 — [Low] Sign-in timing side channel for unknown emails
- File: `src/lib/auth.ts:155-167`.
- Problem: For an unknown email the function returns before any scrypt work;
  for a known email it runs scrypt (tens of milliseconds). The response body is
  identical, but account existence is measurable. The plan asked to "avoid user
  existence leaks"; the ADR acknowledges and defers this.
- Fix: when `user` is missing, run `verifyPassword` against a fixed dummy hash
  before returning `invalid`.

### F-5 — [Low] Unexpected errors do not produce the documented JSON shape
- File: `src/app/api/*/route.ts` and `src/lib/auth.ts` (no try/catch around
  database calls or `hashPassword`).
- Problem: A database outage or a scrypt failure surfaces as Next's default 500
  page rather than the `{ error: { code, message } }` body the ADR promises.
- Fix: catch at the route level, log server-side, and return a generic 500 JSON
  body. Add a test with a stubbed database that throws.

### F-6 — [Low] Request body size is unbounded
- File: `src/lib/http.ts:20-28` (`parseJsonBody` calls `request.json()` with no
  size limit).
- Problem: A large body is read fully into memory before validation. The
  password length is capped at 200 characters, but the body is not.
- Fix: check `content-length` and reject bodies above a small limit (for
  example 16 KB) with 413 before parsing.

### F-7 — [Low] Test name claims an assertion that is not made
- File: `src/lib/auth.test.ts:341-352`.
- Problem: The test "verifySession returns the userId and refreshes last_seen"
  only asserts the returned user id; it never reads `last_seen`, so the refresh
  behaviour is untested.
- Fix: read `last_seen` before and after `verifySession` with a controlled `now`
  and assert it advanced, or rename the test.

### F-8 — [Low] Session housekeeping and write amplification
- File: `src/lib/session.ts:106-109` (an UPDATE on every verification, including
  each `/api/me` call); `src/db/schema.ts:39-52` (no index on `user_id`).
- Problem: Every authenticated request writes to `sessions`. The `user_id`
  foreign key has no index, so cascade deletes and per-user lookups scan the
  table. Expired rows are never removed (the ADR records this as a follow-up).
- Fix: throttle `last_seen` updates (for example only when older than a minute),
  add an index on `user_id`, and track a sweep task.

### F-9 — [Low] Sign-in does not revoke prior sessions
- File: `src/lib/auth.ts:169-170`.
- Problem: Signing in creates a new session but leaves any existing session
  cookie valid. This is not a fixation vulnerability because the id is
  server-generated, but old sessions stay alive after re-authentication. Login
  CSRF is only partly mitigated by `SameSite=Lax`.
- Fix: optionally delete the caller's previous session on sign-in, or document
  the accepted behaviour in the ADR.

### Plan deviations judged non-material
- Extracting `src/lib/auth.ts` and `src/lib/http.ts` is a reasonable
  architectural refinement that makes the logic testable without a Next.js
  server. It is recorded in the ADR and does not change behaviour. The
  test-coverage gap it leaves is captured by F-2.

### Acceptance criteria notes
- AC1 (sign-up creates `user` role): covered. `signUp` fixes the role
  server-side; an integration test asserts the DB row and a test verifies a
  client-supplied role is ignored.
- AC2 (sign-in authenticates an existing account): partly covered. Integration
  tests exist, but the HTTP status and cookie path are not automatically
  tested (F-2).
- AC3 (invalid input and wrong credentials rejected): covered. Validation and
  401 tests exist.
- AC4 (duplicate accounts handled consistently): covered for the API, with 409,
  case/whitespace variants, and the race-free constraint. The case mismatch with
  the seeded admin is F-1.
- AC5 (no plaintext passwords): covered. Tests assert the stored value is a
  hash and is not returned.
- AC6 (no secrets committed): covered for the TASK-004 paths; no hardcoded
  secrets found. `.env.example` is outside this task, as noted.

### Outcome
`review failed`. F-1 (a confirmed defect that can lock out the bootstrap admin
and permit a duplicate account), F-2 (a behavior change without automated test
coverage, including the cookie and HTTP layer), and F-3 (approved-plan
deviations not re-approved) each require a code, test, or plan change. The low
findings need no immediate action except F-7, which can be fixed while touching
the tests.

## Review 2 (2026-11-03, plan draft-2)

- Reviewer: `review` subagent (read-only)
- Commands run by the reviewer: none. Every shell call (including `npm test`,
  `npm run lint`, `npm run format:check`, `npm run build`, and the allowlisted
  read-only git commands) was denied by the permission system, so the reviewer
  could not reproduce the implementer's runs; findings come from reading the
  diff and source. This is an environment limitation of the reviewer session,
  not a task defect.
- Summary: No critical or high findings. The Review 1 items are resolved or are
  now explicitly accepted in the plan/ADR. One new Medium finding (R2-F1: the
  seed normalizes but does not validate `ADMIN_EMAIL`) and six Low findings were
  recorded. Findings below are numbered within this review (`R2-*`) because
  Review 1 already used `F-1…F-9`.

### R2-F1 — [Medium] The seed normalizes `ADMIN_EMAIL` but does not validate it
- File: `src/db/migrate.ts` (`seedFirstAdmin`) with `src/lib/validators.ts`
  (`EMAIL_PATTERN`, `isValidEmail`).
- Problem: the seed normalizes the admin email but never checks it against the
  API's email rules. A malformed `ADMIN_EMAIL` seeds an admin that can never
  sign in, and the seed still succeeds silently — the same failure class as the
  original F-1 lockout.
- Evidence: `ADMIN_EMAIL=root@localhost` passes `if (!email || !password)` and
  is inserted, but `validateSignInInput` rejects it because `EMAIL_PATTERN`
  requires a dot in the domain, so every sign-in attempt is `400`.
- Fix: after normalizing, call `isValidEmail(email)` in `seedFirstAdmin` and
  throw a clear error before hashing/inserting. Add a test seeding a malformed
  `ADMIN_EMAIL` (for example `root@localhost`) that expects rejection.

### R2-F2 — [Low] Existing mixed-case admin rows are not repaired
- File: `src/db/migrate.ts` (`seedFirstAdmin` early return when an admin
  exists).
- Problem: the normalization fix only applies when the seed inserts. A database
  seeded before this change keeps its mixed-case email; the seed returns early,
  so nothing repairs it — sign-in with the normalized address still fails and a
  differently-cased sign-up can duplicate the admin. Review 1 suggested a
  one-time data check; draft-2 does not mention it.
- Fix: either add a documented one-time normalization step
  (`update users set email = lower(trim(email))` with a duplicate check), or
  record in the ADR/`docs/` that existing databases must be repaired/re-seeded
  manually. Add a test if implemented in code.

### R2-F3 — [Low] The body limit only checks a declared `Content-Length`
- File: `src/lib/http.ts` (`parseJsonBody`).
- Problem: a chunked request without `Content-Length` is read by
  `request.json()` with no bound, so Review 1's F-6 concern is not fully closed.
  (Draft-2 explicitly chose declared-length enforcement, so this is an accepted
  limitation.)
- Fix: record the residual risk in ADR 0003 and the plan, or read the body
  through a counting reader with a 16 KB cap; add a test for the
  no-`Content-Length` case either way.

### R2-F4 — [Low] The dummy-hash timing path has no test
- File: `src/lib/auth.test.ts`.
- Problem: the F-4 fix (unknown-email sign-in performs `verifyPassword` against
  the cached dummy hash) is a security behavior change with no test; removing
  the call would not fail anything.
- Fix: add a test that mocks `./password` (or spies) and asserts
  `verifyPassword` is called for an unknown email with a `scrypt$` formatted
  hash.

### R2-F5 — [Low] `pool.on("error")` in `src/db/schema.test.ts` is broad
- File: `src/db/schema.test.ts` (TASK-003 file, test-only).
- Problem: the teardown-flake fix was judged acceptable in scope, with caveats:
  the listener silences every pool error for the whole suite (not just
  teardown), and TASK-004 seed tests were added to this TASK-003 file.
- Fix: scope the listener to the teardown phase (attach just before
  `drop database`); note the cross-task test additions in the TASK-004 record.

### R2-F6 — [Low] `signUp` inserts the user and session in separate statements
- File: `src/lib/auth.ts` (`signUp`) and `src/app/api/signup/route.ts`.
- Problem: the user insert and session insert are not one transaction; if the
  session insert fails, the response is `500` while the account exists, so a
  retry returns `409 email_taken` for an account with no session.
- Fix: wrap both inserts in one transaction, or document the edge case.

### R2-F7 — [Low] No test asserts the `sessions_user_id_idx` index exists
- File: `src/db/schema.ts` / `drizzle/meta/0002_snapshot.json`.
- Problem: the F-8 fix depends on the index, but nothing verifies it is present
  after migration.
- Fix: add a `schema.test.ts` assertion against `pg_indexes` for
  `sessions_user_id_idx`.

### Review 1 findings re-checked
- F-1 (seed casing): resolved for new seeds (`normalizeEmail` + tests). The
  residual validation/data-migration gaps are recorded above as R2-F1/R2-F2.
- F-2 (HTTP/cookie tests): resolved (`routes.test.ts`, `session.test.ts`).
- F-3 (process): resolved — plan draft-2 records the deviations and approval;
  ADR 0003 matches.
- F-4 (timing): implemented; test gap recorded as R2-F4.
- F-5 (JSON 500): resolved and tested.
- F-6 (body size): partly resolved; residual gap recorded as R2-F3.
- F-7 (`last_seen`): resolved.
- F-8 (index/write amplification): index added; throttling/sweeping deferred
  per plan/ADR — not a finding.
- F-9 (prior sessions): accepted and documented in ADR 0003 — not a finding.

### Acceptance criteria notes
- AC1 (sign-up creates `user` role): covered (integration + client-role test).
- AC2 (sign-in authenticates an existing account): covered (integration tests,
  including the pre-existing short-password admin), subject to R2-F1/R2-F2 for
  mis-seeded/mixed-case admins.
- AC3 (invalid input and credentials rejected): covered (validators + 400/401 +
  route tests).
- AC4 (duplicate accounts handled consistently): covered (409, case/whitespace
  variants, race-free constraint); the seed-related duplication gap is R2-F2.
- AC5 (no plaintext passwords): covered.
- AC6 (no secrets committed): covered for the TASK-004 paths.

### Outcome
`review failed`. R2-F1 (a confirmed defect that can seed an admin unable to
sign in, in the same class as the original F-1) requires a code and test change.
The remaining R2 findings are Low and need no action except as noted; several
are documentation/follow-up items. No critical or high issues were found.

## Review 3 (2026-11-03, plan draft-3)

- Reviewer: `review` subagent (read-only)
- Commands run by the reviewer: `npm test` (passed — 11 files, 83 tests, 0
  skipped), `npm run lint` (passed), `npm run format:check` (passed),
  `npm run build` (passed), and read-only `git status`/`git diff`/`git diff
  --stat`. `git ls-files --others` was blocked after several calls. No manual
  `npm run dev` smoke test.
- Summary: No critical or high findings. All seven Review 2 items (R2-F1–R2-F7)
  are resolved in code and tests, except that a seed change the reviewer saw in
  the diff is not in the draft-3 plan. One Medium and five Low findings were
  recorded (R3-F1–R3-F6). Findings are numbered within this review (`R3-*`).

### R3-F1 — [Medium] Seed advisory-lock/transaction and its concurrency test are not in the draft-3 plan
- File: `src/db/migrate.ts` (`ADMIN_SEED_LOCK_KEY`, `pg_advisory_xact_lock`)
  and the plan record.
- Problem (as raised): `seedFirstAdmin` runs in a transaction guarded by
  `pg_advisory_xact_lock`, and `schema.test.ts` has a concurrency test for it;
  neither is in draft-3's file list (which names only the `isValidEmail`
  change). The code comment cites "(see R3-4)", but no R3-4 exists in the
  TASK-004 artifacts, so it looks like an unrecorded scope change.
- Evidence: `grep` for `advisory|R3|lock` under
  `tasks/TASK-004-signup-signin-api/` finds no record.
- Note (verification by the parent command): this is a **TASK-003** change, not
  TASK-004. `R3-4` is a real finding in
  `tasks/TASK-003-user-accounts-schema-and-roles/review.md` ("Admin seed
  check-then-insert is not atomic"), recorded in TASK-003's `plan.md` and
  `working-notes.md`, and the advisory lock and its `schema.test.ts` concurrency
  test were already present in the working tree before TASK-004 began. So it is
  a cross-task attribution, not a TASK-004 plan deviation. No TASK-004 code
  change is required; the reviewer asked that the decision be recorded, which
  this note does.
- Fix: none for TASK-004 (TASK-003 owns it). Optionally TASK-003 records the
  reference; TASK-004 already records the attribution in `working-notes.md`.

### R3-F2 — [Low] No test for a body whose `Content-Length` is within the limit but whose streamed body is not
- File: `src/lib/http.test.ts`; `src/lib/http.ts` (`parseJsonBody`,
  `readBodyWithLimit`).
- Problem: the streamed cap is exercised only when there is no
  `Content-Length` (or an oversized header). A request that declares a small
  `Content-Length` but streams more would return `too_large`, yet no test would
  fail if the streamed check were removed.
- Evidence: the oversized tests either declare an oversized length or send no
  header, so the "lying header" path is untested.
- Fix: add a test with a request-like object that reports a small
  `Content-Length` but streams a body over the cap.

### R3-F3 — [Low] The cached dummy password hash is poisoned if `hashPassword` rejects
- File: `src/lib/auth.ts` (`getDummyPasswordHash`, used in `signIn`).
- Problem: `dummyPasswordHash ??= hashPassword(...)` caches the promise. If
  `hashPassword` rejects once, the rejected promise is cached forever, so every
  later unknown-email sign-in rejects and returns `500` until the process
  restarts. (Also, the first unknown-email request in a process runs two scrypt
  operations — a small timing oracle.)
- Evidence: reading `getDummyPasswordHash`; `??=` keeps the rejected promise.
- Fix: clear the cache on rejection (for example
  `hashPassword(...).catch((error) => { dummyPasswordHash = undefined; throw error; })`),
  or warm the hash at module load; add a test that the cache recovers after a
  rejected hash.

### R3-F4 — [Low] `Content-Type` is not checked
- File: `src/lib/http.ts` (`parseJsonBody`).
- Problem: a `text/plain` cross-site form POST with a JSON-shaped body is
  accepted. `SameSite=Lax` limits the cookie side of login CSRF; the reviewer
  judges this a hardening gap rather than a confirmed bug.
- Fix: reject non-`application/json` bodies with `415` (and add a route test),
  or document the decision in ADR 0003.

### R3-F5 — [Low] `cookies()`/`cookieStore.set` in sign-up/sign-in sit outside the error handling
- File: `src/app/api/signup/route.ts`, `src/app/api/signin/route.ts`.
- Problem: those calls are outside the `try` that returns the JSON `500`. A
  failure there would return Next's default 500 after the account/session was
  created. (In `/api/me` the call is deliberately outside the `try` to let the
  Next.js prerender rejection propagate, and it is commented as such.)
- Fix: move the cookie code inside the error handling, or add an explanatory
  comment as in `/api/me`, or document the edge case.

### R3-F6 — [Low] Cross-task attribution note
- File: `working-notes.md`; `src/db/schema.test.ts`.
- Problem (as raised): the working notes say the extra seed tests in
  `schema.test.ts` are TASK-003's, but the reviewer could not verify that from
  the uncommitted diff and could not confirm the `git ls-files` split.
- Note (verification by the parent command): confirmed correct — the seed tests
  (`creates exactly one admin and is idempotent`, `skips without admin env…`,
  `serializes concurrent seeds…`) and the advisory-lock behavior they cover were
  present in `src/db/schema.test.ts` before TASK-004 began and belong to
  TASK-003's uncommitted work. TASK-004's only change to that file is the
  teardown-scoped `pool.on("error")` handler (R2-F5).
- Fix: none required; the attribution is recorded here.

### Acceptance criteria notes
- AC1 (`user` role): covered (`ignores a client-supplied role`, integration).
- AC2 (sign-in): covered (`authenticates an existing account…`,
  `authenticates a pre-existing account with a short password`).
- AC3 (invalid input / credentials): covered (validators, `auth.test.ts`,
  `routes.test.ts`).
- AC4 (duplicates): covered (409, case/whitespace variants, unique constraint).
- AC5 (no plaintext): covered (`never returns the password or its hash`).
- AC6 (no secrets): covered (env-driven `ADMIN_*`; no hardcoded credentials in
  the TASK-004 files).

### Outcome
`review failed`. R3-F3 is a confirmed (low-severity) defect — a cached rejected
dummy-hash promise that would make unknown-email sign-in return `500` until
restart — and R3-F2 is a test gap; both require a change. R3-F1 and R3-F6 are
cross-task attribution notes (verified as TASK-003's, not TASK-004 defects);
R3-F4 and R3-F5 are Low hardening/documentation items. No critical or high
findings were raised.

## Review 4 (2026-11-03, plan draft-4)

- Reviewer: `review` subagent (read-only)
- Commands run by the reviewer: none. Every shell call was denied
  (`permission.rejected`), so `npm test`, `npm run lint`, `npm run
  format:check`, `npm run build`, and the allowlisted `git` inspection could
  not run; the findings come from reading source, tests, and docs. This is a
  reviewer-session limitation, not a task defect (the implementer's recorded
  runs were not independently reproduced by the reviewer).
- Summary: No critical or high findings. The draft-4 changes for R3-F2, R3-F3,
  R3-F4, and R3-F5 are implemented in code with tests, and R3-F1/R3-F6 need no
  TASK-004 change. Four Low findings were recorded (R4-F1–R4-F4), all about
  test/doc coverage of the new draft-4 behavior. The reviewer noted it did not
  find a draft-4 behavior change without any test.

### R4-F1 — [Low] The `isNextControlFlowError` rethrow guard is untested
- File: `src/lib/http.ts` (`isNextControlFlowError`) and
  `src/app/api/{signup,signin}/route.ts`.
- Problem: the control-flow rethrow guard is a draft-4 behavior change, but no
  test exercises it; the route tests only throw plain `Error`s. Removing the
  guard would not fail the suite.
- Evidence: delete the `if (isNextControlFlowError(error)) throw error;` branch
  in either route → `npm test` still passes.
- Fix: add a unit test for `isNextControlFlowError` (an object with a string
  `digest` → true; plain `Error`, `null`, and a non-string `digest` → false),
  and a route test where the mocked cookie `set` throws an object with
  `digest: "…"` and the handler rejects rather than returning `500`.

### R4-F2 — [Low] A failed cookie write after account creation is undocumented
- File: `src/app/api/signup/route.ts`; `docs/decisions/0003-...md` item 10.
- Problem: the cookie step runs after the sign-up transaction commits. If the
  cookie write fails, the response is `500` but the account and a session row
  exist; a retry returns `409 email_taken`. This edge is the same class as
  R2-F6, and the atomicity fix does not cover the cookie step; neither the plan
  nor ADR 0003 says so.
- Evidence: make `cookieStore.set` throw after a successful `signUp` → `500
  internal_error`; a second sign-up with the same email → `409`.
- Fix (documentation, no code change required): state the consequence in ADR
  0003 item 10 and the plan's accepted-edge notes ("a failed cookie write after
  account creation returns `500`; the account exists, so the client must sign
  in"). Optionally assert the `500` in `routes.test.ts`.

### R4-F3 — [Low] `docs/testing.md` is out of date for the draft-4 tests
- File: `docs/testing.md` ("API and authentication tests").
- Problem: the section omits the `415` path, the cookie-failure `500`, the
  `isNextControlFlowError` rethrow, the lying-`Content-Length` test, and the
  dummy-hash cache-recovery test.
- Evidence: compare the bullets with the test titles in `http.test.ts`,
  `routes.test.ts`, and `auth.timing.test.ts`.
- Fix: update the bullets to list the draft-4 coverage (`AGENTS.md` §8 applies).

### R4-F4 — [Low] Two narrow route-test gaps
- File: `src/app/api/routes.test.ts`.
- Problem: (a) the cookie-failure `500` is tested only for sign-up, though both
  routes changed; (b) the `415` path is tested only with `text/plain`, not with
  a missing `Content-Type` header (the `hasJsonContentType` null branch).
- Evidence: removing `if (!contentType) return false;` or the sign-in cookie
  `try` wrapper fails no test.
- Fix: add a sign-in cookie-failure `500` test and a no-`Content-Type` request
  expecting `415`.

### Acceptance criteria notes
- AC1–AC6 remain covered as in Review 3 (sign-up `user` role; sign-in;
  invalid-input/credential rejection; duplicates; no plaintext; no secrets).
  The draft-4 changes do not weaken them; fixtures use literal test passwords
  only. Coverage is unchanged except for the narrow branches in R4-F1/R4-F4.

### Outcome
`review failed`. R4-F1 is a draft-4 behavior branch (the control-flow rethrow
guard) with no test, and R4-F3 requires a documentation update (`AGENTS.md`
§8); R4-F2 and R4-F4 are Low test/documentation items. All findings are Low —
no critical or high issues and no unmet acceptance criterion were found.

## Review 5 (2026-11-03, plan draft-5)

- Reviewer: `review` subagent (read-only)
- Commands run by the reviewer: `npm test` (passed — 11 files, 95 tests, no
  skips, so the database integration suites ran), `npm run lint` (passed),
  `npm run format:check` (passed), `npm run build` (passed), and `git status
  --short` plus `git diff` on `src/db/schema.test.ts`, `src/db/migrate.ts`,
  `vitest.config.mts`, and `drizzle/meta/_journal.json`. The shell was
  intermittently denied on a few compound calls; the remaining files were read
  with the file tools.
- Summary: No critical or high findings. The draft-5 items R4-F1–R4-F4 are
  substantially addressed (R4-F2 and R4-F3 fully; R4-F1 and R4-F4 partly). Two
  Low test-coverage findings were recorded (R5-F1, R5-F2). Acceptance criteria
  AC1–AC6 remain covered and no hardcoded secrets were found.

### R5-F1 — [Low] The route-level "no Content-Type" test is mislabelled and duplicates the `text/plain` case
- File: `src/app/api/routes.test.ts` ("returns 415 for a request without the
  JSON content type").
- Problem: the test builds `new Request(url, { method, body: JSON.stringify(…) })`
  with no headers. A string body makes the Fetch implementation set
  `Content-Type: text/plain;charset=UTF-8`, so the request does have a content
  type and the test duplicates the `text/plain` case. The header-absent branch
  (`hasJsonContentType` → `if (!contentType) return false`) is not exercised at
  route level, contrary to draft-5 item 21.
- Evidence: the header-absent branch can be deleted without a route-level test
  failing; the `http.test.ts` stub would still catch it.
- Fix: give the route test a body that does not auto-set a content type (for
  example a `ReadableStream`) and assert the header is `null` before calling
  the handler, or rename the test to reflect `text/plain`.

### R5-F2 — [Low] The control-flow rethrow guard is tested only for sign-up
- File: `src/app/api/signin/route.ts` (control-flow rethrow branch);
  `src/app/api/routes.test.ts`.
- Problem: the R4-F1 rethrow test exists only for `POST /api/signup`. The
  identical guard in the sign-in route has no test, yet `docs/testing.md` lists
  the rethrow as covered for the route handlers in general.
- Evidence: delete `if (isNextControlFlowError(error)) throw error;` from
  `signin/route.ts`; `npm test` still passes.
- Fix: add a sign-in twin of the rethrow test, or narrow the `docs/testing.md`
  wording to say the sign-up route.

### Draft-5 items re-checked
- R4-F1: addressed for sign-up (`http.test.ts` + `routes.test.ts`); sign-in
  untested (R5-F2).
- R4-F2: addressed — ADR 0003 documents the failed-cookie-write edge; the plan
  accepted-edge note matches.
- R4-F3: addressed — `docs/testing.md` lists the `415` (incl. missing header),
  the 16 KB cases, `isNextControlFlowError`, the dummy-hash cache recovery, and
  the cookie-failure `500` for both routes.
- R4-F4: partly addressed — the sign-in cookie-failure `500` test exists; the
  missing-header `415` is covered in `http.test.ts` but not at route level
  (R5-F1).

### Acceptance criteria notes
- AC1–AC6: covered (server-side `user` role; uniform `401`; scrypt hashes only
  and `password_hash` never serialized; 16 KB limit declared and streamed;
  atomic sign-up with orphan-rollback test; `sessions_user_id_idx` present and
  asserted; seed `ADMIN_EMAIL` normalized/validated). The `DUMMY_HASH` and
  literal test passwords are fixtures, not credentials.
- Not a finding: `409` on duplicate email allows enumeration; it is an approved
  draft-1 default and was not presented as mitigated.

### Outcome
`review failed`. R5-F2 is a behavior branch (the sign-in control-flow rethrow)
with no test, and R5-F1 is a mislabelled/duplicative route test; both require a
small test change. All findings are Low — no critical or high issues and no
unmet acceptance criterion were found.

## Review 6 (2026-11-03, plan draft-5)

- Reviewer: `review` subagent (read-only)
- Commands run by the reviewer: only `git status --short` and `git diff --stat`
  succeeded; `npm test`, `npm run lint`, `npm run format:check`, and `npm run
  build` were denied (`permission.rejected`) even when retried, so the passing
  results are unverified by this review. Findings come from reading the source,
  tests, migrations, journal, and docs.
- Summary: No critical or high findings. Both Review 5 fixes are in place
  (R5-F1 uses a `ReadableStream` body and asserts a null `Content-Type`; R5-F2
  adds the sign-in rethrow twin). Three Low findings were recorded
  (R6-F1–R6-F3). AC1–AC6 remain covered; docs and draft-5 items are consistent
  with the code.

### R6-F1 — [Low] The 500 path logs a raw Drizzle error that can contain bound parameters
- File: `src/app/api/signup/route.ts` (the `console.error("POST /api/signup
  failed", error)` call).
- Problem: the sign-up insert binds `email` and `passwordHash`. In the installed
  drizzle-orm, `DrizzleQueryError` embeds the bound parameters in its message
  (`Failed query: … \nparams: ${params}`), so a database failure during sign-up
  writes the email and the scrypt hash to the server log. The hash is not
  plaintext, so AC5 is not violated, but it is credential-derived material that
  should not reach logs.
- Evidence: `node_modules/drizzle-orm/errors.js` lines 12–13 build the message
  with `params: ${params}`; `src/lib/auth.ts` inserts `{ email, passwordHash,
  role: "user" }`. *(Verified by the parent command with `grep`.)*
- Fix: log a sanitized value on the error path (for example the error `name`
  plus a stable code, or a message with the `params` portion redacted), and add
  a route test where the mocked `signUp` rejects with a message containing a
  hash-like string, asserting `console.error` does not receive it.

### R6-F2 — [Low] The first-request dummy-hash timing difference is not recorded as an accepted edge
- File: `src/lib/auth.ts` (`getDummyPasswordHash`); plan/ADR/working-notes.
- Problem: the first unknown-email sign-in after process start runs two scrypt
  operations (create the dummy hash, then verify), while a known email runs one.
  R3-F3 addressed only the cache-rejection case; the one-time difference is not
  recorded as an accepted edge anywhere.
- Evidence: `getDummyPasswordHash` is called only on the unknown-email path; the
  recovery test shows `hashPassword` runs before `verifyPassword`.
- Fix: warm the dummy hash at module load, or record the one-time first-request
  difference as an accepted edge in ADR 0003 and the plan.

### R6-F3 — [Low] `POST /api/signin` has no route-level 400/413/415 tests
- File: `src/app/api/routes.test.ts` (sign-in describe block).
- Problem: the sign-in route has no route-level tests for `400`, `413`, or
  `415`; its `parseJsonBody` → `bodyErrorResponse` wiring is covered only
  indirectly through the shared `http.test.ts` unit tests. The sign-up route
  tests all three, and `docs/testing.md` describes the `400`/`413`/`415` shape
  as covered for the route handlers in general.
- Evidence: the sign-in block contains only the `200`, `401`, `500`, cookie-500,
  and rethrow tests.
- Fix: add sign-in twins of the malformed-JSON, `text/plain` → `415`, and
  oversized-body tests from the sign-up block.

### Acceptance criteria notes
- AC1–AC6: covered (server-side `user` role; uniform `401`; scrypt hashes only
  and `password_hash` never serialized; 16 KB limit declared and streamed;
  atomic sign-up with orphan-rollback test; `sessions_user_id_idx` present and
  asserted; seed `ADMIN_EMAIL` normalized/validated). Fixtures only.
- The TASK-003 `schema.test.ts` teardown-scoped `pool.on("error")` handler is
  acceptable as a test-only change.

### Outcome
`review failed`. R6-F1 is a confirmed data-handling issue (the 500 path can log
the email and scrypt hash) that requires a logging change and a test; R6-F3 is a
sign-in route-test gap; R6-F2 is a Low documentation item. All findings are Low
— no critical or high issues and no unmet acceptance criterion were found.

## Review 7 (2026-11-03, plan draft-5)

- Reviewer: `review` subagent (read-only)
- Commands run by the reviewer: none. The shell tool was denied for every call
  (including `npm test`, `npm run lint`, `npm run format:check`, `npm run
  build`, and all `git` commands), so the implementer's recorded runs are not
  reproduced by this review; findings come from reading the source, tests,
  migrations, and docs with the file/grep tools.
- Summary: No critical or high findings. R6-F1 is fixed for sign-up and sign-in,
  R6-F2 is recorded in ADR 0003, and R6-F3 is fixed. One new Medium finding was
  recorded (R7-F1: the `/api/me` route still logs the raw error), plus two Low
  findings (R7-F2, R7-F3). AC1–AC6 remain covered.

### R7-F1 — [Medium] `GET /api/me` still logs the raw error, which can include the session id
- File: `src/app/api/me/route.ts:33`
  (`console.error("GET /api/me failed", error)`).
- Problem: the R6-F1 sanitized logging was applied only to the POST routes.
  `/api/me` still logs the whole error object. `getCurrentUser` → `verifySession`
  runs `select … where sessions.id = $1 and expires_at > $2` and an `update …
  where sessions.id = $n`; a `DrizzleQueryError` embeds the bound parameters
  (`params:` line), so the **session id** — the bearer credential in the
  `session` cookie — can be written to the log. Anyone with log access could
  replay a still-valid session. This contradicts ADR 0003 item 10, which claims
  bound parameters "do not reach the log".
- Evidence: `grep` shows `/api/me` still uses the raw `error` while the POST
  routes use `describeErrorForLog` (verified by the parent command). The
  `GET /api/me` route tests cover only a plain `database down` 500, so nothing
  catches it.
- Fix: log `describeErrorForLog(error)` in `/api/me` too, and add a
  `GET /api/me` route test (mirroring the sign-up R6-F1 test) that asserts the
  session id does not appear in `console.error` output.

### R7-F2 — [Low] The R6-F2 accepted edge is in the ADR but not in the plan
- File: `tasks/TASK-004-signup-signin-api/plan.md` (accepted-edge notes).
- Problem: R6-F2 was recorded in ADR 0003 and `working-notes.md`, but the plan's
  accepted-edge list still names only R4-F2 (the cookie edge). `plan.md` is
  owned by `/approve`.
- Evidence: the plan's accepted-edge note lists only R4-F2; ADR 0003 (item 10
  consequences) has the dummy-hash edge.
- Fix: decide whether a one-line plan revision is needed (route through
  `/approve`), or record that ADR 0003 is the authoritative record for this
  edge. The reviewer notes a documentation-only accepted edge probably does not
  need renewed approval.

### R7-F3 — [Low] The log-sanitization tests use a synthetic error, not a real `DrizzleQueryError`
- File: `src/lib/http.test.ts`; `src/app/api/routes.test.ts`.
- Problem: the tests build a plain `Error` whose message mimics the Drizzle
  format; they would still pass if Drizzle changed its message format, and the
  real error class is not exercised. Also, the `params:` split in
  `describeErrorForLog` never matches the real two-line format — the first-line
  truncation is what removes params — so the code comment overstates the split.
- Evidence: the installed `DrizzleQueryError` message is
  `Failed query: ${query}\nparams: ${params}`.
- Fix (optional): construct a real `DrizzleQueryError` if the installed
  drizzle-orm exposes it, or adjust the comment to say the first-line cut
  removes the params.

### Review 6 findings re-checked
- R6-F1: fixed for sign-up and sign-in (`describeErrorForLog`); `/api/me`
  missed — R7-F1.
- R6-F2: recorded in ADR 0003 and `working-notes.md`; not in the plan — R7-F2.
- R6-F3: fixed (sign-in 400/413/415 route tests).

### Acceptance criteria notes
- AC1–AC6: covered (server-side `user` role; uniform `401`; scrypt hashes only
  and `password_hash` never serialized; 16 KB limit declared and streamed;
  atomic sign-up with orphan-rollback test; `sessions_user_id_idx` present and
  asserted; seed `ADMIN_EMAIL` normalized/validated). Fixtures only; no
  hardcoded secrets.
- The TASK-003 `schema.test.ts` teardown-scoped `pool.on("error")` handler is
  acceptable as a test-only change.

### Outcome
`review failed`. R7-F1 is a Medium (confirmed) data-handling issue: the
`/api/me` 500 path can log the session id, a bearer credential, contradicting
the ADR's logging claim. It requires a code change and a test. R7-F2 and R7-F3
are Low documentation/test-quality items. No critical findings and no unmet
acceptance criterion were found.

## Review 8 (2026-11-03, plan draft-5)

- Reviewer: `review` subagent (read-only)
- Commands run by the reviewer: none. The reviewer session could not run shell
  commands, so `npm test`, `npm run lint`, `npm run format:check`, `npm run
  build`, and `git` inspection were unavailable; findings come from reading the
  source, tests, migrations, and docs.
- Summary: No critical or high findings. Review 7’s Medium item is fixed, and
  the previous log-sanitization test-quality note no longer applies. Four Low
  items remain: a raw-error log in the seed script, a missing sign-in log-redact
  regression test, a documentation gap in `docs/testing.md`, and a plan-vs-ADR
  mismatch for the dummy-hash timing edge. AC1–AC6 remain covered.

### F-1 — [Low] The seed script still logs the raw error
- File: `src/db/migrate.ts:107-112`
- Problem: `main()` still does `console.error(error)`. The seed insert binds
  `email` and `passwordHash`, and Drizzle query errors embed bound parameters in
  their message, so a failed seed can print the scrypt hash to the terminal or
  logs.
- Evidence: `src/db/migrate.ts:83-87` inserts `{ email, passwordHash, role: "admin" }`.
  `node_modules/drizzle-orm/errors.js` formats query failures as `Failed query:
  ...\nparams: ...`. `main()` still logs the raw error object.
- Fix: sanitize the seed-path logging, for example by reusing
  `describeErrorForLog(error)`, and add a regression test for a seed failure.

### F-2 — [Low] Sign-in lacks the log-redaction regression test
- File: `src/app/api/routes.test.ts:277-416`
- Problem: the new log-redaction test covers sign-up and `/api/me`, but the
  sign-in route also now uses sanitized logging and has no regression test for
  it.
- Evidence: the sign-in block has 200, 401, malformed JSON, 415, 413, 500,
  cookie-failure, and control-flow tests, but no assertion that a Drizzle-style
  failure does not leak the email/hash to `console.error`.
- Fix: add a sign-in twin of the sign-up log-redaction test.

### F-3 — [Low] `docs/testing.md` does not mention the log-redaction coverage
- File: `docs/testing.md:85-112`
- Problem: the API/auth testing section lists the status, cookie, and control-flow
  coverage but not the new log-sanitization behavior in `http.test.ts` and the
  route tests.
- Evidence: `docs/testing.md` still mentions `400`/`413`/`415`/`500` coverage and
  cookie behavior, but not error-log redaction.
- Fix: add a short bullet noting the `describeErrorForLog` unit test and the
  route-level log-redaction tests.

### F-4 — [Low] The dummy-hash timing edge is documented in the ADR but not the plan
- File: `tasks/TASK-004-signup-signin-api/plan.md` (accepted-edge notes)
- Problem: the plan still mentions only the cookie-write edge, while ADR 0003 now
  also records the first-unknown-email sign-in double-scrypt edge. The ADR is
  authoritative, but the plan is no longer fully aligned with it.
- Evidence: ADR 0003 item 10 and the consequences section document the accepted
  timing edge; the plan’s accepted-edge notes do not.
- Fix: either route a one-line plan revision through `/approve` or explicitly
  note that ADR 0003 is the canonical record for the edge.

### Acceptance criteria notes
- AC1: covered — sign-up still assigns `user` server-side.
- AC2: covered — sign-in still authenticates existing users.
- AC3: covered — invalid inputs and wrong credentials still map to the
  documented JSON errors; the new findings are ancillary logging/docs issues.
- AC4: covered — duplicate handling remains consistent via `409`.
- AC5: covered — passwords remain hashed and are not returned.
- AC6: covered — no credentials or secrets are hardcoded; the low finding is
  about logging, not committed secrets.

### Outcome
`review failed`. F-1 is a confirmed logging issue in the seed script, F-2 is a
missing regression test, F-3 is a docs gap, and F-4 is a plan/documentation
alignment issue. All are Low, but they require changes.
