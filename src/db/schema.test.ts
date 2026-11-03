// @vitest-environment node
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "./schema";
import { isLoopbackHost } from "./reset-guard";
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
let skipReason = "database integration test was not run";
let testDatabaseName = "";

beforeAll(async () => {
  // This suite creates and drops a throwaway database; only do that on a local
  // server, mirroring the `db:reset` guard.
  const host = process.env.POSTGRES_HOST || "127.0.0.1";
  if (!isLoopbackHost(host)) {
    reachable = false;
    skipReason = `POSTGRES_HOST="${host}" is not loopback; skipping DB tests`;
    return;
  }

  if (!process.env.POSTGRES_PASSWORD) {
    reachable = false;
    skipReason =
      "POSTGRES_PASSWORD is not configured (.env); skipping DB tests";
    return;
  }

  adminPool = new Pool({ connectionString: databaseUrl() });
  try {
    await adminPool.query("select 1");
    reachable = true;
  } catch {
    reachable = false;
    skipReason = "local PostgreSQL is unreachable; skipping DB tests";
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
  // `drop database ... with (force)` can terminate an idle backend while a pool
  // is closing, which `pg` re-emits as an unhandled `error`. Ignore that
  // teardown-time error only (the throwaway database is being discarded), so a
  // genuine run-time pool error is still surfaced.
  testPool?.on("error", () => {});
  adminPool?.on("error", () => {});
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
    if (!reachable) ctx.skip(skipReason);

    const result = await testPool!.query<{ values: string }>(
      "select enum_range(null::role)::text as values",
    );
    expect(result.rows[0].values).toBe("{user,admin}");
  });

  it("stores users with a role and rejects an invalid role", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

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
    if (!reachable) ctx.skip(skipReason);

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
    if (!reachable) ctx.skip(skipReason);

    const env = { ADMIN_EMAIL: "admin@test.local", ADMIN_PASSWORD: "test-pw" };

    await migrate!.seedFirstAdmin(testDb!, env);
    await migrate!.seedFirstAdmin(testDb!, env);

    const result = await testPool!.query<{ count: string }>(
      "select count(*)::text as count from users where role = 'admin'",
    );
    expect(result.rows[0].count).toBe("1");
  });

  it("fails when a non-admin user already uses ADMIN_EMAIL", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

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
    if (!reachable) ctx.skip(skipReason);

    await expect(migrate!.seedFirstAdmin(testDb!, {})).rejects.toThrow(
      /ADMIN_EMAIL and ADMIN_PASSWORD/,
    );
  });

  it("skips without admin env when an admin already exists", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    await migrate!.seedFirstAdmin(testDb!, {
      ADMIN_EMAIL: "existing@test.local",
      ADMIN_PASSWORD: "test-pw",
    });

    // The relaxed seed only requires ADMIN_* when it actually creates an admin.
    await expect(migrate!.seedFirstAdmin(testDb!, {})).resolves.toBeUndefined();
  });

  it("serializes concurrent seeds and creates exactly one admin", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const results = await Promise.allSettled([
      migrate!.seedFirstAdmin(testDb!, {
        ADMIN_EMAIL: "first@test.local",
        ADMIN_PASSWORD: "test-pw",
      }),
      migrate!.seedFirstAdmin(testDb!, {
        ADMIN_EMAIL: "second@test.local",
        ADMIN_PASSWORD: "test-pw",
      }),
    ]);

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);

    const result = await testPool!.query<{ count: string }>(
      "select count(*)::text as count from users where role = 'admin'",
    );
    expect(result.rows[0].count).toBe("1");
  });
});
