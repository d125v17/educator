const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/** Environment values used by the reset guard. */
export type ResetGuardEnv = Record<string, string | undefined>;

/**
 * Throws unless the configured database host is loopback, or the operator has
 * explicitly opted in via `ALLOW_DESTRUCTIVE_DB_RESET=true`.
 *
 * Used to prevent `npm run db:reset` from dropping schemas on a non-local
 * database by accident.
 */
export function assertResetAllowed(env: ResetGuardEnv = process.env): void {
  const host = env.POSTGRES_HOST ?? "127.0.0.1";
  if (LOOPBACK_HOSTS.has(host) || env.ALLOW_DESTRUCTIVE_DB_RESET === "true") {
    return;
  }

  throw new Error(
    `Refusing to reset: POSTGRES_HOST="${host}" is not loopback. ` +
      "Set ALLOW_DESTRUCTIVE_DB_RESET=true to override.",
  );
}
