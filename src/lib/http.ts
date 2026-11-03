import type { AuthErrorBody } from "./auth";

/** Maximum accepted JSON request body size, in bytes (F-6). */
export const MAX_BODY_BYTES = 16 * 1024;

/** Builds a JSON `Response` with the given status. */
export function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function errorBody(code: string, message: string): AuthErrorBody {
  return { error: { code, message } };
}

/** The consistent body returned when a request body is not valid JSON. */
export function malformedJsonResponse(): Response {
  return json(
    errorBody("invalid_request", "The request body must be valid JSON."),
    400,
  );
}

/** The consistent body returned when a request body is too large. */
export function payloadTooLargeResponse(): Response {
  return json(
    errorBody("payload_too_large", "The request body is too large."),
    413,
  );
}

/** The consistent body returned for a non-JSON request body (R3-F4). */
export function unsupportedMediaTypeResponse(): Response {
  return json(
    errorBody(
      "unsupported_media_type",
      "The request body must be application/json.",
    ),
    415,
  );
}

/**
 * The consistent body returned for an unexpected server error, so failures
 * still honor the documented JSON error shape (F-5).
 */
export function serverErrorResponse(): Response {
  return json(
    errorBody("internal_error", "Something went wrong. Please try again."),
    500,
  );
}

/** Reasons a request body can be rejected. */
export type BodyErrorReason =
  "malformed" | "too_large" | "unsupported_media_type";

/** Maps a body-reading failure to its response. */
export function bodyErrorResponse(reason: BodyErrorReason): Response {
  switch (reason) {
    case "too_large":
      return payloadTooLargeResponse();
    case "unsupported_media_type":
      return unsupportedMediaTypeResponse();
    default:
      return malformedJsonResponse();
  }
}

/** Result of reading a JSON request body. */
export type ParsedBody =
  { ok: true; value: unknown } | { ok: false; reason: BodyErrorReason };

/** Thrown internally when a body exceeds the configured limit. */
class PayloadTooLargeError extends Error {}

/** Whether the request declares an `application/json` content type. */
function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  if (!contentType) {
    return false;
  }
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

/**
 * Reads and parses a JSON request body without throwing.
 *
 * A non-`application/json` content type is rejected with
 * `unsupported_media_type`. A declared `Content-Length` over
 * {@link MAX_BODY_BYTES} is rejected before reading. The body is then read as a
 * stream and rejected once it exceeds the limit, so a chunked request without
 * `Content-Length` is also bounded.
 */
export async function parseJsonBody(request: Request): Promise<ParsedBody> {
  if (!hasJsonContentType(request)) {
    return { ok: false, reason: "unsupported_media_type" };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      return { ok: false, reason: "too_large" };
    }
  }

  let text: string;
  try {
    text = await readBodyWithLimit(request, MAX_BODY_BYTES);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof PayloadTooLargeError ? "too_large" : "malformed",
    };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}

/**
 * Whether an error is a Next.js control-flow signal (for example the rejection
 * that request-context helpers raise during prerendering). Such errors must be
 * rethrown rather than converted into a JSON error response (R3-F5).
 */
export function isNextControlFlowError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string"
  );
}

/**
 * A log-safe description of an unexpected error.
 *
 * Drizzle query errors embed the bound parameters on a `params:` line, so a
 * naive `console.error(error)` can log emails and password hashes. Keep only the
 * error name and the first message line; the first-line cut drops the separate
 * `params:` line entirely (R6-F1).
 */
export function describeErrorForLog(error: unknown): string {
  if (!(error instanceof Error)) {
    return typeof error;
  }
  const firstLine = error.message.split("\n", 1)[0] ?? "";
  const withoutParams = firstLine.split("params:", 1)[0]?.trim() ?? "";
  return withoutParams ? `${error.name}: ${withoutParams}` : error.name;
}

/** Reads a request body into a string, aborting once `limit` bytes are read. */
async function readBodyWithLimit(
  request: Request,
  limit: number,
): Promise<string> {
  const body = request.body;
  if (!body) {
    return "";
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
