import type { Locale } from './locale-config'

/** Optional manual translations stored alongside the canonical English fields. */
export type TourTranslations = Partial<Record<Locale, Record<string, string>>>
export type Translatable = { translations?: TourTranslations }

export function readTourText<T extends Translatable>(row: T, key: keyof T & string, locale: Locale): string {
  if (locale !== 'en') return row.translations?.[locale]?.[key] ?? ''
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

export function writeTourText<T extends Translatable>(row: T, key: keyof T & string, value: string, locale: Locale): T {
  if (locale === 'en') return { ...row, [key]: value }
  const current = { ...row.translations?.[locale] }
  // Reverting an empty translation must also restore the clean snapshot.
  if (value === '') delete current[key]
  else current[key] = value
  const translations = { ...row.translations }
  if (Object.keys(current).length) translations[locale] = current
  else delete translations[locale]
  const next = { ...row }
  if (Object.keys(translations).length) next.translations = translations
  else delete next.translations
  return next
}
