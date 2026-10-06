'use client'

import { createContext, startTransition, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  DEFAULT_LOCALE,
  sanitizeLocale,
  isLocaleRTL,
  pickLocaleText,
  type EnabledLocale,
  type Locale,
} from '@/lib/locale-config'

export type { Locale }
export type Currency = 'USD' | 'EUR' | 'EGP'

/**
 * Canonical localized-text picker (EN/ES/IT public + preserved AR).
 *
 * Replaces binary `ar ? arabic : english` logic: every user-facing
 * string becomes `{ en, es, it, ar }` with a safe English fallback for
 * any missing translation. Catalogue/editorial content without a real
 * ES/IT source intentionally omits `es`/`it` and falls back to English.
 */
export type LText = { en: string; es?: string; it?: string; ar?: string }

export function tx(locale: Locale, v: LText): string {
  return pickLocaleText(locale, v)
}

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
  defaultLanguage: EnabledLocale
  timezone: string
}

const L10N_KEY = 'sp-localization-settings-v1'

export const defaultLocalizationSettings: LocalizationSettings = {
  defaultLanguage: DEFAULT_LOCALE,
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
      defaultLanguage: sanitizeLocale(parsed.defaultLanguage),
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
  const intlLocale = locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US'
  return new Date(iso).toLocaleTimeString(intlLocale, {
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

const LocaleCtx = createContext<LocaleState>({ locale: DEFAULT_LOCALE, setLocale: () => {}, currency: 'USD', setCurrency: () => {} })

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [currency, setCurrencyState] = useState<Currency>('USD')
  const [, setRatesVersion] = useState(0)
  useEffect(() => {
    const applyPersistedPreferences = () => {
      const savedLocale = window.localStorage.getItem('star-locale')
      const initialLocale = savedLocale
        ? sanitizeLocale(savedLocale)
        : sanitizeLocale(readLocalizationSettings().defaultLanguage)
      const savedCurrency = window.localStorage.getItem('star-currency')
      const initialCurrency = savedCurrency === 'USD' || savedCurrency === 'EUR' || savedCurrency === 'EGP'
        ? savedCurrency
        : readCurrencySettings().defaultCurrency
      startTransition(() => {
        setLocaleState(initialLocale)
        setCurrencyState(initialCurrency)
      })
    }
    // Streamed Suspense boundaries may hydrate after the provider commits.
    // An idle task runs only after those urgent hydration tasks have yielded,
    // so persisted text never races the server's initial English snapshot.
    const idleId = window.requestIdleCallback(applyPersistedPreferences)
    const onRates = () => setRatesVersion((v) => v + 1)
    window.addEventListener('sp-currency', onRates)
    return () => {
      window.cancelIdleCallback(idleId)
      window.removeEventListener('sp-currency', onRates)
    }
  }, [])
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = isLocaleRTL(locale) ? 'rtl' : 'ltr'
  }, [locale])
  const setLocale = useCallback((next: Locale) => {
    window.localStorage.setItem('star-locale', next)
    setLocaleState(next)
  }, [])
  const setCurrency = useCallback((next: Currency) => {
    window.localStorage.setItem('star-currency', next)
    setCurrencyState(next)
  }, [])
  return <LocaleCtx.Provider value={{ locale, setLocale, currency, setCurrency }}>{children}</LocaleCtx.Provider>
}

export const useLocale = () => useContext(LocaleCtx)

export function formatPrice(usd: number, currency: Currency, locale: Locale) {
  const value = usd * getCurrencyRates()[currency]
  const intlLocale = locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US'
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'EGP' ? 0 : 2,
  }).format(value)
}
