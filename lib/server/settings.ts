// Authoritative site-settings service. Server owns company identity,
// locale/currency/timezone defaults and brand/social configuration.
// Browser-local prototype settings MUST NOT override these after
// frontend integration. Values are opaque strings; callers parse them.
import 'server-only';

import { db } from './db';

export const SETTING_KEYS = {
  siteName: 'site.name',
  defaultLocale: 'app.defaultLocale',
  defaultCurrency: 'app.defaultCurrency',
  timezone: 'app.timezone',
} as const;

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
