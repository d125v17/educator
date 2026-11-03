// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  hashPassword,
  isSupportedStoredHash,
  verifyPassword,
} from "./password";

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

  it("verifies a valid hash whose N exceeds the default maxmem", async () => {
    // N=65536, r=8 needs ~64 MiB, above Node's default 32 MiB maxmem, so this
    // only succeeds if verifyPassword sizes maxmem for the stored parameters.
    const hash = await hashPassword("some-password", { N: 65536, r: 8, p: 1 });
    await expect(verifyPassword("some-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("rejects stored parameters that exceed the scrypt memory budget", async () => {
    const hash = await hashPassword("some-password");
    const parts = hash.split("$");
    parts[1] = String(1 << 20); // N=2^20 with r=8 needs ~1 GiB
    parts[2] = "8";
    expect(isSupportedStoredHash(parts.join("$"))).toBe(false);
  });

  it("rejects a stored derived key longer than KEY_LENGTH", async () => {
    const hash = await hashPassword("some-password");
    const parts = hash.split("$");
    parts[5] = Buffer.alloc(65).toString("base64");
    expect(isSupportedStoredHash(parts.join("$"))).toBe(false);
  });

  it("accepts a well-formed stored hash", async () => {
    const hash = await hashPassword("some-password");
    expect(isSupportedStoredHash(hash)).toBe(true);
  });
});
