// Authoritative site-settings service. Server owns company identity,
// locale/currency/timezone defaults and brand/social/configuration values.
// Browser-local prototype settings MUST NOT override these after
// frontend integration. Values are opaque strings; callers parse them.
//
// Two key classes:
// - PUBLIC keys: returned to staff browsers by GET /api/admin/settings.
// - SECRET keys: stored server-side only. The API returns only
//   `{ configured: boolean }` and never the stored value. An empty string
//   in a PATCH keeps the existing secret (this phase has no clear-secret
//   flow); a non-empty string replaces it.
// Currency rates live in the FxRate table (DECIMAL pairs, USD anchor),
// never in SiteSetting and never trusted from the browser.
import 'server-only';

import { Prisma } from '@prisma/client';

import { db } from './db';
import { getActiveRate } from './fx';
import { ENABLED_LOCALES } from '../locale-config';

export const SETTING_KEYS = {
  siteName: 'site.name',
  defaultLocale: 'app.defaultLocale',
  defaultCurrency: 'app.defaultCurrency',
  timezone: 'app.timezone',
} as const;

export const PUBLIC_SETTING_KEYS = [
  // General / brand
  'site.name',
  'site.logo',
  'site.favicon',
  'site.aboutEn',
  'site.aboutAr',
  // Contact
  'contact.phone',
  'contact.whatsapp',
  'contact.email',
  'contact.address',
  'contact.mapUrl',
  'contact.copyrightEn',
  'contact.copyrightAr',
  // Localization / currency defaults (rates live in FxRate)
  'app.defaultLocale',
  'app.defaultCurrency',
  'app.timezone',
  // Social (single JSON document, see SOCIAL_NETWORKS in lib/admin-store.ts)
  'social.links',
  // Website defaults / SEO
  'site.seoTitle',
  'site.promoText',
  'site.promo2Text',
  // Google Maps (non-secret configuration only)
  'maps.mapId',
  'maps.lat',
  'maps.lng',
  'maps.zoom',
  'maps.services',
  'maps.enabled',
  // WhatsApp (non-secret configuration only)
  'whatsapp.sessionName',
  'whatsapp.inbox',
  'whatsapp.enabled',
  'whatsapp.metaAppId',
  'whatsapp.wabaId',
  'whatsapp.phoneNumberId',
  // Email (non-secret configuration only)
  'mail.fromName',
  'mail.fromEmail',
  'mail.smtpHost',
  'mail.smtpPort',
  'mail.smtpEncryption',
  'mail.smtpUsername',
  'mail.smtpTimeout',
  'mail.imapProtocol',
  'mail.imapHost',
  'mail.imapPort',
  'mail.imapEncryption',
  'mail.imapUsername',
  'mail.mailbox',
  // Social login (non-secret configuration only)
  'auth.google.clientId',
  'auth.google.enabled',
  'auth.facebook.appId',
  'auth.facebook.enabled',
] as const;

export type PublicSettingKey = (typeof PUBLIC_SETTING_KEYS)[number];

/** Stored server-side only. Never returned to any browser, log, or error. */
export const SECRET_SETTING_KEYS = [
  'mail.smtpPassword',
  'mail.imapPassword',
  'whatsapp.accessToken',
  'whatsapp.verifyToken',
  'maps.browserKey',
  'auth.google.clientSecret',
  'auth.facebook.appSecret',
] as const;

export type SecretSettingKey = (typeof SECRET_SETTING_KEYS)[number];

const PUBLIC_KEYS = new Set<string>(PUBLIC_SETTING_KEYS);
const SECRET_KEYS = new Set<string>(SECRET_SETTING_KEYS);

const SOCIAL_NETWORKS = new Set([
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'x',
  'linkedin',
  'whatsapp',
  'telegram',
  'pinterest',
]);

