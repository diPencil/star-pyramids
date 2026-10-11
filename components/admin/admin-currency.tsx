'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatPrice, getCurrencyRates, type Currency } from '@/components/locale'
import { ensureStorefrontSettings } from '@/lib/storefront-settings'
import { useAdminLocale } from './admin-locale'

/**
 * Shared admin currency conversion (display-only).
 *
 * The server always stores USD. This hook mirrors the storefront behavior:
 * it reads the selected `star-currency`, converts with the same DB-backed
 * rates (`getCurrencyRates`, defaults USD 1 / EUR 0.92 / EGP 48) and formats
 * with the same `Intl` rules. Nothing here changes stored values.
 */
export function readStoredAdminCurrency(): Currency {
  if (typeof window === 'undefined') return 'USD'
  const saved = window.localStorage.getItem('star-currency')
  return saved === 'EUR' || saved === 'EGP' ? saved : 'USD'
}

export function useAdminCurrency() {
  const adminLocale = useAdminLocale()
  const [currency, setCurrency] = useState<Currency>('USD')
  // Bumped when DB rates land so converted values refresh without reload.
  const [, setRatesTick] = useState(0)

  useEffect(() => {
    ensureStorefrontSettings()
    const sync = () => {
      setCurrency(readStoredAdminCurrency())
      setRatesTick((v) => v + 1)
    }
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('sp-currency', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('sp-currency', sync)
    }
  }, [])

  const intlLocale = adminLocale === 'ar' ? 'ar' : 'en'
  const formatUsd = useCallback(
    (usd: number) => formatPrice(usd, currency, intlLocale),
    [currency, intlLocale],
  )
  // Compact form for chart axes/legends (same converted value, short label).
  const formatUsdCompact = useCallback(
    (usd: number) => {
      const value = usd * getCurrencyRates()[currency]
      return new Intl.NumberFormat(intlLocale === 'ar' ? 'ar-EG' : 'en-US', {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value)
    },
    [currency, intlLocale],
  )
  return { currency, formatUsd, formatUsdCompact }
}

/** Drop-in converted display for a USD amount stored on the server. */
export function AdminMoney({ usd }: { usd: number }) {
  const { formatUsd } = useAdminCurrency()
  return <>{formatUsd(usd)}</>
}
