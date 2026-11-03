import { cookies } from "next/headers";

import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { describeErrorForLog, json, serverErrorResponse } from "@/lib/http";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * GET /api/me — returns the authenticated user for the session cookie.
 *
 * Responds `200` with the public user, `401` when there is no valid session,
 * and `500` for an unexpected error.
 */
export async function GET(): Promise<Response> {
  // `cookies()` is intentionally outside the try/catch: during prerendering it
  // rejects as a control-flow signal that Next.js must handle itself.
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  try {
    const user = await getCurrentUser(db, sessionId);
    if (!user) {
      return json(
        {
          error: { code: "unauthenticated", message: "You are not signed in." },
        },
        401,
      );
    }

    return json({ user }, 200);
  } catch (error) {
    console.error("GET /api/me failed:", describeErrorForLog(error));
    return serverErrorResponse();
  }
}
