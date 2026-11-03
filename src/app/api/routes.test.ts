// @vitest-environment node
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Route-handler tests for the HTTP layer: status mapping, JSON error shape, and
 * session-cookie attributes. The database and the auth logic are mocked, so
 * these run without a database and without a running Next.js server (F-2).
 */

const mocks = vi.hoisted(() => ({
  setCookie: vi.fn(),
  getCookie: vi.fn(),
  signUp: vi.fn(),
  signIn: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mocks.getCookie,
    set: mocks.setCookie,
  })),
}));

vi.mock("@/db", () => ({ db: {} }));

vi.mock("@/lib/auth", () => ({
  signUp: mocks.signUp,
  signIn: mocks.signIn,
  getCurrentUser: mocks.getCurrentUser,
}));

import { GET as meGet } from "./me/route";
import { POST as signInPost } from "./signin/route";
import { POST as signUpPost } from "./signup/route";

const PUBLIC_USER = { id: "u1", email: "user@example.com", role: "user" };

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * A JSON body sent as a stream, so the Fetch implementation does not add a
 * `Content-Type` header (a plain string body is sent as `text/plain`).
 */
function jsonStreamRequest(path: string, body: unknown): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));
      controller.close();
    },
  });
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  consoleError.mockRestore();
});

describe("POST /api/signup", () => {
  it("returns 201 and sets an HttpOnly session cookie on success", async () => {
    const expiresAt = new Date("2027-01-01T00:00:00Z");
    mocks.signUp.mockResolvedValue({
      status: 201,
      user: PUBLIC_USER,
      session: { id: "session-1", userId: "u1", expiresAt },
    });

    const response = await signUpPost(
      jsonRequest("/api/signup", {
        email: "user@example.com",
        password: "correct-horse",
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ user: PUBLIC_USER });

    expect(mocks.setCookie).toHaveBeenCalledTimes(1);
    const [name, value, options] = mocks.setCookie.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe(SESSION_COOKIE_NAME);
    expect(value).toBe("session-1");
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    expect(typeof options.secure).toBe("boolean");
  });

  it("passes through a 409 conflict without setting a cookie", async () => {
    mocks.signUp.mockResolvedValue({
      status: 409,
      body: { error: { code: "email_taken", message: "exists" } },
    });

    const response = await signUpPost(
      jsonRequest("/api/signup", {
        email: "user@example.com",
        password: "correct-horse",
      }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("email_taken");
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON without calling the handler", async () => {
    const response = await signUpPost(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_request");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("returns 415 for a non-JSON content type", async () => {
    const response = await signUpPost(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({
          email: "user@example.com",
          password: "correct-horse",
        }),
      }),
    );

    expect(response.status).toBe(415);
    expect((await response.json()).error.code).toBe("unsupported_media_type");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("returns 413 for an oversized body", async () => {
    const response = await signUpPost(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(16 * 1024 + 1),
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("payload_too_large");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("returns a JSON 500 when the handler throws", async () => {
    mocks.signUp.mockRejectedValue(new Error("database down"));

    const response = await signUpPost(jsonRequest("/api/signup", {}));

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("returns a JSON 500 when setting the session cookie fails", async () => {
    mocks.signUp.mockResolvedValue({
      status: 201,
      user: PUBLIC_USER,
      session: { id: "session-1", userId: "u1", expiresAt: new Date() },
    });
    mocks.setCookie.mockImplementationOnce(() => {
      throw new Error("cookie write failed");
    });

    const response = await signUpPost(
      jsonRequest("/api/signup", {
        email: "user@example.com",
        password: "correct-horse",
      }),
    );

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });

  it("rethrows a Next.js control-flow error from the cookie step", async () => {
    mocks.signUp.mockResolvedValue({
      status: 201,
      user: PUBLIC_USER,
      session: { id: "session-1", userId: "u1", expiresAt: new Date() },
    });
    mocks.setCookie.mockImplementationOnce(() => {
      throw Object.assign(new Error("prerender"), {
        digest: "NEXT_PRERENDER",
      });
    });

    await expect(
      signUpPost(
        jsonRequest("/api/signup", {
          email: "user@example.com",
          password: "correct-horse",
        }),
      ),
    ).rejects.toThrow("prerender");
  });

  it("does not log bound query parameters on the error path", async () => {
    mocks.signUp.mockRejectedValue(
      new Error(
        'Failed query: insert into "users" ("email", "password_hash", "role") ' +
          "values ($1, $2, $3)\n" +
          "params: user@example.com,scrypt$deadbeef,user",
      ),
    );

    const response = await signUpPost(
      jsonRequest("/api/signup", {
        email: "user@example.com",
        password: "correct-horse",
      }),
    );

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalled();
    const logged = consoleError.mock.calls
      .map((call: unknown[]) =>
        call.map((arg: unknown) => String(arg)).join(" "),
      )
      .join("\n");
    expect(logged).not.toContain("scrypt$");
    expect(logged).not.toContain("user@example.com");
  });

  it("returns 415 when the Content-Type header is missing", async () => {
    const request = jsonStreamRequest("/api/signup", {
      email: "user@example.com",
      password: "correct-horse",
    });
    // A streamed body avoids the automatic `text/plain` content type.
    expect(request.headers.get("content-type")).toBeNull();

    const response = await signUpPost(request);

    expect(response.status).toBe(415);
    expect((await response.json()).error.code).toBe("unsupported_media_type");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
});

describe("POST /api/signin", () => {
  it("returns 200 and sets a session cookie on success", async () => {
    const expiresAt = new Date("2027-01-01T00:00:00Z");
    mocks.signIn.mockResolvedValue({
      status: 200,
      user: PUBLIC_USER,
      session: { id: "session-2", userId: "u1", expiresAt },
    });

    const response = await signInPost(
      jsonRequest("/api/signin", {
        email: "user@example.com",
        password: "correct-horse",
      }),
    );

    expect(response.status).toBe(200);
    const [name, value] = mocks.setCookie.mock.calls[0] as [string, string];
    expect(name).toBe(SESSION_COOKIE_NAME);
    expect(value).toBe("session-2");
  });

  it("returns 401 and does not set a cookie on invalid credentials", async () => {
    mocks.signIn.mockResolvedValue({
      status: 401,
      body: { error: { code: "invalid_credentials", message: "nope" } },
    });

    const response = await signInPost(
      jsonRequest("/api/signin", {
        email: "user@example.com",
        password: "wrong",
      }),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("invalid_credentials");
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON without calling the handler", async () => {
    const response = await signInPost(
      new Request("http://localhost/api/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_request");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("returns 415 for a non-JSON content type", async () => {
    const response = await signInPost(
      new Request("http://localhost/api/signin", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({
          email: "user@example.com",
          password: "correct-horse",
        }),
      }),
    );

    expect(response.status).toBe(415);
    expect((await response.json()).error.code).toBe("unsupported_media_type");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("returns 413 for an oversized body", async () => {
    const response = await signInPost(
      new Request("http://localhost/api/signin", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(16 * 1024 + 1),
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("payload_too_large");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("returns a JSON 500 when the handler throws", async () => {
    mocks.signIn.mockRejectedValue(new Error("database down"));

    const response = await signInPost(jsonRequest("/api/signin", {}));

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });

  it("returns a JSON 500 when setting the session cookie fails", async () => {
    mocks.signIn.mockResolvedValue({
      status: 200,
      user: PUBLIC_USER,
      session: { id: "session-2", userId: "u1", expiresAt: new Date() },
    });
    mocks.setCookie.mockImplementationOnce(() => {
      throw new Error("cookie write failed");
    });

    const response = await signInPost(
      jsonRequest("/api/signin", {
        email: "user@example.com",
        password: "correct-horse",
      }),
    );

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });

  it("rethrows a Next.js control-flow error from the cookie step", async () => {
    mocks.signIn.mockResolvedValue({
      status: 200,
      user: PUBLIC_USER,
      session: { id: "session-2", userId: "u1", expiresAt: new Date() },
    });
    mocks.setCookie.mockImplementationOnce(() => {
      throw Object.assign(new Error("prerender"), {
        digest: "NEXT_PRERENDER",
      });
    });

    await expect(
      signInPost(
        jsonRequest("/api/signin", {
          email: "user@example.com",
          password: "correct-horse",
        }),
      ),
    ).rejects.toThrow("prerender");
  });
});

describe("GET /api/me", () => {
  it("returns the user when the session cookie is valid", async () => {
    mocks.getCookie.mockReturnValue({ value: "session-1" });
    mocks.getCurrentUser.mockResolvedValue(PUBLIC_USER);

    const response = await meGet();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: PUBLIC_USER });
    expect(mocks.getCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
    expect(mocks.getCurrentUser).toHaveBeenCalledWith(
      expect.anything(),
      "session-1",
    );
  });

  it("returns 401 when there is no valid session", async () => {
    mocks.getCookie.mockReturnValue(undefined);
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await meGet();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
  });

  it("returns a JSON 500 when the handler throws", async () => {
    mocks.getCookie.mockReturnValue({ value: "session-1" });
    mocks.getCurrentUser.mockRejectedValue(new Error("database down"));

    const response = await meGet();

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });

  it("does not log the session id on the error path", async () => {
    mocks.getCookie.mockReturnValue({ value: "session-1" });
    mocks.getCurrentUser.mockRejectedValue(
      new DrizzleQueryError(
        'select "users"."id" from "sessions" where "sessions"."id" = $1',
        ["session-1"],
        new Error("database down"),
      ),
    );

    const response = await meGet();

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
    const logged = consoleError.mock.calls
      .map((call: unknown[]) =>
        call.map((arg: unknown) => String(arg)).join(" "),
      )
      .join("\n");
    expect(logged).not.toContain("session-1");
  });
});
