import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

// scrypt cost parameters. N=16384, r=8, p=1 uses ~16 MiB and is a reasonable
// local-development default; raise N for stronger hashing in production.
const N = 16384;
const R = 8;
const P = 1;
const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const PREFIX = "scrypt";
// Bounds accepted when verifying a stored hash, to avoid pathological work
// from a crafted or corrupted hash.
const MIN_N = 16384;
const MAX_N = 1 << 20;
const MAX_R = 32;
const MAX_P = 16;
// Cap the scrypt memory budget (`128 * N * r` bytes) so a crafted or corrupted
// stored hash cannot force multi-gigabyte allocations during verification.
const MAX_MEMORY = 256 * 1024 * 1024;

/** scrypt cost parameters. */
export interface ScryptParameters {
  N: number;
  r: number;
  p: number;
}

/** Default scrypt cost parameters used by {@link hashPassword}. */
export const DEFAULT_SCRYPT_PARAMETERS: ScryptParameters = { N, r: R, p: P };

/** Approximate scrypt working memory in bytes for the given parameters. */
function memoryFor(n: number, r: number): number {
  return 128 * n * r;
}

function derive(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/**
 * Hashes a password with scrypt using a random per-password salt.
 *
 * Returns a self-describing string: `scrypt$N$r$p$<salt-b64>$<hash-b64>`.
 *
 * `parameters` defaults to the local-development cost parameters; tests use it
 * to produce hashes with non-default (but in-bounds) parameters.
 */
export async function hashPassword(
  password: string,
  parameters: ScryptParameters = DEFAULT_SCRYPT_PARAMETERS,
): Promise<string> {
  const { N: n, r, p } = parameters;
  const salt = randomBytes(SALT_BYTES);
  const derived = await derive(password, salt, KEY_LENGTH, {
    N: n,
    r,
    p,
    maxmem: memoryFor(n, r) * 2,
  });

  return [
    PREFIX,
    n,
    r,
    p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Verifies a password against a hash produced by {@link hashPassword}.
 * Uses a constant-time comparison. Returns false for malformed hashes.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) {
    return false;
  }

  const { n, r, p, salt, expected } = parsed;
  // Size the memory limit for the stored parameters so valid hashes above
  // Node's default `maxmem` still verify. `parseStoredHash` caps the budget;
  // any derivation error yields `false`.
  try {
    const derived = await derive(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: memoryFor(n, r) * 2,
    });
    return (
      derived.length === expected.length && timingSafeEqual(derived, expected)
    );
  } catch {
    return false;
  }
}

interface StoredHash {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  expected: Buffer;
}

/**
 * Parses and bounds-checks a stored hash. Returns `null` for malformed values
 * and for parameters that fall outside the accepted work/memory bounds.
 */
function parseStoredHash(stored: string): StoredHash | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) {
    return null;
  }

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (
    !Number.isInteger(n) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    n < MIN_N ||
    n > MAX_N ||
    r < 1 ||
    r > MAX_R ||
    p < 1 ||
    p > MAX_P
  ) {
    return null;
  }

  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (
    salt.length === 0 ||
    expected.length === 0 ||
    expected.length > KEY_LENGTH
  ) {
    return null;
  }

  if (memoryFor(n, r) > MAX_MEMORY) {
    return null;
  }

  return { n, r, p, salt, expected };
}

/** Whether a stored hash is well-formed and within the accepted bounds. */
export function isSupportedStoredHash(stored: string): boolean {
  return parseStoredHash(stored) !== null;
}
