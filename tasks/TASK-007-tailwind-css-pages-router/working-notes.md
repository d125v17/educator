# Working Notes: Tailwind CSS on the Pages Router

Temporary notes for TASK-007. Unverified assumptions are labeled as such and
are not approved decisions.

## Findings

- Verified: `/` (App Router) serves a CSS chunk that contains `.text-3xl`.
- Verified: `/home` (Pages Router) serves HTML with no stylesheet link at all.
- Verified: `src/pages/home.tsx` exists and there is no `src/pages/_app.tsx`.
- Verified: `next.config.ts` contains a `turbopack.rules["*.css"]` loader for
  `@tailwindcss/turbopack`, in addition to `postcss.config.mjs`.
- Verified: the Next.js 16 documentation states that Turbopack has built-in
  CSS/PostCSS support and does not need a custom loader for Tailwind.
- Verified: `npm test` passes (11 files, 103 tests) and `npm run lint` passes.
- Verified: `npm run format:check` fails on `postcss.config.mjs` and
  `src/pages/home.tsx`, both pre-existing uncommitted user files.

## Hypotheses

- The Pages Router page is unstyled because the Pages Router never imports
  `src/app/globals.css`. Adding `_app.tsx` should fix it. (Confirmed during
  implementation verification.)
- The custom Turbopack loader is redundant and can be removed without breaking
  CSS. (Confirmed during implementation verification.)

## Decisions needed

- None blocking. The user chose to keep the Pages Router and to remove the
  redundant loader.

## Experiments

- Dev server on port 3100:
  - `GET /` returned a stylesheet link and a 22.5 KB CSS chunk containing
    `.text-3xl`.
  - `GET /home` returned no stylesheet link.
- The dev server was stopped after the experiment.

## Useful references

- Next.js 16 CSS documentation: `@tailwindcss/postcss` in
  `postcss.config.mjs`.
- Next.js 16 Turbopack documentation: built-in CSS support; no loader needed.
- `@tailwindcss/turbopack` README: loader usage is optional.

## Knowledge to preserve

- Running `next dev` appends a generated "agent rules" block to `AGENTS.md`.
  The block was reverted during the investigation so the working tree stayed
  clean. Expect it to reappear on the next `next dev` run.

## Implementation round (2026-11-16)

- Files changed:
  - `src/pages/_app.tsx` (new)
  - `src/__tests__/pages/_app.test.tsx` (new)
  - `src/__tests__/pages/home.test.tsx` (new)
  - `next.config.ts`
  - `package.json`, `package-lock.json`
  - `postcss.config.mjs`, `src/pages/home.tsx` (formatting only)
  - `tasks/README.md` (task index)

### Findings during implementation

- Verified: placing tests in `src/pages/` breaks `next build`. The Pages
  Router treats every file with a page extension as a route, so the build
  attempted to build `/_app.test` and `/_home.test` and failed with
  `Failed to write page endpoint /_app.test` and
  `does not support external modules (request: node:fs)`.
- Verified: `import.meta.url` is not a `file:` URL in this Vitest/jsdom
  setup, so `fileURLToPath(new URL("./_app.tsx", import.meta.url))` threw
  "The URL must be of scheme file". Tests now resolve paths with
  `path.join(process.cwd(), ...)`.
- Decision: tests moved to `src/__tests__/pages/`, outside the Pages Router
  directory. This is a non-material correction to the approved plan; coverage
  and scope are unchanged.

### Commands run and results

- `npm test`: 13 files, 107 tests passed.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `npm run build`: passed; routes are `/` (app), `/home` (pages), `/_app`
  (pages), and the API routes.
- Dev server on port 3100:
  - `GET /` returned 200 with a stylesheet link; the CSS chunk is 22,533 bytes
    and contains `.text-3xl`.
  - `GET /home` returned 200 with a stylesheet link
    (`src_app_globals_10e6fasxxd-n4.css`, 18,073 bytes) containing `.text-3xl`,
    `.font-bold`, and `.underline`.
  - The `/home` HTML contains
    `<h1 class="text-3xl font-bold underline">Hello world!</h1>`.
- The dev server was stopped after the experiment. `next dev` re-added its
  generated `AGENTS.md` block; the block was reverted with
  `git checkout -- AGENTS.md`.
