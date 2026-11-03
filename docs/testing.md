# Testing and validation

This document describes the project's validation commands: formatting, linting,
and tests. All commands are run with npm from the repository root.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run format` | Format the codebase with Prettier (writes changes). |
| `npm run format:check` | Check formatting without writing; fails if any code file is unformatted. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run the test suite once (Vitest, `vitest run`). |
| `npm run test:watch` | Run tests in watch mode while developing. |
| `npm run build` | Production build (also type-checks the project). |

Before sharing work, run at least `npm run format:check`, `npm run lint`, and
`npm test`.

## Requirements and installing

Node.js: the installed tooling needs more than Node 20.0. Recommended:
**Node 22.13 or newer**. Minimum per dependency:

- `@testing-library/jest-dom@7` requires Node `>=22`.
- `jsdom@29` requires Node `^20.19 || ^22.13 || >=24`.
- `@vitejs/plugin-react@6` requires Node `^20.19 || >=22.12`.

On Node 20.x below 20.19, or Node 22.0–22.11, expect engine warnings (and
jest-dom v7 is outside its declared range on Node 20).

The toolchain resolves from the committed `package-lock.json`, so a plain
`npm install` works for a fresh checkout. If the dependencies ever need to be
re-resolved from scratch, an npm resolver bug in this environment required
`npm install --legacy-peer-deps` plus an explicit
`npm install --save-dev @testing-library/dom`; that is only a fallback and is
not needed when installing from the committed lockfile.

## Formatting

Prettier formats JavaScript/TypeScript, JSON, YAML, and CSS. Configuration
lives in `.prettierrc.json`, and `.prettierignore` excludes build output,
lockfiles, and **Markdown** (documentation and task files are hand-wrapped
prose and are intentionally not reformatted).

ESLint is configured with `eslint-config-prettier/flat` (last in
`eslint.config.mjs`) so that ESLint does not enforce formatting rules that
would conflict with Prettier. Use `npm run lint` for code quality and
`npm run format` for style.

## Tests

Tests use [Vitest](https://vitest.dev) with React Testing Library and a `jsdom`
environment:

- Configuration: `vitest.config.mts`
- Setup file: `vitest.setup.ts` (adds `@testing-library/jest-dom` matchers)
- Test location: `src/**/*.{test,spec}.{ts,tsx}`

Example:

```
src/app/page.test.tsx
```

Notes:

- jsdom renders components in a simulated browser. React Server Components and
  async server components are not supported by React Testing Library; test
  client components or pure logic instead.
- `next/image` depends on the Next.js runtime; mock it in tests when needed
  (see `src/app/page.test.tsx`).

### Database tests

`src/db/schema.test.ts` is an integration test that runs against the local
PostgreSQL database (see `local-database.md`). It creates a throwaway database,
applies the migrations from `drizzle/`, and verifies the schema, the `role`
enum, email uniqueness, and the bootstrap-admin seed. The database and password
tests run in the Node environment. If `POSTGRES_PASSWORD` is not configured
(from `.env`), the database is unreachable, or `POSTGRES_HOST` is not loopback,
the tests are skipped with a reason — a skipped run is not a pass, so configure
`.env` and start the database (`docker compose up -d`) before relying on it.

### API and authentication tests

The sign-up/sign-in logic and the session helpers are split out of the route
handlers so they can be tested without a running Next.js server. The test
files map to areas as follows. Read the test titles for the exact cases; this
document does not enumerate them, and adding a test does not require a change
here.

| File | Area | Needs the database |
| --- | --- | --- |
| `src/lib/validators.test.ts` | Input validation | no |
| `src/lib/session.test.ts` | Session cookie attributes and session-id validation | no |
| `src/lib/http.test.ts` | JSON body parsing, size and content-type limits, error bodies, error-log sanitisation | no |
| `src/lib/auth.test.ts` | Sign-up, sign-in, current user, and session helpers against the real schema | yes (throwaway database) |
| `src/lib/auth.timing.test.ts` | Sign-in timing equalisation, with the password module mocked | no |
| `src/app/api/routes.test.ts` | Route handlers with `next/headers` and the auth/database modules mocked: status mapping, error shape, cookies | no |

`vitest.config.mts` mirrors the `@/*` path alias from `tsconfig.json` so tests
can import the route handlers directly.

Run these with `npm test`; the integration tests additionally need `.env`
configured and the local database running. To exercise the whole stack
including Next.js, run `npm run dev` and call the endpoints, for example:

```
curl -i -c jar.txt -H 'content-type: application/json' \
  -d '{"email":"user@example.com","password":"correct-horse"}' \
  http://127.0.0.1:3000/api/signup
curl -i -b jar.txt http://127.0.0.1:3000/api/me
```

## Expectations for tasks

Following the project workflow, new tasks that change behavior are expected to
include tests, and `/verify` requires all tests to pass before a task can be
completed.
