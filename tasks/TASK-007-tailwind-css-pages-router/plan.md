# Technical Plan: Tailwind CSS on the Pages Router

- Status: approved
- Business goal reference: task.md
- Plan revision: draft-1 (2026-11-16)
- Approval:
  - status: approved
  - approved_by: user
  - approved_at: 2026-11-16
  - revision: draft-1

## Business goal reference

See `task.md`. The goal is to make Tailwind utility classes work on the
`/home` Pages Router page without changing the page's content or moving it to
the App Router, and to leave one CSS pipeline in the project.

## Current implementation (verified by inspection and commands)

- Next.js 16.4.3 with Turbopack, React 19.3.0, TypeScript 5, Tailwind CSS
  4.3.5.
- `src/app/layout.tsx` imports `./globals.css`; `src/app/globals.css` starts
  with `@import "tailwindcss";` and defines the theme via `@theme inline`.
- `postcss.config.mjs` (untracked, newly added by the user) configures
  `@tailwindcss/postcss`.
- `next.config.ts` also configures a custom Turbopack loader for `*.css`
  (`@tailwindcss/turbopack`), which is redundant with the PostCSS plugin.
- `src/pages/home.tsx` is a Pages Router page. There is no
  `src/pages/_app.tsx`, so the Pages Router never imports the global
  stylesheet.
- Observed with the dev server on port 3100:
  - `/` returns a 22.5 KB CSS chunk containing `.text-3xl`.
  - `/home` returns HTML with no `<link rel="stylesheet">` at all.
- Baseline checks:
  - `npm test`: 11 files, 103 tests passed.
  - `npm run lint`: passed.
  - `npm run format:check`: failed on `postcss.config.mjs` and
    `src/pages/home.tsx` (both pre-existing uncommitted user files).

## Proposed solution

1. Add `src/pages/_app.tsx` that imports `../app/globals.css`. This is the
   supported location for global CSS in the Pages Router. The `/home` page
   then receives the same Tailwind stylesheet as the App Router.
2. Remove the redundant `turbopack.rules["*.css"]` block from
   `next.config.ts`. Next.js 16 documents that Turbopack has built-in CSS and
   PostCSS support and does not need a loader for this.
3. Remove `@tailwindcss/turbopack` from `devDependencies` with
   `npm uninstall @tailwindcss/turbopack`.
4. Add automated tests:
   - `src/__tests__/pages/_app.test.tsx`: a config guard that reads
     `src/pages/_app.tsx` and asserts it imports `../app/globals.css`, and that
     the imported stylesheet contains `@import "tailwindcss"`.
   - `src/__tests__/pages/home.test.tsx`: renders the Home page and asserts the
     "Hello world!" heading.
   - Note: tests cannot live in `src/pages/`. The Pages Router treats every
     file with a page extension as a route, so `next build` tried to build
     `/_app.test` and `/_home.test` and failed on `node:fs`. The tests are
     therefore placed in `src/__tests__/pages/`, outside the Pages Router
     directory. This is a non-material correction to the approved plan (same
     scope and coverage, safer location).
5. Format the files touched by this task so `format:check` passes.

## Architecture and data flow

- The Pages Router entry point is `src/pages/_app.tsx`. It wraps every Pages
  Router page and imports the global CSS once per Pages Router build.
- The App Router keeps using `src/app/layout.tsx` and the same
  `src/app/globals.css`.
- Tailwind is processed by the PostCSS plugin configured in
  `postcss.config.mjs`. No custom Turbopack loader is involved.

## Files and modules to change

| File | Change | Reason |
| --- | --- | --- |
| `src/pages/_app.tsx` | New | Import the global Tailwind stylesheet for the Pages Router. |
| `src/__tests__/pages/_app.test.tsx` | New | Guard the global stylesheet import. |
| `src/__tests__/pages/home.test.tsx` | New | Render test for the Home page. |
| `next.config.ts` | Edit | Remove the redundant Turbopack CSS loader. |
| `package.json`, `package-lock.json` | Edit | Remove `@tailwindcss/turbopack`. |
| `postcss.config.mjs`, `src/pages/home.tsx` | Format only | Make `format:check` pass. |
| `tasks/README.md` | Edit | Register TASK-007 in the task index. |

## Data and API changes

None. No database, API, or data model changes.

## Implementation steps

1. Create `src/pages/_app.tsx` with the global CSS import.
2. Add the tests described above.
3. Remove the Turbopack CSS rule from `next.config.ts`.
4. Run `npm uninstall @tailwindcss/turbopack`.
5. Run `npm run format` to format the touched files.
6. Run the verification commands.

## Testing strategy

- Automated:
  - `src/__tests__/pages/_app.test.tsx` verifies the Pages Router imports the
    global stylesheet and that the stylesheet imports Tailwind.
  - `src/__tests__/pages/home.test.tsx` verifies the page renders its heading.
  - Full suite: `npm test`.
- Manual/integration:
  - Start `npm run dev` and request `/home`; confirm the response contains a
    stylesheet link and the emitted CSS contains `.text-3xl`, `.font-bold`,
    and `.underline`.
  - Request `/` and confirm the App Router CSS is still served.
- Quality gates: `npm run lint`, `npm run format:check`, `npm run build`.

## Security and failure handling

- No credentials or secrets are introduced.
- If the Pages Router refuses the global CSS import, fall back to moving the
  stylesheet to a neutral location (for example `src/styles/globals.css`) and
  update both imports. This is a contingency, not the planned path.
- If removing the Turbopack loader stops CSS generation, keep the loader and
  record the finding before proceeding. The expected result is that CSS still
  works through PostCSS.

## Risks and alternatives

- Risk: mixed routers can produce duplicate CSS bundles. This is acceptable
  for a single Pages Router page and is the user's chosen structure.
- Risk: the Pages Router does not receive the App Router's font variables.
  Recorded as a follow-up; not required for Tailwind utilities.
- Alternative: move the page to the App Router. Rejected by the user.

## Acceptance mapping

| Criterion | Implementation | Evidence |
| --- | --- | --- |
| AC1 | `src/pages/_app.tsx` imports the global CSS | Manual dev-server check of `/home` stylesheet and utility rules; config guard test |
| AC2 | App Router layout unchanged | Manual dev-server check of `/`; existing `src/app/page.test.tsx` |
| AC3 | Remove Turbopack rule and dependency | `next.config.ts`, `package.json`, `package-lock.json` inspection |
| AC4 | New tests and full suite | `npm test` |
| AC5 | Quality gates | `npm run lint`, `npm run format:check`, `npm run build` |

## Open questions and assumptions

- Assumption: the user wants to keep the Pages Router for `/home` (confirmed).
- Assumption: no font parity is required in this task (recorded as a
  follow-up).
- Open question: whether to add `_document.tsx` and font loading later. Not
  blocking.

## Approval status

Approved by the user on 2026-11-16 in the implementation conversation
("make these changes").
