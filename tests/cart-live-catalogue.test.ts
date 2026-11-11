import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Tour } from '@/data/types'
import type { CartItem } from '@/lib/booking/cart'
import { estimateCart } from '@/lib/booking/booking'

const state = vi.hoisted(() => ({ data: null as Tour[] | null, error: null as string | null, locale: 'en' as 'en' | 'es' | 'it', items: [] as CartItem[], retry: vi.fn(), clear: vi.fn() }))
const measurement = vi.hoisted(() => ({ begin: vi.fn(), navigate: undefined as (() => void) | undefined }))
vi.mock('next/link', () => ({ default: ({ onNavigate, ...props }: { href: string; children?: ReactNode; onNavigate?: () => void }) => {
  if (props.href === '/checkout') measurement.navigate = onNavigate
  return createElement('a', props)
} }))
vi.mock('@/lib/tracking/leads/booking-funnel', async original => ({ ...await original<typeof import('@/lib/tracking/leads/booking-funnel')>(), recordBeginCheckout: measurement.begin }))
vi.mock('@/lib/tours/tours-client', () => ({ useDbToursStatus: () => ({ data: state.data, loading: state.data === null && !state.error, error: state.error, retry: state.retry }) }))
vi.mock('@/lib/booking/cart', () => ({ useCart: () => ({ items: state.items }), clearCart: () => state.clear(), removeFromCart: vi.fn() }))
vi.mock('@/components/site', () => ({ SiteShell: ({ children }: { children: ReactNode }) => children, Breadcrumb: () => null }))
vi.mock('@/components/locale', async () => ({ ...await vi.importActual<typeof import('@/components/locale')>('@/components/locale'), useLocale: () => ({ currency: 'USD', locale: state.locale }) }))
vi.mock('@/components/shared/forms/international-phone-input', () => ({ InternationalPhoneInput: () => null }))
vi.mock('@/components/booking/booking-payment', () => ({ PaymentInstructions: () => null }))
import { CartPage } from '@/components/booking/cart/cart-page'
import { CheckoutPage } from '@/components/booking/checkout/checkout-page'

const liveTour = (category: Tour['category'] = 'one-day-tours'): Tour => ({ slug: 'alexandria-full-day-tour', aliases: ['old-alexandria'], status: 'published', title: 'Alexandria Full Day Tour', category, location: 'Alexandria', duration: 'Full day', price: 125, image: '/live.jpg', summary: 'A current DB-only trip', dayDetail: { overview: ['Visit Alexandria'], priceRows: [], travelerPrices: [{ travelers: 2, adultPrice: 125, childPrice: 70, infantPrice: 0 }], addOns: [{ title: 'Extra', price: 20 }] } })
const line = (slug = 'alexandria-full-day-tour'): CartItem => ({ key: 'original-key', tourSlug: slug, title: 'Alexandria Full Day Tour', image: '/snapshot.jpg', date: '', adults: 2, children: 0, infants: 0, addons: [], addonTotal: 9999, adultUnit: 9999, childUnit: 9999, infantUnit: 9999, total: 9999 })
beforeEach(() => { state.data = null; state.error = null; state.locale = 'en'; state.items = [line()]; vi.clearAllMocks() })
afterEach(() => vi.unstubAllGlobals())

it('measures navigation to checkout using validated canonical tour IDs', () => {
  state.data = [liveTour()]
  state.items = [line('old-alexandria')]
  measurement.navigate = undefined
  renderToStaticMarkup(createElement(CartPage))
  expect(measurement.begin).not.toHaveBeenCalled()
  const browser = {}
  vi.stubGlobal('window', browser)
  measurement.navigate!()
  expect(measurement.begin).toHaveBeenCalledExactlyOnceWith(browser, process.env.NODE_ENV, ['alexandria-full-day-tour'])
})

