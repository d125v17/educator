// @vitest-environment node
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "./schema";
import { databaseUrl } from "./url";

// Load `.env` so the suite can see POSTGRES_PASSWORD (Vitest does not).
loadEnvConfig(process.cwd());

/**
 * Integration test for the users schema, the role enum, and the bootstrap
 * admin seed. Runs against a throwaway database on the local PostgreSQL
 * instance. If `POSTGRES_PASSWORD` is not configured, or the database is
 * unreachable, every test is skipped with a clear message (a skip must be
 * recorded as `unverified`, not a pass).
 */

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

type MigrateModule = typeof import("./migrate");

let adminPool: Pool | undefined;
let testPool: Pool | undefined;
let testDb: NodePgDatabase<typeof schema> | undefined;
let migrate: MigrateModule | undefined;
let reachable = false;
let testDatabaseName = "";

beforeAll(async () => {
  if (!process.env.POSTGRES_PASSWORD) {
    reachable = false;
    return;
  }

  adminPool = new Pool({ connectionString: databaseUrl() });
  try {
    await adminPool.query("select 1");
    reachable = true;
  } catch {
    reachable = false;
    return;
  }

  testDatabaseName = `educator_test_${randomUUID().replace(/-/g, "")}`;
  await adminPool.query(`create database "${testDatabaseName}"`);

  testPool = new Pool({
    connectionString: withDatabase(databaseUrl(), testDatabaseName),
  });
  testDb = drizzle(testPool, { schema });
  migrate = await import("./migrate");
  await migrate.runMigrations(testDb);
});

afterAll(async () => {
  await testPool?.end();
  if (adminPool && reachable && testDatabaseName.length > 0) {
    await adminPool.query(
      `drop database if exists "${testDatabaseName}" with (force)`,
    );
  }
  await adminPool?.end();
});

beforeEach(async () => {
  if (reachable && testPool) {
    await testPool.query("delete from users");
  }
});

describe("users schema and roles", () => {
  it("has a role enum restricted to exactly user and admin", async (ctx) => {
    if (!reachable) ctx.skip();

    const result = await testPool!.query<{ values: string }>(
      "select enum_range(null::role)::text as values",
    );
    expect(result.rows[0].values).toBe("{user,admin}");
  });

  it("stores users with a role and rejects an invalid role", async (ctx) => {
    if (!reachable) ctx.skip();

    await testPool!.query(
      "insert into users (email, password_hash, role) values ($1, $2, $3)",
      ["user@example.com", "hash", "user"],
    );

    await expect(
      testPool!.query(
        "insert into users (email, password_hash, role) values ($1, $2, $3)",
        ["bad@example.com", "hash", "superuser"],
      ),
    ).rejects.toThrow(/invalid input value for enum role/i);
  });

  it("enforces unique email addresses", async (ctx) => {
    if (!reachable) ctx.skip();

    await testPool!.query(
      "insert into users (email, password_hash, role) values ($1, $2, $3)",
      ["dup@example.com", "hash", "user"],
    );

    await expect(
      testPool!.query(
        "insert into users (email, password_hash, role) values ($1, $2, $3)",
        ["dup@example.com", "hash", "user"],
      ),
    ).rejects.toThrow(/duplicate key value/i);
  });
});

describe("bootstrap admin seed", () => {
  it("creates exactly one admin and is idempotent", async (ctx) => {
    if (!reachable) ctx.skip();

    const env = { ADMIN_EMAIL: "admin@test.local", ADMIN_PASSWORD: "test-pw" };

    await migrate!.seedFirstAdmin(testDb!, env);
    await migrate!.seedFirstAdmin(testDb!, env);

    const result = await testPool!.query<{ count: string }>(
      "select count(*)::text as count from users where role = 'admin'",
    );
    expect(result.rows[0].count).toBe("1");
  });

  it("fails when a non-admin user already uses ADMIN_EMAIL", async (ctx) => {
    if (!reachable) ctx.skip();

    await testPool!.query(
      "insert into users (email, password_hash, role) values ($1, $2, $3)",
      ["conflict@test.local", "hash", "user"],
    );

    await expect(
      migrate!.seedFirstAdmin(testDb!, {
        ADMIN_EMAIL: "conflict@test.local",
        ADMIN_PASSWORD: "test-pw",
      }),
    ).rejects.toThrow(/already exists but is not an admin/);
  });

  it("fails when no admin exists and admin env is missing", async (ctx) => {
    if (!reachable) ctx.skip();

    await expect(migrate!.seedFirstAdmin(testDb!, {})).rejects.toThrow(
      /ADMIN_EMAIL and ADMIN_PASSWORD/,
    );
  });
});
