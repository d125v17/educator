// @vitest-environment node
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "../db/schema";
import { users } from "../db/schema";
import { isLoopbackHost } from "../db/reset-guard";
import { databaseUrl } from "../db/url";
import { getCurrentUser, signIn, signUp } from "./auth";
import { hashPassword, verifyPassword } from "./password";
import { clearSession, createSession, verifySession } from "./session";

// Load `.env` so the suite can see POSTGRES_PASSWORD (Vitest does not).
loadEnvConfig(process.cwd());

/**
 * Integration tests for the sign-up / sign-in logic and the server-side session
 * helpers. Runs against a throwaway database on the local PostgreSQL instance.
 * When `POSTGRES_PASSWORD` is not configured, the host is not loopback, or the
 * database is unreachable, every test is skipped with a clear reason (a skip is
 * not a pass).
 */

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

type MigrateModule = typeof import("../db/migrate");

let adminPool: Pool | undefined;
let testPool: Pool | undefined;
let testDb: NodePgDatabase<typeof schema> | undefined;
let migrate: MigrateModule | undefined;
let reachable = false;
let skipReason = "database integration test was not run";
let testDatabaseName = "";

beforeAll(async () => {
  const host = process.env.POSTGRES_HOST || "127.0.0.1";
  if (!isLoopbackHost(host)) {
    skipReason = `POSTGRES_HOST="${host}" is not loopback; skipping DB tests`;
    return;
  }

  if (!process.env.POSTGRES_PASSWORD) {
    skipReason =
      "POSTGRES_PASSWORD is not configured (.env); skipping DB tests";
    return;
  }

  adminPool = new Pool({ connectionString: databaseUrl() });
  try {
    await adminPool.query("select 1");
    reachable = true;
  } catch {
    skipReason = "local PostgreSQL is unreachable; skipping DB tests";
    return;
  }

  testDatabaseName = `educator_test_${randomUUID().replace(/-/g, "")}`;
  await adminPool.query(`create database "${testDatabaseName}"`);

  testPool = new Pool({
    connectionString: withDatabase(databaseUrl(), testDatabaseName),
  });
  testDb = drizzle(testPool, { schema });
  migrate = await import("../db/migrate");
  await migrate.runMigrations(testDb);
});

afterAll(async () => {
  // `drop database ... with (force)` can terminate an idle backend while a pool
  // is closing, which `pg` re-emits as an unhandled `error`. Ignore that
  // teardown-time error only (the throwaway database is being discarded).
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
    await testPool.query("delete from sessions");
    await testPool.query("delete from users");
  }
});

describe("signUp", () => {
  it("creates an account with the user role and a session", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const outcome = await signUp(testDb!, {
      email: "New.User@Example.com",
      password: "correct-horse",
    });

    expect(outcome.status).toBe(201);
    if (outcome.status !== 201) return;
    expect(outcome.user.email).toBe("new.user@example.com");
    expect(outcome.user.role).toBe("user");
    expect(outcome.session.userId).toBe(outcome.user.id);
    expect(outcome.session.id).toMatch(/^[0-9a-f-]{36}$/);

    const rows = await testPool!.query<{
      email: string;
      role: string;
      password_hash: string;
    }>("select email, role, password_hash from users");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].role).toBe("user");
    expect(rows.rows[0].email).toBe("new.user@example.com");
    // Stored value is a hash, never the plaintext password.
    expect(rows.rows[0].password_hash).not.toContain("correct-horse");
    await expect(
      verifyPassword("correct-horse", rows.rows[0].password_hash),
    ).resolves.toBe(true);
  });

  it("never returns the password or its hash", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const outcome = await signUp(testDb!, {
      email: "user@example.com",
      password: "correct-horse",
    });
    expect(outcome.status).toBe(201);
    if (outcome.status !== 201) return;
    expect(Object.keys(outcome.user).sort()).toEqual(["email", "id", "role"]);
    expect(JSON.stringify(outcome)).not.toContain("correct-horse");
    expect(JSON.stringify(outcome)).not.toContain("scrypt$");
  });

  it("ignores a client-supplied role", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const outcome = await signUp(testDb!, {
      email: "sneaky@example.com",
      password: "correct-horse",
      role: "admin",
    });
    expect(outcome.status).toBe(201);
    if (outcome.status !== 201) return;
    expect(outcome.user.role).toBe("user");

    const rows = await testPool!.query<{ role: string }>(
      "select role from users where email = 'sneaky@example.com'",
    );
    expect(rows.rows[0].role).toBe("user");
  });

  it("rejects a duplicate email with 409 and creates no second account", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    await signUp(testDb!, {
      email: "dup@example.com",
      password: "correct-horse",
    });
    const outcome = await signUp(testDb!, {
      email: "dup@example.com",
      password: "another-password",
    });

    expect(outcome.status).toBe(409);
    if (outcome.status !== 409) return;
    expect(outcome.body.error.code).toBe("email_taken");

    const rows = await testPool!.query<{ count: string }>(
      "select count(*)::text as count from users",
    );
    expect(rows.rows[0].count).toBe("1");
  });

  it("treats emails case- and whitespace-insensitively for duplicates", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    await signUp(testDb!, {
      email: "dup@example.com",
      password: "correct-horse",
    });
    const outcome = await signUp(testDb!, {
      email: "  DUP@Example.COM ",
      password: "correct-horse",
    });
    expect(outcome.status).toBe(409);
  });

  it("rejects invalid input with 400 and field details", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const outcome = await signUp(testDb!, {
      email: "not-an-email",
      password: "short",
    });
    expect(outcome.status).toBe(400);
    if (outcome.status !== 400) return;
    expect(outcome.body.error.code).toBe("invalid_request");
    expect(outcome.body.error.details?.length).toBeGreaterThan(0);
  });

  it("rolls back the account if session creation fails", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    // Force the session insert to fail with a CHECK violation; the user insert
    // must be rolled back with it.
    await testPool!.query(
      "alter table sessions add constraint sessions_force_fail check (false)",
    );
    try {
      await expect(
        signUp(testDb!, {
          email: "atomic@example.com",
          password: "correct-horse",
        }),
      ).rejects.toBeInstanceOf(Error);
    } finally {
      await testPool!.query(
        "alter table sessions drop constraint sessions_force_fail",
      );
    }

    const rows = await testPool!.query<{ count: string }>(
      "select count(*)::text as count from users where email = 'atomic@example.com'",
    );
    expect(rows.rows[0].count).toBe("0");
  });
});

