import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";
import { type Role, users } from "../db/schema";
import { hashPassword, verifyPassword } from "./password";
import {
  createSession,
  type CreatedSession,
  type SessionDatabase,
  verifySession,
} from "./session";

/**
 * The executor surface the auth logic requires. Both a database client and a
 * transaction satisfy it (sign-up runs inside a transaction).
 */
export type AuthDatabase = Pick<
  SessionDatabase,
  "insert" | "select" | "update" | "delete" | "transaction"
>;
import {
  type ValidationIssue,
  validateSignInInput,
  validateSignUpInput,
} from "./validators";

/**
 * Core sign-up / sign-in logic, independent of the HTTP layer.
 *
 * These functions take a database (so tests can use a throwaway one) and plain
 * request bodies, and return a status plus either a public user and session or
 * a consistent error body. The route handlers translate the result into a
 * `Response` and set the session cookie.
 */

/** A user as safe to return to a client (never includes the password hash). */
export interface PublicUser {
  id: string;
  email: string;
  role: Role;
}

/** The consistent error body returned by all endpoints. */
export interface AuthErrorBody {
  error: {
    code: string;
    message: string;
    details?: ValidationIssue[];
  };
}

/** Options shared by {@link signUp} and {@link signIn} (forwarded to sessions). */
export interface AuthOptions {
  now?: Date;
  ttlMs?: number;
}

/** Result of a sign-up attempt. */
export type SignUpOutcome =
  | { status: 201; user: PublicUser; session: CreatedSession }
  | { status: 400 | 409; body: AuthErrorBody };

/** Result of a sign-in attempt. */
export type SignInOutcome =
  | { status: 200; user: PublicUser; session: CreatedSession }
  | { status: 400 | 401; body: AuthErrorBody };

function errorBody(
  code: string,
  message: string,
  details?: ValidationIssue[],
): AuthErrorBody {
  return { error: details ? { code, message, details } : { code, message } };
}

function toPublicUser(user: {
  id: string;
  email: string;
  role: Role;
}): PublicUser {
  return { id: user.id, email: user.email, role: user.role };
}

// A cached hash of a random value, used to perform equivalent scrypt work when
// a sign-in email is unknown. This keeps the unknown-email path roughly as
// expensive as the wrong-password path, so timing does not reveal account
// existence (F-4).
let dummyPasswordHash: Promise<string> | undefined;
function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= hashPassword(randomBytes(32).toString("hex")).catch(
    (error: unknown) => {
      // Never cache a rejected promise: otherwise a single failure would make
      // every later unknown-email sign-in return 500 until restart.
      dummyPasswordHash = undefined;
      throw error;
    },
  );
  return dummyPasswordHash;
}

/**
 * Creates a new account with the `user` role and starts a session.
 *
 * Duplicate emails are rejected with `409`, using the unique constraint rather
 * than a check-then-insert so concurrent requests cannot both succeed.
 */
export async function signUp(
  database: AuthDatabase,
  body: unknown,
  options: AuthOptions = {},
): Promise<SignUpOutcome> {
  const parsed = validateSignUpInput(body);
  if (!parsed.ok) {
    return {
      status: 400,
      body: errorBody(
        "invalid_request",
        "The request is invalid.",
        parsed.issues,
      ),
    };
  }

  const { email, password } = parsed.value;
  const passwordHash = await hashPassword(password);

  // The account and its first session are created in one transaction, so a
  // failure while creating the session cannot leave an orphan account.
  const created = await database.transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values({ email, passwordHash, role: "user" })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id, email: users.email, role: users.role });

    const user = inserted[0];
    if (!user) {
      return null;
    }

    const session = await createSession(tx, user.id, options);
    return { user, session };
  });

  if (!created) {
    return {
      status: 409,
      body: errorBody(
        "email_taken",
        "An account with that email already exists.",
      ),
    };
  }

  return {
    status: 201,
    user: toPublicUser(created.user),
    session: created.session,
  };
}

/**
 * Authenticates an existing account and starts a session.
 *
 * Unknown emails and wrong passwords return the same `401` response so the
 * endpoint does not reveal whether an account exists.
 */
export async function signIn(
  database: AuthDatabase,
  body: unknown,
  options: AuthOptions = {},
): Promise<SignInOutcome> {
  const parsed = validateSignInInput(body);
  if (!parsed.ok) {
    return {
      status: 400,
      body: errorBody(
        "invalid_request",
        "The request is invalid.",
        parsed.issues,
      ),
    };
  }

  const { email, password } = parsed.value;
  const [user] = await database
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const invalid: SignInOutcome = {
    status: 401,
    body: errorBody("invalid_credentials", "Invalid email or password."),
  };

  if (!user) {
    // Do equivalent work before returning, so the response time does not
    // reveal whether the email exists.
    await verifyPassword(password, await getDummyPasswordHash());
    return invalid;
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return invalid;
  }

  const session = await createSession(database, user.id, options);
  return { status: 200, user: toPublicUser(user), session };
}

/**
 * Returns the authenticated user for a session id, or `null` when there is no
 * valid, unexpired session or the user no longer exists.
 */
export async function getCurrentUser(
  database: AuthDatabase,
  sessionId: string | undefined,
  options: AuthOptions = {},
): Promise<PublicUser | null> {
  if (!sessionId) {
    return null;
  }

  const userId = await verifySession(database, sessionId, options);
  if (!userId) {
    return null;
  }

  const [user] = await database
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ? toPublicUser(user) : null;
}
