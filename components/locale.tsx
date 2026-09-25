'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Locale = 'en' | 'ar'
export type Currency = 'USD' | 'EUR' | 'EGP'

const defaultRates: Record<Currency, number> = { USD: 1, EUR: 0.92, EGP: 48 }

export type CurrencySettings = {
  eur: number
  egp: number
  defaultCurrency: Currency
  updatedAt: string
}

const CURRENCY_KEY = 'sp-currency-settings-v1'

export const defaultCurrencySettings: CurrencySettings = {
  eur: defaultRates.EUR,
  egp: defaultRates.EGP,
  defaultCurrency: 'USD',
  updatedAt: '',
}

export function readCurrencySettings(): CurrencySettings {
  if (typeof window === 'undefined') return defaultCurrencySettings
  try {
    const raw = window.localStorage.getItem(CURRENCY_KEY)
    if (!raw) return defaultCurrencySettings
    const parsed = JSON.parse(raw) as Partial<CurrencySettings>
    return {
      eur: typeof parsed.eur === 'number' && parsed.eur > 0 ? parsed.eur : defaultRates.EUR,
      egp: typeof parsed.egp === 'number' && parsed.egp > 0 ? parsed.egp : defaultRates.EGP,
      defaultCurrency: parsed.defaultCurrency === 'EUR' || parsed.defaultCurrency === 'EGP' ? parsed.defaultCurrency : 'USD',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    }
  } catch {
    return defaultCurrencySettings
  }
}

export function saveCurrencySettings(patch: Partial<CurrencySettings>) {
  try {
    const next = { ...readCurrencySettings(), ...patch, updatedAt: new Date().toISOString() }
    window.localStorage.setItem(CURRENCY_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('sp-currency'))
  } catch {
    // Rates kept in memory only for this session.
  }
}

export function getCurrencyRates(): Record<Currency, number> {
  const settings = readCurrencySettings()
  return { USD: 1, EUR: settings.eur, EGP: settings.egp }
}

export type LocalizationSettings = {
  defaultLanguage: Locale
  timezone: string
}

const L10N_KEY = 'sp-localization-settings-v1'

export const defaultLocalizationSettings: LocalizationSettings = {
  defaultLanguage: 'en',
  timezone: 'Africa/Cairo',
}

function isValidTimezone(tz: string): boolean {
  if (!tz) return false
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone')
    if (supported) return supported.includes(tz)
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function readLocalizationSettings(): LocalizationSettings {
  if (typeof window === 'undefined') return defaultLocalizationSettings
  try {
    const raw = window.localStorage.getItem(L10N_KEY)
    if (!raw) return defaultLocalizationSettings
    const parsed = JSON.parse(raw) as Partial<LocalizationSettings>
    return {
      defaultLanguage: parsed.defaultLanguage === 'ar' ? 'ar' : 'en',
      timezone: typeof parsed.timezone === 'string' && isValidTimezone(parsed.timezone) ? parsed.timezone : defaultLocalizationSettings.timezone,
    }
  } catch {
    return defaultLocalizationSettings
  }
}

export function saveLocalizationSettings(patch: Partial<LocalizationSettings>) {
  try {
    window.localStorage.setItem(L10N_KEY, JSON.stringify({ ...readLocalizationSettings(), ...patch }))
    window.dispatchEvent(new Event('sp-l10n'))
  } catch {
    // Localization kept in memory only for this session.
  }
}

export function getSiteTimezone(): string {
  return readLocalizationSettings().timezone
}

export function formatSiteTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: getSiteTimezone(),
  })
}

type LocaleState = {
  locale: Locale
  setLocale: (l: Locale) => void
  currency: Currency
  setCurrency: (c: Currency) => void
}

const LocaleCtx = createContext<LocaleState>({ locale: 'en', setLocale: () => {}, currency: 'USD', setCurrency: () => {} })

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [currency, setCurrencyState] = useState<Currency>('USD')
  const [, setRatesVersion] = useState(0)
  useEffect(() => {
    const saved = window.localStorage.getItem('star-locale')
    if (saved === 'ar' || saved === 'en') setLocaleState(saved)
    else setLocaleState(readLocalizationSettings().defaultLanguage)
    const cur = window.localStorage.getItem('star-currency')
    if (cur === 'USD' || cur === 'EUR' || cur === 'EGP') setCurrencyState(cur)
    else setCurrencyState(readCurrencySettings().defaultCurrency)
    const onRates = () => setRatesVersion((v) => v + 1)
    window.addEventListener('sp-currency', onRates)
    return () => window.removeEventListener('sp-currency', onRates)
  }, [])
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    window.localStorage.setItem('star-locale', locale)
  }, [locale])
  useEffect(() => {
    window.localStorage.setItem('star-currency', currency)
  }, [currency])
  return <LocaleCtx.Provider value={{ locale, setLocale: setLocaleState, currency, setCurrency: setCurrencyState }}>{children}</LocaleCtx.Provider>
}

export const useLocale = () => useContext(LocaleCtx)

export function formatPrice(usd: number, currency: Currency, locale: Locale) {
  const value = usd * getCurrencyRates()[currency]
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'EGP' ? 0 : 2,
  }).format(value)
}
