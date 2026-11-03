import { and, eq, gt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../db/schema";
import { sessions } from "../db/schema";

/**
 * Server-side session helpers.
 *
 * The client only ever receives the opaque session `id` in an HttpOnly cookie;
 * the `sessions` row is the source of truth, so a session can be revoked by
 * deleting its row. These helpers take the database as an argument so they are
 * testable against a throwaway database without importing the shared pool.
 */

/** Name of the cookie that carries the session id. */
export const SESSION_COOKIE_NAME = "session";

/** Default session lifetime (30 days). */
export const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** The full Drizzle client shape. */
export type SessionDatabase = NodePgDatabase<typeof schema>;

/**
 * The minimal executor surface used by the session helpers. Both a database
 * client and a transaction satisfy it, so the helpers can run inside a
 * transaction.
 */
export type SessionExecutor = Pick<
  SessionDatabase,
  "insert" | "select" | "update" | "delete"
>;

/** A session resolved to the values callers need. */
export interface CreatedSession {
  id: string;
  userId: string;
  expiresAt: Date;
}

/** Options for {@link createSession}. */
export interface CreateSessionOptions {
  /** Lifetime in milliseconds; defaults to {@link DEFAULT_SESSION_TTL_MS}. */
  ttlMs?: number;
  /** Clock override for deterministic tests. */
  now?: Date;
  /** Optional free-form metadata stored with the session. */
  metadata?: Record<string, unknown>;
}

/** Options for {@link verifySession}. */
export interface VerifySessionOptions {
  /** Clock override for deterministic tests. */
  now?: Date;
}

// Session ids are UUID primary keys. Rejecting anything else up front avoids a
// Postgres "invalid input syntax for type uuid" error on a tampered cookie.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `value` is a syntactically valid UUID. */
export function isSessionId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Creates a new session row and returns its id, user, and expiry. */
export async function createSession(
  database: SessionExecutor,
  userId: string,
  options: CreateSessionOptions = {},
): Promise<CreatedSession> {
  const now = options.now ?? new Date();
  const ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttlMs);

  const [row] = await database
    .insert(sessions)
    .values({ userId, expiresAt, metadata: options.metadata ?? null })
    .returning({
      id: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
    });

  if (!row) {
    throw new Error("Failed to create a session.");
  }
  return { id: row.id, userId: row.userId, expiresAt: row.expiresAt };
}

/**
 * Resolves a session id to its user id, or `null` when the id is malformed, the
 * session does not exist, or it has expired. Refreshes `last_seen` on success.
 */
export async function verifySession(
  database: SessionExecutor,
  sessionId: string,
  options: VerifySessionOptions = {},
): Promise<string | null> {
  if (!isSessionId(sessionId)) {
    return null;
  }

  const now = options.now ?? new Date();
  const [row] = await database
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!row) {
    return null;
  }

  await database
    .update(sessions)
    .set({ lastSeen: now })
    .where(eq(sessions.id, sessionId));

  return row.userId;
}

/** Deletes a session row. A malformed or unknown id is a no-op. */
export async function clearSession(
  database: SessionExecutor,
  sessionId: string,
): Promise<void> {
  if (!isSessionId(sessionId)) {
    return;
  }
  await database.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Cookie attributes for a freshly created session (see `cookies().set`). */
export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  expires: Date;
}

/**
 * Cookie attributes for the session cookie.
 *
 * `Secure` is enabled only for an explicit production environment. An unset
 * `NODE_ENV` is treated as development, so the local HTTP dev server (where a
 * `Secure` cookie would be rejected by the browser) keeps working.
 */
export function sessionCookieOptions(expiresAt: Date): SessionCookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    expires: expiresAt,
  };
}
