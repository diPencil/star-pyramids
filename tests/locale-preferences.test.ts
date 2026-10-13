import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { countries, countryByCode } from '@/data/countries'
import { countryLabel } from '@/lib/country-label'
import { authPageMetadata } from '@/lib/auth-page-metadata'
import { localePreferenceCookie, readLocalePreferenceCookie, type Locale } from '@/lib/locale-config'
import { InitialLocaleProvider, LocaleProvider, useLocale } from '@/components/locale'

describe('localized region labels', () => {
  it('translates country names without changing canonical identities or calling codes', () => {
    const before = JSON.stringify(countries)
    expect(countryLabel(countryByCode('EG'), 'es')).toBe('Egipto')
    expect(countryLabel(countryByCode('EG'), 'it')).toBe('Egitto')
    expect(countryLabel(countryByCode('DE'), 'es')).toBe('Alemania')
    expect(countryLabel(countryByCode('DE'), 'it')).toBe('Germania')
    for (const country of countries) {
      expect(countryLabel(country, 'en')).toBe(country.name)
      expect(countryLabel(country, 'ar')).toBe(country.nameAr)
      for (const locale of ['es', 'it'] as const) {
        expect(countryLabel(country, locale).trim()).not.toBe('')
        expect(countryLabel(country, locale)).not.toBe(country.code)
      }
    }
    expect(JSON.stringify(countries)).toBe(before)
  })
})

describe('server/client locale preference', () => {
  it.each(['en', 'es', 'it'] as const)('round trips %s through a host-only preference cookie', (locale) => {
    const cookie = localePreferenceCookie(locale, true)
    expect(readLocalePreferenceCookie(cookie)).toBe(locale)
    expect(cookie).toContain('Path=/; Max-Age=31536000; SameSite=Lax; Secure')
    expect(cookie).not.toContain('Domain=')
    expect(cookie).not.toContain('HttpOnly')
  })

  it('rejects unsupported or misleading cookie names without enabling Arabic', () => {
    for (const cookie of ['', 'star-locale=ar', 'star-locale=unknown', 'other-star-locale=it', 'star-locale=es%3B']) {
      expect(readLocalePreferenceCookie(cookie)).toBeNull()
    }
    expect(readLocalePreferenceCookie('unrelated=1; star-locale=it; another=2')).toBe('it')
    expect(localePreferenceCookie('ar', false)).toContain('star-locale=en;')
    expect(localePreferenceCookie('it', false)).not.toContain('Secure')
  })

  it.each(['en', 'es', 'it'] as const)('hydrates an existing nested provider directly in %s', (locale) => {
    function Probe() { return createElement('span', null, useLocale().locale) }
    const markup = renderToStaticMarkup(createElement(InitialLocaleProvider, {
      locale,
      children: createElement(LocaleProvider, { children: createElement(Probe) }),
    }))
    expect(markup).toBe(`<span>${locale}</span>`)
  })

  it('preserves an explicit initial locale override', () => {
    function Probe() { return createElement('span', null, useLocale().locale) }
    expect(renderToStaticMarkup(createElement(InitialLocaleProvider, {
      locale: 'es',
      children: createElement(LocaleProvider, { initialLocale: 'it', children: createElement(Probe) }),
    }))).toBe('<span>it</span>')
  })
})

describe('auth page metadata', () => {
  it.each(['login', 'register', 'forgotPassword', 'resetPassword'] as const)('localizes %s while preserving private robots', (page) => {
    const english = authPageMetadata(page, 'en')
    for (const locale of ['es', 'it'] as Locale[]) {
      const metadata = authPageMetadata(page, locale)
      expect(metadata.title).not.toBe(english.title)
      expect(metadata.description).not.toBe(english.description)
      expect(metadata.robots).toEqual({ index: false, follow: false, nocache: true })
    }
  })
})
