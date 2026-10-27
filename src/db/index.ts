import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";
import { databaseUrl } from "./url";

// Load `.env` for scripts (Next.js already loads it at runtime). Must run
// before the pool is created.
loadEnvConfig(process.cwd());

/**
 * Shared `pg` connection pool and Drizzle client.
 *
 * Server-only: do not import this module from client components, or the `pg`
 * driver would be bundled into the browser.
 */
const pool = new Pool({ connectionString: databaseUrl() });

export const db = drizzle(pool, { schema });
export { pool };
