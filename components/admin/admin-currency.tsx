'use client'
import { isCurrency, formatCurrency } from '@/lib/currency'

import { useCallback, useEffect, useState } from 'react'
import { formatPrice, getCurrencyRates, type Currency } from '@/components/locale'
import { ensureStorefrontSettings } from '@/lib/storefront-settings'
import { sanitizeLocale, type EnabledLocale } from '@/lib/locale-config'

/**
 * Shared admin currency conversion (display-only).
 *
 * Tour booking accounting stores USD; other modules may own native currencies. This hook mirrors the storefront behavior:
 * it reads the selected `star-currency`, converts with the same DB-backed
 * configured rates (`getCurrencyRates`, missing foreign rates retain USD) and formats
 * with the same `Intl` rules. Nothing here changes stored values.
 */
export function readStoredAdminCurrency(): Currency {
  if (typeof window === 'undefined') return 'USD'
  try {
    const saved = window.localStorage.getItem('star-currency')
    return isCurrency(saved) ? saved : 'USD'
  } catch { return 'USD' }
}

export function readStoredAdminCurrencyLocale(): EnabledLocale {
  if (typeof window === 'undefined') return 'en'
  try { return sanitizeLocale(window.localStorage.getItem('star-locale')) } catch { return 'en' }
}

export function useAdminCurrency() {
  const [adminLocale, setAdminLocale] = useState<EnabledLocale>('en')
  const [currency, setCurrency] = useState<Currency>('USD')
  // Bumped when DB rates land so converted values refresh without reload.
  const [, setRatesTick] = useState(0)

  useEffect(() => {
    ensureStorefrontSettings()
    const sync = () => {
      setCurrency(readStoredAdminCurrency())
      setAdminLocale(readStoredAdminCurrencyLocale())
      setRatesTick((v) => v + 1)
    }
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('sp-currency', sync)
    window.addEventListener('sp-admin-locale', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('sp-currency', sync)
      window.removeEventListener('sp-admin-locale', sync)
    }
  }, [])

  const intlLocale = adminLocale === 'es' || adminLocale === 'it' ? adminLocale : 'en'
  const formatUsd = useCallback(
    (usd: number) => formatPrice(usd, currency, intlLocale),
    [currency, intlLocale],
  )
  // Compact form for chart axes/legends (same converted value, short label).
  const formatUsdCompact = useCallback(
    (usd: number) => {
      const rate = getCurrencyRates()[currency]
      const available = Number.isFinite(rate) && rate > 0
      return formatCurrency(available ? usd * rate : usd, available ? currency : 'USD', intlLocale, { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 })
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
