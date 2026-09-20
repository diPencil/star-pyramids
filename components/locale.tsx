'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Locale = 'en' | 'ar'
export type Currency = 'USD' | 'EUR' | 'EGP'

const rates: Record<Currency, number> = { USD: 1, EUR: 0.92, EGP: 48 }

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
  useEffect(() => {
    const saved = window.localStorage.getItem('star-locale')
    if (saved === 'ar') setLocaleState('ar')
    const cur = window.localStorage.getItem('star-currency')
    if (cur === 'USD' || cur === 'EUR' || cur === 'EGP') setCurrencyState(cur)
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
  const value = usd * rates[currency]
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'EGP' ? 0 : 2,
  }).format(value)
}
