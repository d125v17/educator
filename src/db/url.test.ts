// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { databaseUrl } from "./url";

const original = { ...process.env };

beforeEach(() => {
  process.env = { ...original };
  // Start from a clean slate so cases cannot inherit POSTGRES_* values loaded
  // into the worker by other suites (e.g. schema.test.ts loads `.env`).
  delete process.env.POSTGRES_USER;
  delete process.env.POSTGRES_PASSWORD;
  delete process.env.POSTGRES_DB;
  delete process.env.POSTGRES_HOST;
  delete process.env.POSTGRES_PORT;
});

afterEach(() => {
  process.env = { ...original };
});

describe("databaseUrl", () => {
  it("throws when POSTGRES_PASSWORD is not set", () => {
    delete process.env.POSTGRES_PASSWORD;
    expect(() => databaseUrl()).toThrow(/POSTGRES_PASSWORD/);
  });

  it("composes the URL from the POSTGRES_* variables", () => {
    process.env.POSTGRES_USER = "myuser";
    process.env.POSTGRES_PASSWORD = "mypassword";
    process.env.POSTGRES_DB = "mydb";
    process.env.POSTGRES_HOST = "db.internal";
    process.env.POSTGRES_PORT = "5433";

    expect(databaseUrl()).toBe(
      "postgresql://myuser:mypassword@db.internal:5433/mydb",
    );
  });

  it("URL-encodes special characters in the credentials", () => {
    process.env.POSTGRES_USER = "u";
    process.env.POSTGRES_PASSWORD = "p@ss word";
    process.env.POSTGRES_DB = "d";

    expect(databaseUrl()).toContain("p%40ss%20word");
  });

  it("treats empty variables as unset and falls back to the defaults", () => {
    process.env.POSTGRES_USER = "";
    process.env.POSTGRES_PASSWORD = "pw";
    process.env.POSTGRES_HOST = "";
    process.env.POSTGRES_PORT = "";
    process.env.POSTGRES_DB = "";

    expect(databaseUrl()).toBe(
      "postgresql://educator:pw@127.0.0.1:5432/educator",
    );
  });

  it("brackets IPv6 hosts to form a valid URL authority", () => {
    process.env.POSTGRES_PASSWORD = "pw";
    process.env.POSTGRES_HOST = "::1";

    expect(databaseUrl()).toBe("postgresql://educator:pw@[::1]:5432/educator");
  });
});
