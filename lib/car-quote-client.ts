'use client'
import { isCurrency } from './currency'

import { useEffect, useState } from 'react'
import type { CarRequest } from './car-request'
import { MAX_MONEY_CENTS, readCarPricingMetadata } from './car-pricing'

export type QuoteSelection = { vehicle: string; from: string; to: string; trip: 'one-way' | 'round-trip'; passengers: number }
export type CarQuoteState = { kind: 'quote'; quote: NonNullable<CarRequest['quote']> } | { kind: 'por' | 'unavailable' | 'error' | 'loading' | 'idle' }
export const quoteSelectionKey = (selection: QuoteSelection | null) => selection ? new URLSearchParams({ ...selection, passengers: String(selection.passengers) }).toString() : ''
export function currentCarQuoteState(key: string, retry: number, result: { key: string; retry: number; state: CarQuoteState }): CarQuoteState {
  if (!key) return { kind: 'idle' }
  return result.key !== key || result.retry !== retry ? { kind: 'loading' } : result.state
}

export function startCarQuote(selection: QuoteSelection, publish: (state: CarQuoteState) => void, request: typeof fetch = fetch, delay = 400) {
  const controller = new AbortController()
  let cancelled = false
  const timer = setTimeout(async () => {
    try {
      const response = await request(`/api/rent-car/quote?${quoteSelectionKey(selection)}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      const data = await response.json()
      if (cancelled) return
      if (!response.ok) { publish({ kind: response.status >= 500 ? 'error' : 'unavailable' }); return }
      if (data.priceOnRequest === true) { publish({ kind: 'por' }); return }
      const quote = data.quote
      const cents = selection.trip === 'round-trip' ? quote?.roundTripCents : quote?.oneWayCents
      if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_MONEY_CENTS || !isCurrency(quote?.currency)) throw new Error('Invalid quote response')
      const metadata = readCarPricingMetadata(quote.pricingMetadata)
      if (quote.pricingMetadata && (!metadata || metadata.passengers !== selection.passengers || metadata.outbound.currency !== quote.currency)) throw new Error('Invalid quote metadata')
      publish({ kind: 'quote', quote: { currency: quote.currency, cents, basis: quote.roundTripBasis, quotedAt: '', pricingMetadata: metadata?.outbound.currency === quote.currency ? metadata : undefined } })
    } catch { if (!cancelled) publish({ kind: 'error' }) }
  }, delay)
  return () => { cancelled = true; clearTimeout(timer); controller.abort() }
}

export function useCarQuote(selection: QuoteSelection | null) {
  const key = quoteSelectionKey(selection)
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ key: string; retry: number; state: CarQuoteState }>({ key: '', retry: 0, state: { kind: 'idle' } })
  useEffect(() => {
    if (!selection) return
    setResult({ key, retry, state: { kind: 'loading' } })
    return startCarQuote(selection, state => setResult({ key, retry, state }))
  }, [key, retry])
  // Key gating hides stale amounts during render, before effect cleanup/debounce.
  const state = currentCarQuoteState(key, retry, result)
  return { state, retry: () => setRetry(value => value + 1) }
}
