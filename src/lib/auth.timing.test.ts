// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spy on the password helpers while keeping the real module for the rest.
const password = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("./password", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./password")>();
  return {
    ...actual,
    verifyPassword: password.verifyPassword,
    hashPassword: password.hashPassword,
  };
});

type SignIn = (typeof import("./auth"))["signIn"];

/** Load a fresh `signIn` so the module-level dummy-hash cache is isolated. */
async function loadSignIn(): Promise<SignIn> {
  vi.resetModules();
  return (await import("./auth")).signIn;
}

/** A stub database whose `select(...).from(...).where(...).limit(1)` is empty. */
function databaseWithNoUser(): Parameters<SignIn>[0] {
  const limit = vi.fn().mockResolvedValue([]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { select } as unknown as Parameters<SignIn>[0];
}

const DUMMY_HASH = "scrypt$16384$8$1$c2FsdA==$aGFzaA==";

/**
 * Regression guards for the unknown-email timing-equalization path.
 */
describe("signIn unknown-email timing equalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    password.verifyPassword.mockResolvedValue(false);
    password.hashPassword.mockResolvedValue(DUMMY_HASH);
  });

  it("performs a password verification even when the email is unknown", async () => {
    const signIn = await loadSignIn();

    const outcome = await signIn(databaseWithNoUser(), {
      email: "nobody@example.com",
      password: "correct-horse",
    });

    expect(outcome.status).toBe(401);
    expect(password.verifyPassword).toHaveBeenCalledTimes(1);
    const [, storedHash] = password.verifyPassword.mock.calls[0] as [
      string,
      string,
    ];
    expect(storedHash).toMatch(/^scrypt\$/);
  });

  it("recovers after a failed dummy-hash creation instead of caching the rejection", async () => {
    const signIn = await loadSignIn();

    password.hashPassword.mockRejectedValueOnce(new Error("scrypt failed"));

    await expect(
      signIn(databaseWithNoUser(), {
        email: "nobody@example.com",
        password: "correct-horse",
      }),
    ).rejects.toThrow("scrypt failed");

    // A later request must retry rather than reuse the rejected promise.
    const outcome = await signIn(databaseWithNoUser(), {
      email: "nobody@example.com",
      password: "correct-horse",
    });

    expect(outcome.status).toBe(401);
    expect(password.hashPassword).toHaveBeenCalledTimes(2);
    expect(password.verifyPassword).toHaveBeenCalledTimes(1);
  });
});