const MAX_SECRET_LENGTH = 2000;

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isHttpUrl(value: string, maxLength: number): boolean {
  if (!value || value.length > maxLength || hasControlChars(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidTimezone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function isEnabledFlag(value: string): boolean {
  return value === 'true' || value === 'false';
}

function isIntInRange(value: string, min: number, max: number): boolean {
  if (!/^-?\d+$/.test(value.trim())) return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max;
}

function isDecimalString(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Strict per-key server validation. Unknown keys are rejected (no mass
 * assignment). Returns cleaned values plus human-readable errors.
 * Secrets are validated but never echoed back.
 */
export function validateSettingsPatch(input: {
  values?: unknown;
}): { clean: Record<string, string>; errors: string[] } {
  const clean: Record<string, string> = {};
  const errors: string[] = [];
  const values =
    typeof input.values === 'object' && input.values !== null
      ? (input.values as Record<string, unknown>)
      : null;
  if (!values) {
    return { clean, errors: ['Invalid request.'] };
  }

  const fail = (message: string): void => {
    errors.push(message);
  };

  for (const [key, raw] of Object.entries(values)) {
    const value = text(raw);
    if (value === null) {
      fail(`Invalid value for ${key}.`);
      continue;
    }
    const trimmed = value.trim();

    // Secrets: non-empty replaces, empty keeps the stored value.
    if (SECRET_KEYS.has(key)) {
      if (trimmed === '') continue;
      if (value.length > MAX_SECRET_LENGTH || hasControlChars(value)) {
        fail('A secret value is too long or contains invalid characters.');
        continue;
      }
      clean[key] = value;
      continue;
    }

    if (!PUBLIC_KEYS.has(key)) {
      fail(`Unknown setting: ${key}.`);
      continue;
    }

    const bounded = (min: number, max: number, label: string): boolean => {
      if (trimmed.length < min || value.length > max || (trimmed && hasControlChars(trimmed))) {
        fail(label);
        return false;
      }
      return true;
    };

    switch (key) {
      case 'site.name':
        if (bounded(1, 120, 'Enter a company name (1-120 characters).')) clean[key] = trimmed;
        break;
      case 'site.logo':
      case 'site.favicon': {
        if (
          trimmed.length < 1 ||
          value.length > 2000 ||
          hasControlChars(trimmed) ||
          !(
            trimmed.startsWith('/') ||
            trimmed.startsWith('https://') ||
            trimmed.startsWith('http://') ||
            trimmed.startsWith('data:image/')
          )
        ) {
          fail('Logo and favicon must be a site path, http(s) URL, or image data URL.');
          break;
        }
        clean[key] = trimmed;
        break;
      }
      case 'site.aboutEn':
      case 'site.aboutAr':
        if (value.length > 2000 || hasControlChars(value)) {
          fail('Footer tagline is too long.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'contact.phone':
      case 'contact.whatsapp': {
        const digits = trimmed.replace(/\D/g, '');
        if (
          trimmed.length < 6 ||
          trimmed.length > 32 ||
          !/^\+?[0-9 ()-]{6,32}$/.test(trimmed) ||
          digits.length < 6 ||
          digits.length > 15
        ) {
          fail('Enter a valid phone number (6-15 digits).');
          break;
        }
        clean[key] = trimmed;
        break;
      }
      case 'contact.email':
      case 'mail.fromEmail': {
        if (
          trimmed.length > 190 ||
          !/^[^\s@]{1,120}@[^\s@]{1,120}\.[^\s@]{2,24}$/.test(trimmed)
        ) {
          fail('Enter a valid email address.');
          break;
        }
        clean[key] = trimmed;
        break;
      }
      case 'contact.address':
        if (bounded(1, 500, 'Enter a company address (1-500 characters).')) clean[key] = trimmed;
        break;
      case 'contact.mapUrl':
        if (trimmed !== '' && !isHttpUrl(trimmed, 2000)) {
          fail('Google Maps URL must be a valid http(s) URL.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'contact.copyrightEn':
      case 'contact.copyrightAr':
        if (bounded(1, 500, 'Enter footer copyright text (1-500 characters).')) clean[key] = trimmed;
        break;
      case 'app.defaultLocale':
        // Dormant Arabic/RTL must never become publicly enabled here.
        if (!(ENABLED_LOCALES as readonly string[]).includes(trimmed)) {
          fail('Select an enabled public language (EN, ES, or IT).');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'app.defaultCurrency':
        if (trimmed !== 'USD' && trimmed !== 'EUR' && trimmed !== 'EGP') {
          fail('Select a supported default currency (USD, EUR, or EGP).');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'app.timezone':
        if (!isValidTimezone(trimmed)) {
          fail('Select a valid timezone.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'social.links': {
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed === '' ? '[]' : trimmed);
        } catch {
          fail('Social links are invalid.');
          break;
        }
        if (!Array.isArray(parsed) || parsed.length > 20) {
          fail('Social links are invalid.');
          break;
        }
        const ok = parsed.every((entry) => {
          if (typeof entry !== 'object' || entry === null) return false;
          const link = entry as Record<string, unknown>;
          return (
            typeof link.id === 'string' &&
            link.id.length >= 1 &&
            link.id.length <= 80 &&
            typeof link.network === 'string' &&
            SOCIAL_NETWORKS.has(link.network) &&
            typeof link.url === 'string' &&
            isHttpUrl(link.url.trim(), 2000) &&
            typeof link.header === 'boolean' &&
            typeof link.footer === 'boolean'
          );
        });
        if (!ok) {
          fail('Social links must use supported networks and valid http(s) URLs.');
          break;
        }
        clean[key] = JSON.stringify(parsed);
        break;
      }
      case 'site.seoTitle':
        if (bounded(1, 160, 'Enter an SEO title (1-160 characters).')) clean[key] = trimmed;
        break;
      case 'site.promoText':
        if (bounded(1, 500, 'Enter promo bar text (1-500 characters).')) clean[key] = trimmed;
        break;
      case 'site.promo2Text':
        if (bounded(1, 500, 'Enter promo bar text (1-500 characters).')) clean[key] = trimmed;
        break;
      case 'maps.mapId':
        if (trimmed.length > 200 || hasControlChars(trimmed)) {
          fail('Map ID is too long.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'maps.lat':
        if (!isDecimalString(trimmed) || Number(trimmed) < -90 || Number(trimmed) > 90) {
          fail('Latitude must be between -90 and 90.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'maps.lng':
        if (!isDecimalString(trimmed) || Number(trimmed) < -180 || Number(trimmed) > 180) {
          fail('Longitude must be between -180 and 180.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'maps.zoom':
        if (!isIntInRange(trimmed, 1, 20)) {
          fail('Zoom must be a whole number between 1 and 20.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'maps.services':
        if (trimmed !== 'maps-places' && trimmed !== 'maps' && trimmed !== 'maps-places-geocoding') {
          fail('Select a valid Maps service bundle.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'maps.enabled':
      case 'whatsapp.enabled':
      case 'auth.google.enabled':
      case 'auth.facebook.enabled':
        if (!isEnabledFlag(trimmed)) {
          fail(`Invalid toggle value for ${key}.`);
          break;
        }
        clean[key] = trimmed;
        break;
      case 'whatsapp.sessionName':
        if (bounded(1, 120, 'Enter a session name (1-120 characters).')) clean[key] = trimmed;
        break;
      case 'whatsapp.inbox':
        if (trimmed !== 'main' && trimmed !== 'sales') {
          fail('Select a valid assigned inbox.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'whatsapp.metaAppId':
      case 'whatsapp.wabaId':
      case 'whatsapp.phoneNumberId':
        if (trimmed !== '' && !/^[0-9]{1,64}$/.test(trimmed)) {
          fail('Meta IDs must be numeric (or left empty until connected).');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'mail.fromName':
        if (bounded(1, 120, 'Enter a sender name (1-120 characters).')) clean[key] = trimmed;
        break;
      case 'mail.smtpHost':
      case 'mail.imapHost':
        if (trimmed.length < 1 || trimmed.length > 255 || !/^[A-Za-z0-9.-]+$/.test(trimmed)) {
          fail('Enter a valid mail host.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'mail.smtpPort':
      case 'mail.imapPort':
        if (!isIntInRange(trimmed, 1, 65535)) {
          fail('Enter a valid mail port (1-65535).');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'mail.smtpEncryption':
        if (trimmed !== 'SSL' && trimmed !== 'TLS' && trimmed !== 'None') {
          fail('Select a valid SMTP encryption mode.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'mail.imapEncryption':
        if (trimmed !== 'SSL' && trimmed !== 'TLS') {
          fail('Select a valid incoming-mail encryption mode.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'mail.smtpUsername':
      case 'mail.imapUsername':
        if (bounded(1, 190, 'Enter a valid mailbox username (1-190 characters).')) clean[key] = trimmed;
        break;
      case 'mail.smtpTimeout':
        if (!isIntInRange(trimmed, 1, 300)) {
          fail('Timeout must be 1-300 seconds.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'mail.imapProtocol':
        if (trimmed !== 'IMAP' && trimmed !== 'POP3') {
          fail('Select a valid incoming-mail protocol.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'mail.mailbox':
        if (bounded(1, 120, 'Enter a mailbox or folder name (1-120 characters).')) clean[key] = trimmed;
        break;
      case 'auth.google.clientId':
        if (trimmed !== '' && (trimmed.length > 500 || /\s/.test(trimmed))) {
          fail('Google Client ID is invalid.');
          break;
        }
        clean[key] = trimmed;
        break;
      case 'auth.facebook.appId':
        if (trimmed !== '' && !/^[0-9]{1,64}$/.test(trimmed)) {
          fail('Facebook App ID must be numeric (or left empty until connected).');
          break;
        }
        clean[key] = trimmed;
        break;
      default:
        fail(`Unknown setting: ${key}.`);
        break;
    }
  }

  return { clean, errors };
}

export interface AdminSettingsSnapshot {
  values: Record<string, string>;
  secrets: Record<string, { configured: boolean }>;
  rates: { eur: string; egp: string };
}

const FALLBACK_RATES = { eur: '0.92', egp: '48' } as const;

async function readRates(): Promise<{ eur: string; egp: string }> {
  const [eur, egp] = await Promise.all([
    getActiveRate('USD', 'EUR'),
    getActiveRate('USD', 'EGP'),
  ]);
  return {
    eur: eur?.rate ?? FALLBACK_RATES.eur,
    egp: egp?.rate ?? FALLBACK_RATES.egp,
  };
}

/**
 * Staff-facing snapshot. Public values are returned verbatim; secrets are
 * returned as configured-flags only — stored values never leave the server.
 */
export async function getAdminSettings(): Promise<AdminSettingsSnapshot> {
  const rows = await db.siteSetting.findMany({
    where: {
      key: {
        in: [...PUBLIC_SETTING_KEYS, ...SECRET_SETTING_KEYS],
      },
    },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const values: Record<string, string> = {};
  for (const key of PUBLIC_SETTING_KEYS) {
    values[key] = byKey.get(key) ?? '';
  }
  const secrets: Record<string, { configured: boolean }> = {};
  for (const key of SECRET_SETTING_KEYS) {
    const stored = byKey.get(key) ?? '';
    secrets[key] = { configured: stored.length > 0 };
  }
  return { values, secrets, rates: await readRates() };
}

export interface SettingsWriteResult {
  snapshot: AdminSettingsSnapshot;
  updatedKeys: string[];
  secretsUpdated: string[];
  ratesUpdated: boolean;
}

/**
 * Applies one validated admin patch. Secrets with an empty value keep the
 * stored value; currency rates are written to FxRate (manual source).
 * Callers must audit the key list themselves — secret values are never
 * included in any return value.
 */
export async function applyAdminSettings(input: {
  values?: unknown;
  rates?: unknown;
}): Promise<SettingsWriteResult> {
  const { clean, errors } = validateSettingsPatch({ values: input.values });
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  let eur: string | null = null;
  let egp: string | null = null;
  if (typeof input.rates === 'object' && input.rates !== null) {
    const rates = input.rates as Record<string, unknown>;
    if (rates.eur !== undefined) {
      const raw = String(rates.eur).trim();
      if (!isDecimalString(raw) || !(Number(raw) > 0) || Number(raw) > 1000000) {
        throw new Error('Enter conversion rates greater than zero.');
      }
      eur = raw;
    }
    if (rates.egp !== undefined) {
      const raw = String(rates.egp).trim();
      if (!isDecimalString(raw) || !(Number(raw) > 0) || Number(raw) > 1000000) {
        throw new Error('Enter conversion rates greater than zero.');
      }
      egp = raw;
    }
  }

  const updatedKeys = Object.keys(clean).filter((key) => !SECRET_KEYS.has(key));
  const secretsUpdated = Object.keys(clean).filter((key) => SECRET_KEYS.has(key));

  await db.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(clean)) {
      await tx.siteSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }
    if (eur !== null) {
      await tx.fxRate.upsert({
        where: { baseCurrency_quoteCurrency: { baseCurrency: 'USD', quoteCurrency: 'EUR' } },
        update: {
          rate: new Prisma.Decimal(eur),
          isActive: true,
          source: 'manual',
          effectiveAt: new Date(),
        },
        create: {
          baseCurrency: 'USD',
          quoteCurrency: 'EUR',
          rate: new Prisma.Decimal(eur),
          source: 'manual',
        },
      });
    }
    if (egp !== null) {
      await tx.fxRate.upsert({
        where: { baseCurrency_quoteCurrency: { baseCurrency: 'USD', quoteCurrency: 'EGP' } },
        update: {
          rate: new Prisma.Decimal(egp),
          isActive: true,
          source: 'manual',
          effectiveAt: new Date(),
        },
        create: {
          baseCurrency: 'USD',
          quoteCurrency: 'EGP',
          rate: new Prisma.Decimal(egp),
          source: 'manual',
        },
      });
    }
  });

  return {
    snapshot: await getAdminSettings(),
    updatedKeys,
    secretsUpdated,
    ratesUpdated: eur !== null || egp !== null,
  };
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.siteSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  return row?.value ?? null;
}

export async function setSetting(
  key: string,
  value: string,
  description?: string,
): Promise<void> {
  await db.siteSetting.upsert({
    where: { key },
    update: { value, description },
    create: { key, value, description },
  });
}

export async function getPublicSettings(): Promise<Record<string, string>> {
  const rows = await db.siteSetting.findMany({
    where: {
      key: {
        in: [
          SETTING_KEYS.siteName,
          SETTING_KEYS.defaultLocale,
          SETTING_KEYS.defaultCurrency,
          SETTING_KEYS.timezone,
        ],
      },
    },
    select: { key: true, value: true },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Safe storefront shape: brand/contact/social/defaults/rates only. Never secrets. */
export interface StorefrontSettings {
  brand: {
    companyName: string;
    logo: string;
    favicon: string;
    aboutEn: string;
    aboutAr: string;
  };
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    mapUrl: string;
    copyrightEn: string;
    copyrightAr: string;
  };
  social: Array<{
    id: string;
    network: string;
    url: string;
    header: boolean;
    footer: boolean;
  }>;
  localization: { defaultLanguage: string; timezone: string };
  currency: { defaultCurrency: string };
  rates: { eur: string; egp: string };
  seo: { title: string };
  promo: { text: string; text2: string };
}

const nonEmpty = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value.trim() : '';

/**
 * Public storefront snapshot. Only non-secret configuration leaves the
 * server — keys, tokens, hosts and credentials are never included.
 * Missing rows yield empty strings; the frontend falls back to its
 * built-in defaults, so an unconfigured shop still renders.
 */
export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  const snapshot = await getAdminSettings();
  const v = snapshot.values;
  let social: StorefrontSettings['social'] = [];
  try {
    const parsed: unknown = JSON.parse(v['social.links'] || '[]');
    if (Array.isArray(parsed)) {
      social = parsed
        .filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === 'object' && entry !== null,
        )
        .map((entry) => ({
          id: String(entry.id ?? ''),
          network: String(entry.network ?? ''),
          url: String(entry.url ?? ''),
          header: entry.header === true,
          footer: entry.footer === true,
        }))
        .filter((entry) => entry.id && entry.network && entry.url);
    }
  } catch {
    social = [];
  }
  return {
    brand: {
      companyName: nonEmpty(v['site.name']),
      logo: nonEmpty(v['site.logo']),
      favicon: nonEmpty(v['site.favicon']),
      aboutEn: nonEmpty(v['site.aboutEn']),
      aboutAr: nonEmpty(v['site.aboutAr']),
    },
    contact: {
      phone: nonEmpty(v['contact.phone']),
      whatsapp: nonEmpty(v['contact.whatsapp']),
      email: nonEmpty(v['contact.email']),
      address: nonEmpty(v['contact.address']),
      mapUrl: nonEmpty(v['contact.mapUrl']),
      copyrightEn: nonEmpty(v['contact.copyrightEn']),
      copyrightAr: nonEmpty(v['contact.copyrightAr']),
    },
    social,
    localization: {
      defaultLanguage: nonEmpty(v['app.defaultLocale']),
      timezone: nonEmpty(v['app.timezone']),
    },
    currency: { defaultCurrency: nonEmpty(v['app.defaultCurrency']) },
    rates: snapshot.rates,
    seo: { title: nonEmpty(v['site.seoTitle']) },
    promo: { text: nonEmpty(v['site.promoText']), text2: nonEmpty(v['site.promo2Text']) },
  };
}
