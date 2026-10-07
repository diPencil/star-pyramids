'use client';

import { ENABLED_LOCALES, sanitizeLocale } from './locale-config';
import type { SocialLink } from './admin-store';

/**
 * Single-flight public settings reader. The database is the source of
 * truth; values live only in memory (never in localStorage) and every
 * consumer falls back to its built-in defaults until they arrive.
 * Domain hooks keep their existing event subscriptions (`sp-brand`,
 * `sp-social`, `sp-currency`, `sp-l10n`) — this module re-emits those
 * events when DB values land so every consumer refreshes.
 */

let inflight: Promise<void> | null = null;
let brand: Record<string, string> | null = null;
let social: SocialLink[] | null = null;
let currency: { eur?: number; egp?: number; defaultCurrency?: 'USD' | 'EUR' | 'EGP' } | null = null;
let localization: { defaultLanguage?: string; timezone?: string } | null = null;

function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function cleanString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function cleanRate(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function cleanSocial(value: unknown): SocialLink[] | null {
  if (!Array.isArray(value)) return null;
  const valid = (value as unknown[]).filter(
    (entry): entry is SocialLink =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as SocialLink).id === 'string' &&
      typeof (entry as SocialLink).url === 'string',
  );
  return valid.length > 0 ? valid : null;
}

type RawSettings = {
  brand?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  social?: unknown;
  localization?: { defaultLanguage?: unknown; timezone?: unknown };
  currency?: { defaultCurrency?: unknown };
  rates?: { eur?: unknown; egp?: unknown };
};

const BRAND_FIELDS = [
  'companyName',
  'logo',
  'favicon',
  'aboutEn',
  'aboutAr',
  'phone',
  'whatsapp',
  'email',
  'address',
  'mapUrl',
  'copyrightEn',
  'copyrightAr',
] as const;

function applySettings(data: { settings?: unknown }): void {
  const raw = (data.settings ?? {}) as RawSettings;
  const merged = { ...(raw.brand ?? {}), ...(raw.contact ?? {}) };
  const nextBrand: Record<string, string> = {};
  for (const key of BRAND_FIELDS) {
    const cleaned = cleanString(merged[key]);
    if (cleaned) nextBrand[key] = cleaned;
  }
  if (Object.keys(nextBrand).length > 0) {
    brand = nextBrand;
    window.dispatchEvent(new Event('sp-brand'));
  }

  const nextSocial = cleanSocial(raw.social);
  if (nextSocial) {
    social = nextSocial;
    window.dispatchEvent(new Event('sp-social'));
  }

  const nextCurrency: NonNullable<typeof currency> = {};
  const eur = cleanRate(raw.rates?.eur);
  const egp = cleanRate(raw.rates?.egp);
  if (eur > 0) nextCurrency.eur = eur;
  if (egp > 0) nextCurrency.egp = egp;
  const currencyRaw = cleanString(raw.currency?.defaultCurrency);
  if (currencyRaw === 'USD' || currencyRaw === 'EUR' || currencyRaw === 'EGP') {
    nextCurrency.defaultCurrency = currencyRaw;
  }
  if (Object.keys(nextCurrency).length > 0) {
    currency = { ...currency, ...nextCurrency };
    window.dispatchEvent(new Event('sp-currency'));
  }

  const nextLocalization: NonNullable<typeof localization> = {};
  const localeRaw = cleanString(raw.localization?.defaultLanguage);
  if ((ENABLED_LOCALES as readonly string[]).includes(localeRaw)) {
    nextLocalization.defaultLanguage = sanitizeLocale(localeRaw);
  }
  const timezoneRaw = cleanString(raw.localization?.timezone);
  if (isValidTimezone(timezoneRaw)) {
    nextLocalization.timezone = timezoneRaw;
  }
  if (Object.keys(nextLocalization).length > 0) {
    localization = { ...localization, ...nextLocalization };
    window.dispatchEvent(new Event('sp-l10n'));
  }
}

export function getDbBrand(): Record<string, string> | null {
  return brand;
}

export function getDbSocial(): SocialLink[] | null {
  return social;
}

export function getDbCurrency(): NonNullable<typeof currency> | null {
  return currency;
}

export function getDbLocalization(): NonNullable<typeof localization> | null {
  return localization;
}

/** Fire-once fetch of the public settings snapshot. Safe to call on every mount. */
export function ensureStorefrontSettings(): void {
  if (typeof window === 'undefined' || inflight) return;
  inflight = (async () => {
    try {
      const res = await fetch('/api/settings', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = (await res.json()) as { settings?: unknown };
      if (data && typeof data === 'object') applySettings(data);
    } catch {
      // Offline or unreachable: hooks keep rendering built-in defaults.
    } finally {
      inflight = null;
    }
  })();
}
