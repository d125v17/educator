---
id: TASK-007
title: Tailwind CSS on the Pages Router
type: task
status: review
created: 2026-11-16
updated: 2026-11-16
plan_approved: 2026-11-16
plan_approved_by: user
plan_revision: draft-1
---

# Business Task: Tailwind CSS on the Pages Router

## Business problem

The `/home` page is implemented in the Pages Router (`src/pages/home.tsx`).
That page renders without any Tailwind stylesheet, so utility classes such as
`text-3xl`, `font-bold`, and `underline` have no effect. The App Router page
(`/`) does load Tailwind, so the project appears inconsistent and contributors
cannot trust Tailwind to work on Pages Router routes.

The project also configures Tailwind twice: once through the standard PostCSS
plugin and once through a custom Turbopack CSS loader. Two configuration
sources make it unclear which pipeline is responsible for styling.

## Desired outcome

Tailwind utility classes work on the `/home` Pages Router page. The project
has one documented CSS pipeline (the PostCSS plugin), and the redundant
Turbopack loader is removed. Automated tests guard the Pages Router global
stylesheet import so the regression does not return.

## User scenarios

- As a visitor, I open `/home` and see the heading styled with Tailwind
  (large, bold, underlined).
- As a visitor, I open `/` and still see the App Router page styled by
  Tailwind.
- As a contributor, I add a Tailwind class to a Pages Router page and it works
  without adding extra configuration.
- As a contributor, I read the configuration and find a single CSS pipeline.

## Acceptance criteria

- AC1: Requesting `/home` serves a Tailwind stylesheet, and the "Hello world!"
  heading receives the `text-3xl`, `font-bold`, and `underline` utilities.
- AC2: Requesting `/` continues to serve Tailwind CSS (no regression to the
  App Router page).
- AC3: The redundant `@tailwindcss/turbopack` loader rule and dependency are
  removed; `postcss.config.mjs` remains the single CSS pipeline.
- AC4: Automated tests cover the Pages Router global stylesheet import and the
  Home page render, and the full test suite passes.
- AC5: `npm run lint`, `npm run format:check`, and `npm run build` pass.

## Scope

### Included

- Import the global Tailwind stylesheet in the Pages Router.
- Remove the redundant Turbopack CSS loader and its dependency.
- Add automated tests for the Pages Router stylesheet import and the Home page.
- Format the files touched by this task.

### Excluded

- Moving the Home page to the App Router.
- Visual redesign or changes to the page content.
- Font parity between the Pages Router and the App Router layouts (recorded as
  an optional follow-up).

## Constraints

- Keep the Pages Router for the `/home` page.
- Avoid new dependencies; this task only removes one.
- Do not add credentials or secrets.
- Follow the existing project conventions and validation commands.

## Open questions

- Should the Pages Router also get the App Router's `<html>` classes and Geist
  font variables? This is not required for Tailwind to work and is recorded as
  a follow-up rather than included in this task.

## Links

- Technical plan: plan.md
- Working notes: working-notes.md
- Review: review.md