it.each(['one-day-tours', 'multi-days-tours', 'nile-cruises', 'shore-excursions'] as const)('estimates a newly published %s DB tour without requiring static membership or Date Pricing', category => {
  const tour = liveTour(category), selected = line()
  const result = estimateCart([selected], [tour])
  expect(result.staleLines).toEqual([])
  expect(result.validLines).toHaveLength(1)
  expect(result.subtotal).toBe(250)
  expect(result.validLines[0].adultUnit).toBe(125)
  expect(selected.total).toBe(9999)
  expect(tour.dayDetail!.priceRows).toEqual([])
})
it('uses live traveler rates/add-ons and ignores tampered cart money', () => {
  const selected = { ...line(), children: 1, infants: 1, addons: ['Extra'] }
  const result = estimateCart([selected], [liveTour()])
  expect(result.subtotal).toBe(340)
  expect(result.validLines[0].addonTotal).toBe(20)
})
it('resolves old aliases to canonical slugs while preserving local cart identity', () => {
  const selected = line('old-alexandria')
  const result = estimateCart([selected], [liveTour()])
  expect(result.validLines[0].item.tourSlug).toBe('alexandria-full-day-tour')
  expect(result.validLines[0].item.key).toBe('original-key')
  expect(selected.tourSlug).toBe('old-alexandria')
})
it('never resurrects missing or draft tours from stored snapshots or static data', () => {
  expect(estimateCart([line()], []).staleLines).toHaveLength(1)
  expect(estimateCart([line()], [{ ...liveTour(), status: 'draft' }]).staleLines).toHaveLength(1)
  expect(estimateCart([line('nonexistent')], [liveTour()]).subtotal).toBe(0)
})
it.each([CartPage, CheckoutPage])('shows loading without stale warnings, false zero prices or checkout actions', Component => {
  const html = renderToStaticMarkup(createElement(Component))
  expect(html).toContain('Checking your trips')
  expect(html).not.toContain('no longer available')
  expect(html).not.toContain('$0.00')
  expect(html).not.toContain('href="/checkout"')
  expect(html).not.toContain('Request booking')
  expect(state.clear).not.toHaveBeenCalled()
})
it.each([CartPage, CheckoutPage])('shows retry on a failed catalogue read without deleting saved selections', Component => {
  state.error = 'offline'
  const html = renderToStaticMarkup(createElement(Component))
  expect(html).toContain('Unable to check your trips')
  expect(html).toContain('Retry')
  expect(html).not.toContain('no longer available')
  expect(state.clear).not.toHaveBeenCalled()
  expect(state.items).toHaveLength(1)
})
it.each([CartPage, CheckoutPage])('accepts DB-only published tours after the catalogue resolves', Component => {
  state.data = [liveTour()]
  const html = renderToStaticMarkup(createElement(Component))
  expect(html).toContain('Alexandria Full Day Tour')
  expect(html).toContain('$250.00')
  expect(html).not.toContain('no longer available')
  expect(html).not.toContain('Checking your trips')
})
it.each([CartPage, CheckoutPage])('reports a confirmed missing tour only after a successful catalogue response', Component => {
  state.data = []
  const html = renderToStaticMarkup(createElement(Component))
  expect(html).toContain('no longer available')
  expect(html).not.toContain('Checking your trips')
})
it('blocks a mixed cart with a real unavailable line before checkout', () => {
  state.data = [liveTour()]; state.items = [line(), { ...line('removed'), key: 'removed-key' }]
  const cart = renderToStaticMarkup(createElement(CartPage))
  expect(cart).toContain('$250.00')
  expect(cart).not.toContain('href="/checkout"')
  const checkout = renderToStaticMarkup(createElement(CheckoutPage))
  expect(checkout).toMatch(/type="submit"[^>]*disabled=""/)
})
it.each([
  ['en', 'Unable to check your trips'], ['es', 'No se pudieron comprobar tus viajes'], ['it', 'Impossibile verificare i tuoi viaggi'],
] as const)('localizes catalogue failures in %s', (locale, message) => {
  state.locale = locale; state.error = 'offline'
  expect(renderToStaticMarkup(createElement(CartPage))).toContain(message)
})
