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
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await derive(password, salt, KEY_LENGTH, { N, r: R, p: P });

  return [
    PREFIX,
    N,
    R,
    P,
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
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) {
    return false;
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
    return false;
  }

  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }

  // Size the memory limit for the stored parameters so valid hashes above
  // Node's default `maxmem` still verify; any derivation error yields `false`.
  const maxmem = 128 * n * r * 2;
  try {
    const derived = await derive(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem,
    });
    return (
      derived.length === expected.length && timingSafeEqual(derived, expected)
    );
  } catch {
    return false;
  }
}
