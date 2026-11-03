import { cookies } from "next/headers";

import { db } from "@/db";
import { signIn } from "@/lib/auth";
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
 * POST /api/signin — authenticates an existing account.
 *
 * Responds `200` with the public user and a session cookie, `400`/`413`/`415`
 * for an invalid body, `401` for unknown emails or wrong passwords (same body
 * for both), and `500` for an unexpected error.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return bodyErrorResponse(parsed.reason);
  }

  try {
    const outcome = await signIn(db, parsed.value);
    if (outcome.status !== 200) {
      return json(outcome.body, outcome.status);
    }

    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE_NAME,
      outcome.session.id,
      sessionCookieOptions(outcome.session.expiresAt),
    );

    return json({ user: outcome.user }, 200);
  } catch (error) {
    // Let Next.js control-flow signals propagate; only real failures become a
    // JSON 500 response.
    if (isNextControlFlowError(error)) {
      throw error;
    }
    console.error("POST /api/signin failed:", describeErrorForLog(error));
    return serverErrorResponse();
  }
}
