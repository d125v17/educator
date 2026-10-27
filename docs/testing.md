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
(from `.env`) or the database is unreachable, the tests are skipped with a
message — a skipped run is not a pass, so configure `.env` and start the
database (`docker compose up -d`) before relying on it.

## Expectations for tasks

Following the project workflow, new tasks that change behavior are expected to
include tests, and `/verify` requires all tests to pass before a task can be
completed.