describe("signIn", () => {
  async function createAccount(
    email = "user@example.com",
    password = "correct-horse",
  ): Promise<void> {
    await signUp(testDb!, { email, password });
  }

  it("authenticates an existing account and starts a session", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    await createAccount();
    const outcome = await signIn(testDb!, {
      email: "user@example.com",
      password: "correct-horse",
    });

    expect(outcome.status).toBe(200);
    if (outcome.status !== 200) return;
    expect(outcome.user.email).toBe("user@example.com");
    expect(outcome.session.userId).toBe(outcome.user.id);

    const sessions = await testPool!.query<{ count: string }>(
      "select count(*)::text as count from sessions",
    );
    // One from sign-up, one from sign-in.
    expect(sessions.rows[0].count).toBe("2");
  });

  it("authenticates a pre-existing account with a short password", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    // Mimics a bootstrap admin seeded outside the sign-up policy.
    const passwordHash = await hashPassword("seven77");
    await testPool!.query(
      "insert into users (email, password_hash, role) values ($1, $2, $3)",
      ["admin@example.com", passwordHash, "admin"],
    );

    const outcome = await signIn(testDb!, {
      email: "admin@example.com",
      password: "seven77",
    });
    expect(outcome.status).toBe(200);
    if (outcome.status !== 200) return;
    expect(outcome.user.role).toBe("admin");
  });

  it("rejects a wrong password with 401", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    await createAccount();
    const outcome = await signIn(testDb!, {
      email: "user@example.com",
      password: "wrong-password",
    });
    expect(outcome.status).toBe(401);
    if (outcome.status !== 401) return;
    expect(outcome.body.error.code).toBe("invalid_credentials");
  });

  it("uses the same 401 response for an unknown email", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const outcome = await signIn(testDb!, {
      email: "nobody@example.com",
      password: "correct-horse",
    });
    expect(outcome.status).toBe(401);
    if (outcome.status !== 401) return;
    expect(outcome.body.error.message).toBe("Invalid email or password.");
  });

  it("rejects invalid input with 400", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const outcome = await signIn(testDb!, { email: "", password: "" });
    expect(outcome.status).toBe(400);
  });
});

