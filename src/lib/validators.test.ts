// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  isValidEmail,
  normalizeEmail,
  validateSignInInput,
  validateSignUpInput,
} from "./validators";

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("first.last@sub.example.co")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("no-at-sign")).toBe(false);
    expect(isValidEmail("missing@domain")).toBe(false);
    expect(isValidEmail("two@@example.com")).toBe(false);
    expect(isValidEmail("spaces in@example.com")).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims surrounding whitespace and lower-cases", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });
});

describe("validateSignUpInput", () => {
  it("accepts a valid body and normalizes the email", () => {
    const result = validateSignUpInput({
      email: "  New.User@Example.com ",
      password: "correct-horse",
    });
    expect(result).toEqual({
      ok: true,
      value: { email: "new.user@example.com", password: "correct-horse" },
    });
  });

  it("does not trim the password", () => {
    const result = validateSignUpInput({
      email: "user@example.com",
      password: "  padded  ",
    });
    expect(result.ok && result.value.password).toBe("  padded  ");
  });

  it("rejects a malformed email", () => {
    const result = validateSignUpInput({
      email: "not-an-email",
      password: "correct-horse",
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.map((i) => i.field)).toContain("email");
  });

  it("rejects a password shorter than the minimum", () => {
    const result = validateSignUpInput({
      email: "user@example.com",
      password: "short",
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues[0]?.field).toBe("password");
  });

  it("rejects an over-long password", () => {
    const result = validateSignUpInput({
      email: "user@example.com",
      password: "a".repeat(201),
    });
    expect(result.ok).toBe(false);
  });

  it("rejects non-string and missing fields", () => {
    expect(validateSignUpInput({ email: 42, password: null }).ok).toBe(false);
    expect(validateSignUpInput({}).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(validateSignUpInput("nope").ok).toBe(false);
    expect(validateSignUpInput(null).ok).toBe(false);
    expect(validateSignUpInput(["a"]).ok).toBe(false);
  });
});

describe("validateSignInInput", () => {
  it("accepts a valid body", () => {
    const result = validateSignInInput({
      email: "user@example.com",
      password: "correct-horse",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a short password so pre-existing accounts can sign in", () => {
    // The sign-up minimum length is not applied on sign-in; the stored hash is
    // the source of truth (for example a bootstrap admin seeded with a short
    // password).
    const result = validateSignInInput({
      email: "user@example.com",
      password: "seven77",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = validateSignInInput({
      email: "user@example.com",
      password: "",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(
      validateSignInInput({ email: "nope", password: "password" }).ok,
    ).toBe(false);
  });
});
