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
import { ensureStorefrontSettings, getDbCurrency, getDbLocalization } from '@/lib/storefront-settings'

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

export const defaultCurrencySettings: CurrencySettings = {
  eur: defaultRates.EUR,
  egp: defaultRates.EGP,
  defaultCurrency: 'USD',
  updatedAt: '',
}

export function readCurrencySettings(): CurrencySettings {
  // Database is the source of truth (fetched once per page load);
  // built-in defaults render until it arrives. No localStorage mirror.
  const db = getDbCurrency()
  return {
    eur: db?.eur && db.eur > 0 ? db.eur : defaultRates.EUR,
    egp: db?.egp && db.egp > 0 ? db.egp : defaultRates.EGP,
    defaultCurrency: db?.defaultCurrency ?? 'USD',
    updatedAt: '',
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
  // Database is the source of truth; built-in defaults render until it
  // arrives. Visitor-chosen values stay in star-locale (untouched here).
  const db = getDbLocalization()
  return {
    defaultLanguage: db?.defaultLanguage
      ? sanitizeLocale(db.defaultLanguage)
      : defaultLocalizationSettings.defaultLanguage,
    timezone: db?.timezone ?? defaultLocalizationSettings.timezone,
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

export function LocaleProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE)
  const [currency, setCurrencyState] = useState<Currency>('USD')
  const [, setRatesVersion] = useState(0)
  useEffect(() => {
    ensureStorefrontSettings()
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
    // The DB snapshot often lands AFTER first paint. New visitors (no saved
    // preference) must adopt the late-arriving admin defaults; visitors with
    // an explicit choice keep it.
    const onRates = () => {
      setRatesVersion((v) => v + 1)
      if (!window.localStorage.getItem('star-locale')) {
        const next = sanitizeLocale(readLocalizationSettings().defaultLanguage)
        setLocaleState((prev) => (prev === next ? prev : next))
      }
      if (!window.localStorage.getItem('star-currency')) {
        const next = readCurrencySettings().defaultCurrency
        setCurrencyState((prev) => (prev === next ? prev : next))
      }
    }
    window.addEventListener('sp-currency', onRates)
    window.addEventListener('sp-l10n', onRates)
    return () => {
      window.cancelIdleCallback(idleId)
      window.removeEventListener('sp-currency', onRates)
      window.removeEventListener('sp-l10n', onRates)
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
