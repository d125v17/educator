// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { isSessionId, sessionCookieOptions } from "./session";

describe("sessionCookieOptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets HttpOnly, SameSite=Lax, Path=/ and the expiry", () => {
    const expires = new Date("2027-01-01T00:00:00Z");
    const options = sessionCookieOptions(expires);

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.expires).toBe(expires);
  });

  it("sets Secure only in production, treating an unset NODE_ENV as development", () => {
    const expires = new Date();

    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions(expires).secure).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieOptions(expires).secure).toBe(false);

    vi.stubEnv("NODE_ENV", undefined);
    expect(sessionCookieOptions(expires).secure).toBe(false);
  });
});

describe("isSessionId", () => {
  it("accepts a UUID and rejects malformed values", () => {
    expect(isSessionId("0ba170ae-6fee-403a-b87d-576ba772ff68")).toBe(true);
    expect(isSessionId("not-a-uuid")).toBe(false);
    expect(isSessionId("")).toBe(false);
  });
});
