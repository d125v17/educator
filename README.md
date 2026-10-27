This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Local database

The project runs a local PostgreSQL database with Docker Compose (Compose v2).

```bash
cp .env.example .env   # create local settings (once)
docker compose up -d   # start the database
docker compose ps      # wait until the db is "(healthy)"
docker compose down    # stop it (data is kept)
```

The database is reachable on `127.0.0.1:5432`. Data is stored in the named
Docker volume `educator_pgdata`, so it survives restarts; `docker compose down -v`
deletes it. See [docs/local-database.md](docs/local-database.md) for full
start, verification, persistence, and cleanup instructions.

### User accounts and migrations

The schema is managed with Drizzle. Migrations live in `drizzle/`; the first
admin is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (set these in `.env`).

```bash
npm run db:generate   # generate SQL migrations from src/db/schema.ts
npm run db:migrate    # apply migrations and seed the first admin
npm run db:reset      # drop and recreate the schema, then migrate + seed
```

`db:reset` refuses to run unless the database host is loopback; set
`ALLOW_DESTRUCTIVE_DB_RESET=true` in `.env` to override. See
[docs/local-database.md](docs/local-database.md) for the fresh-database and
rollback steps.

The `users` table stores each account with a role of `user` or `admin` and a
scrypt password hash. See
[docs/decisions/0002-user-accounts-drizzle-scrypt.md](docs/decisions/0002-user-accounts-drizzle-scrypt.md).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Validation

Format, lint, and test the project:

```bash
npm run format        # format code with Prettier
npm run format:check  # check formatting without writing
npm run lint          # run ESLint
npm test              # run the test suite (Vitest)
```

See [docs/testing.md](docs/testing.md) for details and conventions.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