describe("sessions and getCurrentUser", () => {
  it("resolves a valid session to its user", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const outcome = await signUp(testDb!, {
      email: "user@example.com",
      password: "correct-horse",
    });
    if (outcome.status !== 201) throw new Error("sign-up failed");

    const user = await getCurrentUser(testDb!, outcome.session.id);
    expect(user?.id).toBe(outcome.user.id);
    expect(user?.email).toBe("user@example.com");
  });

  it("returns null for a missing, malformed, or unknown session id", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    expect(await getCurrentUser(testDb!, undefined)).toBeNull();
    expect(await getCurrentUser(testDb!, "not-a-uuid")).toBeNull();
    expect(
      await getCurrentUser(testDb!, "00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
  });

  it("returns null for an expired session", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const outcome = await signUp(testDb!, {
      email: "user@example.com",
      password: "correct-horse",
    });
    if (outcome.status !== 201) throw new Error("sign-up failed");

    const created = await createSession(testDb!, outcome.user.id, {
      now: new Date("2026-01-01T00:00:00Z"),
      ttlMs: 1000,
    });
    // Within the lifetime...
    expect(
      await verifySession(testDb!, created.id, {
        now: new Date("2026-01-01T00:00:00.500Z"),
      }),
    ).toBe(outcome.user.id);
    // ...and after it.
    expect(
      await verifySession(testDb!, created.id, {
        now: new Date("2026-01-01T00:00:02Z"),
      }),
    ).toBeNull();
  });

  it("verifySession returns the userId and refreshes last_seen", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const outcome = await signUp(testDb!, {
      email: "user@example.com",
      password: "correct-horse",
    });
    if (outcome.status !== 201) throw new Error("sign-up failed");

    const before = await testPool!.query<{ last_seen: Date }>(
      "select last_seen from sessions where id = $1",
      [outcome.session.id],
    );

    const later = new Date(Date.now() + 60_000);
    const userId = await verifySession(testDb!, outcome.session.id, {
      now: later,
    });
    expect(userId).toBe(outcome.user.id);

    const after = await testPool!.query<{ last_seen: Date }>(
      "select last_seen from sessions where id = $1",
      [outcome.session.id],
    );
    expect(after.rows[0].last_seen.getTime()).toBe(later.getTime());
    expect(after.rows[0].last_seen.getTime()).toBeGreaterThan(
      before.rows[0].last_seen.getTime(),
    );
  });

  it("clearSession removes the session", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const outcome = await signUp(testDb!, {
      email: "user@example.com",
      password: "correct-horse",
    });
    if (outcome.status !== 201) throw new Error("sign-up failed");

    await clearSession(testDb!, outcome.session.id);
    expect(await verifySession(testDb!, outcome.session.id)).toBeNull();
  });

  it("removes sessions when their user is deleted", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const outcome = await signUp(testDb!, {
      email: "user@example.com",
      password: "correct-horse",
    });
    if (outcome.status !== 201) throw new Error("sign-up failed");

    await testDb!.delete(users).where(eq(users.id, outcome.user.id));

    const rows = await testPool!.query<{ count: string }>(
      "select count(*)::text as count from sessions",
    );
    expect(rows.rows[0].count).toBe("0");
  });
});

describe("seeded admin email normalization", () => {
  it("normalizes ADMIN_EMAIL so the seeded admin can sign in", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    await migrate!.seedFirstAdmin(testDb!, {
      ADMIN_EMAIL: "  Admin.Root@Example.COM ",
      ADMIN_PASSWORD: "seven77",
    });

    const rows = await testPool!.query<{ email: string }>(
      "select email from users where role = 'admin'",
    );
    expect(rows.rows[0].email).toBe("admin.root@example.com");

    const outcome = await signIn(testDb!, {
      email: "admin.root@example.com",
      password: "seven77",
    });
    expect(outcome.status).toBe(200);
  });

  it("prevents a differently-cased sign-up from duplicating the seeded admin", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    await migrate!.seedFirstAdmin(testDb!, {
      ADMIN_EMAIL: "Admin.Root@Example.COM",
      ADMIN_PASSWORD: "seven77",
    });

    const outcome = await signUp(testDb!, {
      email: "admin.root@example.com",
      password: "correct-horse",
    });
    expect(outcome.status).toBe(409);
  });

  it("rejects a malformed ADMIN_EMAIL at seed time", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    await expect(
      migrate!.seedFirstAdmin(testDb!, {
        ADMIN_EMAIL: "root@localhost",
        ADMIN_PASSWORD: "seven77",
      }),
    ).rejects.toThrow(/not a valid email address/);

    const rows = await testPool!.query<{ count: string }>(
      "select count(*)::text as count from users",
    );
    expect(rows.rows[0].count).toBe("0");
  });
});

describe("sessions schema", () => {
  it("has an index on sessions.user_id", async (ctx) => {
    if (!reachable) ctx.skip(skipReason);

    const rows = await testPool!.query<{ indexname: string }>(
      "select indexname from pg_indexes " +
        "where schemaname = 'public' and tablename = 'sessions'",
    );
    expect(rows.rows.map((row) => row.indexname)).toContain(
      "sessions_user_id_idx",
    );
  });
});
