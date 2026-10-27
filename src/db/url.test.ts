// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { databaseUrl } from "./url";

const original = { ...process.env };

beforeEach(() => {
  process.env = { ...original };
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
});
