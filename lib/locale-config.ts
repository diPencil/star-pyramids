export const DEFAULT_LOCALE = 'en' as const;

export const ENABLED_LOCALES = ['en', 'es', 'it'] as const;

export const DISABLED_LOCALES = ['ar'] as const;

export const ALL_LOCALES = ['en', 'es', 'it', 'ar'] as const;

export type EnabledLocale = (typeof ENABLED_LOCALES)[number];
export type DisabledLocale = (typeof DISABLED_LOCALES)[number];
export type Locale = EnabledLocale | DisabledLocale;

export const RTL_LOCALES: readonly Locale[] = ['ar'];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  it: 'Italiano',
  ar: 'العربية',
};

export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: 'EN',
  es: 'ES',
  it: 'IT',
  ar: 'AR',
};

export const LOCALE_REGIONS: Record<Locale, string> = {
  en: 'United States',
  es: 'Spain',
  it: 'Italy',
  ar: 'Egypt',
};

export function isLocaleEnabled(locale: string): locale is EnabledLocale {
  return (ENABLED_LOCALES as readonly string[]).includes(locale);
}

export function isLocaleRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export function sanitizeLocale(value: string | null | undefined): EnabledLocale {
  if (value && isLocaleEnabled(value)) {
    return value;
  }
  return DEFAULT_LOCALE;
}

/**
 * Neutral localized-text picker (no React, safe for server + client).
 * Missing translations fall back to English — catalogue/editorial
 * content without a real ES/IT source intentionally omits them.
 */
export type LocaleText = { en: string; es?: string; it?: string; ar?: string };

export function pickLocaleText(locale: Locale, v: LocaleText): string {
  if (locale === 'es' && v.es !== undefined) return v.es;
  if (locale === 'it' && v.it !== undefined) return v.it;
  if (locale === 'ar' && v.ar !== undefined) return v.ar;
  return v.en;
}

/** Normalize the legacy `ar: boolean` label argument to a Locale. */
export function localeFromAr(ar: boolean | Locale): Locale {
  return ar === true || ar === 'ar' ? 'ar' : ar === 'es' ? 'es' : ar === 'it' ? 'it' : 'en';
}
