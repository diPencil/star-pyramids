import { beforeEach, describe, expect, it, vi } from 'vitest'
const settings = vi.hoisted(() => ({ value: null as null | { eur?: number; egp?: number; defaultCurrency?: 'USD' | 'EUR' | 'EGP' } }))
vi.mock('@/lib/storefront-settings', () => ({ getDbCurrency: () => settings.value, getDbLocalization: () => null, ensureStorefrontSettings: vi.fn() }))
import { SUPPORTED_CURRENCIES, CURRENCY_OPTIONS, isCurrency, normalizeCurrency, formatCurrency, currencyChoices, TOUR_BOOKING_CURRENCY } from '@/lib/currency'
import { SUPPORTED_CURRENCIES as carCurrencies, normalizeCurrency as normalizeCarCurrency, passengerAmount } from '@/lib/car-pricing'
import { formatQuoteAmount } from '@/lib/car-request'
import { formatPrice, readCurrencySettings } from '@/components/locale'

beforeEach(() => { settings.value = null })
describe('single currency contract', () => {
  it('shares selectors and pricing codes without duplicating the source', () => {
    expect(SUPPORTED_CURRENCIES).toEqual(['USD', 'EUR', 'EGP'])
    expect(carCurrencies).toBe(SUPPORTED_CURRENCIES)
    expect(normalizeCarCurrency).toBe(normalizeCurrency)
    expect(CURRENCY_OPTIONS.map(option => option.value)).toEqual(SUPPORTED_CURRENCIES)
    expect(TOUR_BOOKING_CURRENCY).toBe('USD')
  })
  it.each(['USD', 'EUR', 'EGP'])('normalizes %s while canonical validation remains strict', code => {
    expect(isCurrency(code)).toBe(true)
    expect(isCurrency(code.toLowerCase())).toBe(false)
    expect(normalizeCurrency(` ${code.toLowerCase()} `)).toBe(code)
  })
  it.each([null, undefined, 123, {}, ['USD'], 'GBP', 'USDX', '', 'US D', 'USD\u0000'])('rejects invalid input %j', value => {
    expect(isCurrency(value)).toBe(false)
    expect(normalizeCurrency(value)).toBeNull()
  })
  it.each(['en', 'es', 'it'])('formats native amounts with exact cents in %s without conversion', locale => {
    const intl = locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US'
    for (const currency of SUPPORTED_CURRENCIES) {
      const expected = new Intl.NumberFormat(intl, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(123.45)
      expect(formatCurrency(123.45, currency, locale)).toBe(expected)
      expect(formatQuoteAmount(12345, currency, locale as 'en' | 'es' | 'it')).toBe(expected)
    }
    expect(currencyChoices(locale).map(choice => choice[2])).toEqual(SUPPORTED_CURRENCIES)
  })
  it('preserves unknown/null historical denominations rather than substituting USD', () => {
    expect(formatCurrency(125.5, null)).toBe('125.50')
    expect(formatCurrency(125.5, 'GBP')).toBe('125.50 GBP')
  })
  it('keeps dual pricing integer cents unchanged', () => {
    expect(passengerAmount(12345, 3, 'FIXED_TOTAL')).toBe(12345)
    expect(passengerAmount(12345, 3, 'PER_PERSON')).toBe(37035)
  })
})
describe('USD display conversion boundary', () => {
  it('does not invent missing exchange rates or relabel USD as foreign currency', () => {
    expect(readCurrencySettings()).toMatchObject({ eur: 0, egp: 0 })
    expect(formatPrice(100, 'EUR', 'en')).toBe('$100.00')
    expect(formatPrice(100, 'EGP', 'en')).toBe('$100.00')
  })
  it('converts only with configured rates and never converts native quote amounts', () => {
    settings.value = { eur: 0.75, egp: 50 }
    expect(formatPrice(100, 'EUR', 'en')).toBe('€75.00')
    expect(formatPrice(100, 'EGP', 'en')).toContain('5,000')
    expect(formatQuoteAmount(10000, 'EUR', 'en')).toBe('€100.00')
    expect(formatCurrency(100, 'USD', 'en')).toBe('$100.00')
  })
  it.each([NaN, Infinity, -1, 0])('ignores invalid configured rates %s', rate => {
    settings.value = { eur: rate, egp: rate }
    expect(formatPrice(100, 'EUR', 'en')).toBe('$100.00')
  })
})
