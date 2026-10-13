import type { CountryOption } from '@/data/countries'
import type { Locale } from './locale-config'

const displayNames = new Map<Locale, Intl.DisplayNames>()

/** Display-only translation; stored ISO identities and calling codes never change. */
export function countryLabel(country: CountryOption, locale: Locale): string {
  if (locale === 'ar') return country.nameAr
  if (locale === 'en') return country.name
  let names = displayNames.get(locale)
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' })
    displayNames.set(locale, names)
  }
  return names.of(country.code) ?? country.name
}
