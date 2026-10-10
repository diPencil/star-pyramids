import { cookies } from 'next/headers';
import { ENABLED_LOCALES, DEFAULT_LOCALE, sanitizeLocale, type EnabledLocale } from '@/lib/locale-config';

/**
 * Server-side locale detection from cookies.
 * Falls back to DEFAULT_LOCALE ('en') if no valid cookie.
 * Used for server-rendered HTML lang attribute and metadata.
 */
export async function getServerLocale(): Promise<EnabledLocale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('star-locale')?.value;
  return sanitizeLocale(localeCookie);
}

/**
 * Get the HTML lang attribute value for the current locale.
 * Maps locale codes to BCP 47 language tags.
 */
export function getHtmlLang(locale: EnabledLocale): string {
  const langMap: Record<EnabledLocale, string> = {
    en: 'en',
    es: 'es',
    it: 'it',
  };
  return langMap[locale] ?? 'en';
}

/**
 * Get the Open Graph locale for the current locale.
 */
export function getOgLocale(locale: EnabledLocale): string {
  const ogMap: Record<EnabledLocale, string> = {
    en: 'en_US',
    es: 'es_ES',
    it: 'it_IT',
  };
  return ogMap[locale] ?? 'en_US';
}