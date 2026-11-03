/**
 * Builds the PostgreSQL connection URL from the local `POSTGRES_*` environment
 * variables established by TASK-001.
 *
 * `POSTGRES_PASSWORD` is required: there is no hardcoded fallback credential.
 * The remaining values default to the local-only settings from `.env.example`.
 * There is intentionally no `DATABASE_URL` override.
 */
export function databaseUrl(): string {
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) {
    throw new Error(
      "POSTGRES_PASSWORD is not set. Configure it in .env (see .env.example).",
    );
  }

  const user = process.env.POSTGRES_USER || "educator";
  const port = process.env.POSTGRES_PORT || "5432";
  const database = process.env.POSTGRES_DB || "educator";
  const host = normalizeHost(process.env.POSTGRES_HOST || "127.0.0.1");

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
    password,
  )}@${host}:${port}/${database}`;
}

/** Wraps IPv6 hosts in brackets so they form a valid URL authority. */
function normalizeHost(host: string): string {
  if (host.startsWith("[")) {
    return host;
  }
  return host.includes(":") ? `[${host}]` : host;
}
