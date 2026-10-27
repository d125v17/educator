import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

import { databaseUrl } from "./src/db/url";

loadEnvConfig(process.cwd());

/**
 * `drizzle-kit generate` is offline and does not connect, so it must not
 * require database credentials. Fall back to a placeholder URL when the
 * password is not configured; commands that actually connect (which we run
 * through our own migration script, not drizzle-kit) still require it.
 */
function credentialsUrl(): string {
  try {
    return databaseUrl();
  } catch {
    return "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder";
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: credentialsUrl(),
  },
});
