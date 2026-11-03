/**
 * Input validation for the sign-up and sign-in endpoints.
 *
 * Pure, dependency-free helpers so they can be unit-tested without a database.
 * Validation never trims a password: leading/trailing spaces are significant.
 */

/** Maximum accepted email length, per the practical RFC 5321 limit. */
export const EMAIL_MAX_LENGTH = 254;

/** Minimum password length enforced when an account is created. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Maximum password length accepted, to bound the work a single request can ask
 * the scrypt-based hasher to perform.
 */
export const PASSWORD_MAX_LENGTH = 200;

/**
 * Intentionally simple email format: a non-empty local part, a single `@`, and
 * a domain with at least one dot. Deliberately not a full RFC 5322 grammar.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/** A single field-level validation problem. */
export interface ValidationIssue {
  field: string;
  message: string;
}

/** The validated credentials shared by sign-up and sign-in. */
export interface Credentials {
  email: string;
  password: string;
}

/** Result of validating a request body. */
export type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

/** Whether `value` looks like an email address this project accepts. */
export function isValidEmail(value: string): boolean {
  return value.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(value);
}

/** Normalizes an email for storage and lookup (trimmed, lower-cased). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function readField(body: unknown, field: string): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined;
  }
  return (body as Record<string, unknown>)[field];
}

function readEmail(body: unknown, issues: ValidationIssue[]): string | null {
  const raw = readField(body, "email");
  if (typeof raw !== "string") {
    issues.push({ field: "email", message: "Email is required." });
    return null;
  }

  const email = normalizeEmail(raw);
  if (!isValidEmail(email)) {
    issues.push({ field: "email", message: "Enter a valid email address." });
    return null;
  }
  return email;
}

/**
 * Validates a sign-up body: email must be well-formed and the password must be
 * between {@link PASSWORD_MIN_LENGTH} and {@link PASSWORD_MAX_LENGTH} characters.
 */
export function validateSignUpInput(
  body: unknown,
): ValidationResult<Credentials> {
  const issues: ValidationIssue[] = [];

  const email = readEmail(body, issues);

  const password = readField(body, "password");
  if (typeof password !== "string") {
    issues.push({ field: "password", message: "Password is required." });
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    issues.push({
      field: "password",
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    issues.push({
      field: "password",
      message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
    });
  }

  if (email === null || typeof password !== "string") {
    return { ok: false, issues };
  }
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return { ok: false, issues };
  }

  return { ok: true, value: { email, password } };
}

/**
 * Validates a sign-in body. Email must be well-formed and the password must be
 * a non-empty string. The sign-up length policy is intentionally not applied
 * here so that pre-existing accounts (for example the bootstrap admin) can
 * still authenticate; the stored hash is the source of truth.
 */
export function validateSignInInput(
  body: unknown,
): ValidationResult<Credentials> {
  const issues: ValidationIssue[] = [];

  const email = readEmail(body, issues);

  const password = readField(body, "password");
  if (typeof password !== "string" || password.length === 0) {
    issues.push({ field: "password", message: "Password is required." });
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    issues.push({
      field: "password",
      message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
    });
  }

  if (
    email === null ||
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return { ok: false, issues };
  }

  return { ok: true, value: { email, password } };
}
