import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CarQuoteSummary } from '@/components/car-quote-summary'
import { readCarPricingMetadata, type CarPricingMetadata } from '@/lib/car-pricing'
import { formatQuoteAmount } from '@/lib/car-request'
import { CarInputError } from '@/lib/rent-car-errors'
import { rentCarFailure } from '@/lib/server/rent-car-errors'

const metadata: CarPricingMetadata = { version: 1, passengers: 3, outbound: { tierId: 'tier', minPassengers: 3, maxPassengers: 6, unitCents: 1025, pricingMode: 'PER_PERSON', currency: 'USD' }, returnPricing: null }
const quote = { cents: 3075, currency: 'USD', quotedAt: '', basis: 'multiplier' as const, pricingMetadata: metadata }
describe('customer/account/admin saved quote presentation', () => {
  it.each(['en', 'es', 'it'] as const)('shows per-person unit, passengers and final total in %s', locale => {
    const html = renderToStaticMarkup(createElement(CarQuoteSummary, { quote, locale, tripType: 'One Way', saved: true }))
    expect(html).toContain(formatQuoteAmount(1025, 'USD', locale))
    expect(html).toContain(formatQuoteAmount(3075, 'USD', locale))
    expect(html).toContain('× 3')
    expect(html).toContain('3–6')
  })
  it('distinguishes fixed totals and never multiplies their unit by passengers', () => {
    const fixed = { ...quote, cents: 1025, pricingMetadata: { ...metadata, outbound: { ...metadata.outbound, pricingMode: 'FIXED_TOTAL' as const } } }
    const html = renderToStaticMarkup(createElement(CarQuoteSummary, { quote: fixed, locale: 'en', tripType: 'One Way' }))
    expect(html).toContain('Vehicle transfer total')
    expect(html).toContain('Total transfer price')
    expect(html).not.toContain('× 3')
  })
  it('shows independent mixed-mode return pricing without changing the saved total', () => {
    const mixed = { ...quote, cents: 5575, pricingMetadata: { ...metadata, returnPricing: { basis: 'legs' as const, tierId: 'reverse', pricingMode: 'FIXED_TOTAL' as const, unitCents: 2500, currency: 'USD' } } }
    const html = renderToStaticMarkup(createElement(CarQuoteSummary, { quote: mixed, locale: 'en', tripType: 'Round Trip', saved: true }))
    expect(html).toContain('Return rate (vehicle total): $25.00')
    expect(html).toContain('$55.75')
  })
  it('uses the full manual round-trip unit in per-person explanations', () => {
    const manual = { ...quote, cents: 5475, pricingMetadata: { ...metadata, returnPricing: { basis: 'manual' as const, tierId: 'tier', pricingMode: 'PER_PERSON' as const, unitCents: 1825, currency: 'USD' } } }
    const html = renderToStaticMarkup(createElement(CarQuoteSummary, { quote: manual, locale: 'en', tripType: 'Round Trip' }))
    expect(html).toContain('Round-trip rate: $18.25 × 3')
    expect(html).toContain('$54.75')
  })
  it('preserves legacy total without inventing metadata or using a different round-trip amount', () => {
    const html = renderToStaticMarkup(createElement(CarQuoteSummary, { quote: { ...quote, cents: 2500, roundTripCents: 5000, pricingMetadata: undefined }, locale: 'en', tripType: 'One Way', saved: true }))
    expect(html).toContain('$25.00')
    expect(html).not.toContain('$50.00')
    expect(html).not.toContain('Per-passenger')
  })
  it('keeps EGP cents, Price on Request and malformed legacy metadata safe', () => {
    expect(formatQuoteAmount(1025, 'EGP', 'en')).toContain('10.25')
    expect(renderToStaticMarkup(createElement(CarQuoteSummary, { quote: null, locale: 'it' }))).toContain('Prezzo su richiesta')
    for (const value of [null, '{bad', '{}', { ...metadata, passengers: 100 }, { ...metadata, outbound: {} }]) expect(readCarPricingMetadata(value)).toBeUndefined()
    expect(readCarPricingMetadata(JSON.stringify(metadata))).toEqual(metadata)
  })
  it('exposes validation messages but not database paths, SQL or unexpected internals', () => {
    expect(rentCarFailure(new CarInputError('Invalid passenger range.'))).toEqual({ status: 400, error: 'Invalid passenger range.' })
    const failure = rentCarFailure(new Error('Prisma SQL error at C:\\secret\\.env'))
    expect(failure.status).toBe(503)
    expect(failure.error).not.toContain('Prisma')
    expect(failure.error).not.toContain('secret')
  })
})
