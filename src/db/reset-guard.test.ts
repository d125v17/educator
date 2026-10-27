// @vitest-environment node
import { describe, expect, it } from "vitest";

import { assertResetAllowed } from "./reset-guard";

describe("assertResetAllowed", () => {
  it("allows loopback hosts and the default", () => {
    expect(() => assertResetAllowed({})).not.toThrow();
    expect(() =>
      assertResetAllowed({ POSTGRES_HOST: "127.0.0.1" }),
    ).not.toThrow();
    expect(() =>
      assertResetAllowed({ POSTGRES_HOST: "localhost" }),
    ).not.toThrow();
    expect(() => assertResetAllowed({ POSTGRES_HOST: "::1" })).not.toThrow();
  });

  it("refuses a non-loopback host", () => {
    expect(() =>
      assertResetAllowed({ POSTGRES_HOST: "db.example.com" }),
    ).toThrow(/not loopback/);
  });

  it("allows a non-loopback host with the explicit override", () => {
    expect(() =>
      assertResetAllowed({
        POSTGRES_HOST: "db.example.com",
        ALLOW_DESTRUCTIVE_DB_RESET: "true",
      }),
    ).not.toThrow();
  });
});
