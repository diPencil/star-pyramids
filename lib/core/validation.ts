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
/**
 * Canonical phone contract (shared by every server endpoint that accepts
 * phone numbers from the shared InternationalPhoneInput):
 * - optional single leading `+` (international/E.164-style output),
 * - digits with optional visual separators (space, parens, dash),
 * - 6–15 digits total (E.164 maximum).
 * Accepts both stored national form (`100 000 0000`) and component output
 * (`+20 100 000 0000`, `+201000000000`). Rejects empty, malformed and
 * double-prefix (`+20+20…`) values.
 */
const PHONE_PATTERN = /^\+?[0-9 ()-]{6,18}$/;

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
  const text = phone.trim();
  if (!PHONE_PATTERN.test(text)) return false;
  const digits = text.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
}

/**
 * Canonical phone storage form: compact digits with a single leading `+`
 * when the input was international (`+20 100 000 0000` → `+201000000000`),
 * compact digits otherwise (`100 000 0000` → `1000000000`). Already-stored
 * spaced values keep working because every reader strips separators.
 */
export function normalizePhone(phone: string): string {
  const text = phone.trim();
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  if (!digits) return '';
  return text.startsWith('+') ? `+${digits}` : digits;
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
