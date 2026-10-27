import { pathToFileURL } from "node:url";

import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { hashPassword } from "../lib/password";
import { db, pool } from "./index";
import * as schema from "./schema";
import { users } from "./schema";

loadEnvConfig(process.cwd());

const MIGRATIONS_FOLDER = "./drizzle";

type Database = NodePgDatabase<typeof schema>;

/** Environment values used to seed the first admin. */
export type AdminSeedEnv = Record<string, string | undefined>;

/** Applies all pending SQL migrations from `./drizzle`. */
export async function runMigrations(database: Database = db): Promise<void> {
  await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
}

/**
 * Creates the very first admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
 *
 * Idempotent: does nothing if an admin already exists. Throws when the
 * required environment variables are missing (and no admin exists yet), so no
 * default secret is used.
 */
export async function seedFirstAdmin(
  database: Database = db,
  env: AdminSeedEnv = process.env,
): Promise<void> {
  const existing = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (existing.length > 0) {
    console.log("An admin already exists; skipping the admin seed.");
    return;
  }

  const email = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the first admin.",
    );
  }

  const passwordHash = await hashPassword(password);
  const inserted = await database
    .insert(users)
    .values({ email, passwordHash, role: "admin" })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });

  if (inserted.length === 0) {
    throw new Error(
      `Could not seed the first admin: a user with email "${email}" already ` +
        "exists but is not an admin. Resolve it manually or use a different " +
        "ADMIN_EMAIL.",
    );
  }

  console.log(`Seeded the first admin: ${email}`);
}

/** Runs migrations and then seeds the first admin. */
export async function migrateAndSeed(database: Database = db): Promise<void> {
  await runMigrations(database);
  await seedFirstAdmin(database);
}

async function main(): Promise<void> {
  try {
    await migrateAndSeed();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  void main();
}
