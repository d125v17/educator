// @vitest-environment node
import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces a self-describing scrypt hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash.split("$")).toHaveLength(6);
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(
      verifyPassword("correct horse battery staple", hash),
    ).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("s3cret-password");
    await expect(verifyPassword("not-the-password", hash)).resolves.toBe(false);
  });

  it("salted: the same password hashes differently each time", async () => {
    const first = await hashPassword("same-password");
    const second = await hashPassword("same-password");
    expect(first).not.toBe(second);
    await expect(verifyPassword("same-password", first)).resolves.toBe(true);
    await expect(verifyPassword("same-password", second)).resolves.toBe(true);
  });

  it("returns false for a malformed stored value", async () => {
    await expect(verifyPassword("anything", "not-a-hash")).resolves.toBe(false);
  });

  it("rejects a hash whose parameters are out of range", async () => {
    const hash = await hashPassword("some-password");
    const parts = hash.split("$");
    parts[1] = "1024"; // N below the accepted minimum
    await expect(
      verifyPassword("some-password", parts.join("$")),
    ).resolves.toBe(false);
  });

  it("returns false (does not throw) for in-bounds parameters above the default maxmem", async () => {
    const hash = await hashPassword("some-password");
    const parts = hash.split("$");
    parts[1] = "32768"; // r=8 with N=32768 exceeds Node's default 32 MiB maxmem
    await expect(
      verifyPassword("some-password", parts.join("$")),
    ).resolves.toBe(false);
  });
});
