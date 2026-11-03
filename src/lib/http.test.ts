// @vitest-environment node
import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it } from "vitest";

import {
  describeErrorForLog,
  isNextControlFlowError,
  MAX_BODY_BYTES,
  malformedJsonResponse,
  parseJsonBody,
  payloadTooLargeResponse,
  serverErrorResponse,
  unsupportedMediaTypeResponse,
} from "./http";

function jsonRequest(body: string): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("parseJsonBody", () => {
  it("parses a valid JSON body", async () => {
    await expect(
      parseJsonBody(jsonRequest('{"email":"a@b.com"}')),
    ).resolves.toEqual({ ok: true, value: { email: "a@b.com" } });
  });

  it("reports malformed JSON", async () => {
    await expect(parseJsonBody(jsonRequest("not json"))).resolves.toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects a body larger than the declared limit before reading", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_BODY_BYTES + 1),
      },
      body: "{}",
    });
    await expect(parseJsonBody(request)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects an oversized streamed body with no Content-Length", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(MAX_BODY_BYTES + 1),
    });
    // A constructed Request exposes no Content-Length, so this exercises the
    // streamed cap rather than the header pre-check.
    expect(request.headers.get("content-length")).toBeNull();
    await expect(parseJsonBody(request)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects a body whose declared Content-Length is within the limit but whose streamed body is not", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "10" },
      body: "x".repeat(MAX_BODY_BYTES + 1),
    });
    expect(request.headers.get("content-length")).toBe("10");
    await expect(parseJsonBody(request)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects a non-JSON content type", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: '{"email":"a@b.com"}',
    });
    await expect(parseJsonBody(request)).resolves.toEqual({
      ok: false,
      reason: "unsupported_media_type",
    });
  });

  it("accepts a JSON content type with a charset parameter", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: '{"a":1}',
    });
    await expect(parseJsonBody(request)).resolves.toEqual({
      ok: true,
      value: { a: 1 },
    });
  });

  it("rejects a request with no Content-Type header", async () => {
    // undici auto-sets `text/plain` for string bodies, so use a stub to
    // exercise the truly-missing-header branch.
    const request = {
      headers: new Headers(),
      body: new Response('{"a":1}').body,
    } as unknown as Request;
    await expect(parseJsonBody(request)).resolves.toEqual({
      ok: false,
      reason: "unsupported_media_type",
    });
  });
});

describe("describeErrorForLog", () => {
  it("strips bound query parameters and keeps the error name", () => {
    const error = new DrizzleQueryError(
      'insert into "users" ("email", "password_hash") values ($1, $2)',
      ["user@example.com", "scrypt$deadbeef"],
    );
    const description = describeErrorForLog(error);
    expect(description).not.toContain("user@example.com");
    expect(description).not.toContain("scrypt$");
    expect(description).toContain("Error:");
    expect(description).toContain("Failed query");
  });

  it("handles non-Error values", () => {
    expect(describeErrorForLog("boom")).toBe("string");
    expect(describeErrorForLog(undefined)).toBe("undefined");
  });
});

describe("isNextControlFlowError", () => {
  it("is true for an error carrying a string digest", () => {
    expect(isNextControlFlowError({ digest: "NEXT_PRERENDER" })).toBe(true);
    expect(
      isNextControlFlowError(
        Object.assign(new Error("prerender"), { digest: "NEXT_PRERENDER" }),
      ),
    ).toBe(true);
  });

  it("is false for other values", () => {
    expect(isNextControlFlowError(new Error("plain"))).toBe(false);
    expect(isNextControlFlowError(null)).toBe(false);
    expect(isNextControlFlowError(undefined)).toBe(false);
    expect(isNextControlFlowError("NEXT_PRERENDER")).toBe(false);
    expect(isNextControlFlowError({ digest: 42 })).toBe(false);
  });
});

describe("error responses", () => {
  it("use consistent JSON bodies and statuses", async () => {
    const malformed = malformedJsonResponse();
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "The request body must be valid JSON.",
      },
    });

    const tooLarge = payloadTooLargeResponse();
    expect(tooLarge.status).toBe(413);
    expect((await tooLarge.json()).error.code).toBe("payload_too_large");

    const unsupported = unsupportedMediaTypeResponse();
    expect(unsupported.status).toBe(415);
    expect((await unsupported.json()).error.code).toBe(
      "unsupported_media_type",
    );

    const server = serverErrorResponse();
    expect(server.status).toBe(500);
    expect((await server.json()).error.code).toBe("internal_error");
  });
});
