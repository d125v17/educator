import { cookies } from "next/headers";

import { db } from "@/db";
import { signUp } from "@/lib/auth";
import {
  bodyErrorResponse,
  describeErrorForLog,
  isNextControlFlowError,
  json,
  parseJsonBody,
  serverErrorResponse,
} from "@/lib/http";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

/**
 * POST /api/signup — creates an account with the `user` role.
 *
 * Responds `201` with the public user and a session cookie, `400`/`413`/`415`
 * for an invalid body, `409` when the email is already registered, and `500`
 * for an unexpected error.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return bodyErrorResponse(parsed.reason);
  }

  try {
    const outcome = await signUp(db, parsed.value);
    if (outcome.status !== 201) {
      return json(outcome.body, outcome.status);
    }

    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE_NAME,
      outcome.session.id,
      sessionCookieOptions(outcome.session.expiresAt),
    );

    return json({ user: outcome.user }, 201);
  } catch (error) {
    // Let Next.js control-flow signals propagate; only real failures become a
    // JSON 500 response.
    if (isNextControlFlowError(error)) {
      throw error;
    }
    console.error("POST /api/signup failed:", describeErrorForLog(error));
    return serverErrorResponse();
  }
}
