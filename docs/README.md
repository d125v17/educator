# Project Documentation

## Purpose
TODO: Describe the purpose of the project. This is still an open item; do not
invent a purpose from the code alone.

## Technology stack
- Language: TypeScript 5 (`tsconfig.json`)
- Framework: Next.js 16.4.3, App Router (`package.json`, `src/app/`)
- Runtime: Node.js (Next.js default)
- UI: React 19.3.0, Tailwind CSS 4
- Lint: ESLint 9 with `eslint-config-next`
- Formatting: Prettier 3 with `eslint-config-prettier` (see `testing.md`)
- Tests: Vitest with React Testing Library and jsdom — see `testing.md`
- Database: PostgreSQL 17, run locally via Docker Compose — see `local-database.md`
- Data access: Drizzle ORM with `pg` (`src/db/`) — see `decisions/0002-user-accounts-drizzle-scrypt.md`

Update this list from `package.json` when dependencies change.

## Documentation index
- `local-database.md` — running the local PostgreSQL database via Docker Compose
- `architecture.md` — architecture and module boundaries (planned, not written)
- `coding-standards.md` — coding conventions (planned, not written)
- `testing.md` — format, lint, and test commands and expectations
- `security.md` — security requirements (planned, not written)
- `decisions/` — architecture decision records
  - `0001-local-database-postgresql-docker-compose.md` — local database choice
    (PostgreSQL 17 on Docker Compose)
  - `0002-user-accounts-drizzle-scrypt.md` — user accounts, role enum, Drizzle,
    and scrypt password hashing

Pages marked "planned" do not exist yet and must not be treated as available
sources of truth.

## Model routing and cost

Cost control is the default: every stage runs on one inexpensive model, and a
more capable model is used only when it is explicitly requested for a
specific run.

| Stage | Model | Input / output per 1M tokens |
| --- | --- | --- |
| Every stage by default (task creation, planning, implementation, verification) | `openrouter/deepseek/deepseek-v4.1-flash` | $0.02 / $1.00 |
| Independent review subagent (`.opencode/agents/review.md`) | `openrouter/anthropic/claude-haiku-5.5` | pinned in the agent config |
| Optional escalation for difficult planning or implementation | `openrouter/~deepseek/deepseek-pro-latest` | $0.13 / $0.40 |
| Optional escalation for high-risk independent review | `openrouter/openai/gpt-6-sol` | $2.00 / $10.00 |

Rules:

- Do not pin an expensive model in the repository configuration. Escalate per
  run instead, for example `opencode run --model <id>` or by selecting it for
  one session with `/models`.
- The independent review agent (`.opencode/agents/review.md`) is pinned to
  `openrouter/anthropic/claude-haiku-5.5` on purpose, so a review cannot
  silently inherit an expensive session model.
- Prefer escalating planning over escalating review; a weak plan is more
  expensive to correct than a missed minor review finding.
- For output-heavy work, `openrouter/deepseek/deepseek-v4.1-flash-1017`
  ($0.15 / $0.60) has cheaper output but 7.5x the input price.

Verified facts and limits:

- Prices above were read from the OpenRouter catalog on 2026-10-26 and are
  not a guarantee of future pricing. Cache reads, provider routing, and
  time-of-day price overrides can change actual spend.
- Catalog listing is not proof of quality. Treat the escalation choices as
  untested hypotheses until measured on real tasks in this project.
- Model availability is project-specific and depends on credentials.

## Maintenance
Update this documentation when project structure, dependencies,
architecture, or development commands change.

## Development workflow

- `../AGENTS.md` — global project instructions for AI agents.
- `../tasks/README.md` — task lifecycle and status rules.
- `../tasks/` — business tasks and their technical plans.
- `../.ai/working/` — temporary cross-task working notes.
- `../.ai/context/` — candidate knowledge awaiting documentation.
- `decisions/` — accepted architectural decisions.
