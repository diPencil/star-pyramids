// Backend core — environment-neutral (Next.js server runtime AND trusted
// Node CLI scripts). Pure functions only: no browser APIs, no Next.js
// imports, no Prisma. Same boundary rules as lib/core/password.ts —
// server/CLI only, never client components.
//
// The server MUST never trust localStorage, query strings, form payloads,
// cart totals, client-computed prices, or role claims from the browser.

const EMAIL_PATTERN = /^[^\s@]{1,120}@[^\s@]{1,120}\.[^\s@]{2,24}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const PHONE_PATTERN = /^[0-9 ()-]{6,18}$/;

export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 8;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function validatePasswordStrength(password: string): string | null {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return 'Password is too long.';
  }
  return null;
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username.trim());
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidPersonName(name: string): boolean {
  const value = name.trim();
  return value.length >= 1 && value.length <= 80 && !/[\u0000-\u001f\u007f]/.test(value);
}

export function isValidCountryCode(code: string): boolean {
  return COUNTRY_CODE_PATTERN.test(code.trim().toUpperCase());
}

export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone.trim());
}

export function isValidCurrencyCode(code: string): boolean {
  return CURRENCY_PATTERN.test(code);
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 160 && SLUG_PATTERN.test(slug);
}

/** Strict YYYY-MM-DD calendar-date check (mirrors the frontend date contract). */
export function isValidYmd(date: string): boolean {
  const match = YMD_PATTERN.exec(date);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/** Parse a bounded integer (counts, pagination). Returns null when invalid. */
export function parseBoundedInt(
  value: unknown,
  min: number,
  max: number,
): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    return null;
  }
  return n;
}
