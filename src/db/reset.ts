import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";

import { db, pool } from "./index";
import { migrateAndSeed } from "./migrate";
import { assertResetAllowed } from "./reset-guard";

loadEnvConfig(process.cwd());

/**
 * Drops and recreates the `public` schema, then reapplies migrations and the
 * admin seed. Destructive: deletes all data in the local database. Refuses to
 * run against a non-loopback host unless `ALLOW_DESTRUCTIVE_DB_RESET=true`.
 */
async function main(): Promise<void> {
  try {
    assertResetAllowed();
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);
    await migrateAndSeed();
    console.log("Database reset, migrated, and seeded.");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
