import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { catalogTours } from '@/data/tours'
import { proxy } from '@/proxy'
import { canMeasureLocation, isSafeTrackingUrl, sanitizeMeasurementUrl } from '@/lib/tracking'
import { publicPageView } from '@/lib/tracking-events'

const origin = 'https://starpyramids.com'
// Deliberate release contract, independent of the runtime allowlist. A new
// route must be reviewed, rather than silently measured or silently omitted.
const publicRoutes = [
  '/', '/about', '/accessible-travel', '/blogs', '/blogs/[slug]', '/cart', '/contact', '/booking-confirmation',
  '/destinations', '/destinations/[slug]', '/egypt-tours/[slug]',
  '/egypt-tours/multi-days-tours', '/egypt-tours/multi-days-tours/[category]',
  '/egypt-tours/nile-cruises', '/egypt-tours/nile-cruises/[type]',
  '/egypt-tours/one-day-tours', '/egypt-tours/one-day-tours/[region]',
  '/egypt-tours/shore-excursions', '/egypt-travel-guide', '/events', '/events/[slug]',
  '/faq', '/make-your-trip', '/privacy', '/rent-car', '/rent-car/request',
  '/special-offers', '/special-offers/[slug]', '/terms', '/trips',
]
const privateRoutes = [
  '/booking/[token]', '/booking-account', '/checkout', '/forgot-password',
  '/login', '/register', '/reset-password', '/search', '/verify-voucher/[token]', '/checkout/receipt',
]
const privateFamily = /^\/(?:admin|account|website-cms-preview)(?:\/|$)/
const samplePath = (path: string) => path.replace(/\[[^\]]+\]/g, 'public-example')
function routesIn(directory: string, segments: string[] = []): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return routesIn(join(directory, entry.name), [...segments, entry.name])
    return entry.name === 'page.tsx' ? ['/' + segments.join('/')] : []
  })
}
const routes = routesIn(join(process.cwd(), 'app'))
const eligibility = 'x-middleware-request-x-sp-tracking-eligible'
afterEach(() => vi.unstubAllEnvs())

describe('sitewide tracking route contract', () => {
  it('requires an explicit privacy decision for every application page', () => {
    expect(routes.filter(route => !publicRoutes.includes(route) && !privateRoutes.includes(route) && !privateFamily.test(route))).toEqual([])
    expect([...publicRoutes, ...privateRoutes].filter(route => !routes.includes(route))).toEqual([])
  })

  it.each(publicRoutes)('admits the reviewed public route on direct and SPA requests: %s', route => {
    vi.stubEnv('NODE_ENV', 'production')
    const path = samplePath(route)
    const url = new URL(path + '?gtm_debug=x&utm_source=google', origin)
    expect(canMeasureLocation(url, 'production')).toBe(true)
    expect(proxy(new NextRequest(url)).headers.get(eligibility)).toBe('1')
    url.searchParams.set('_rsc', 'transport')
    const flight = proxy(new NextRequest(url, { headers: { rsc: '1', referer: origin + '/' } }))
    expect(flight.headers.get(eligibility)).toBe('1')
    expect(flight.headers.get('x-middleware-next')).toBe('1')
    url.searchParams.delete('_rsc')
    expect(publicPageView(url, 'production')).toMatchObject({ page_path: path, page_location: origin + path })
    for (const suffix of ['?token=private', '?email=private%40example.test', '#private-token']) {
      expect(canMeasureLocation(new URL(path + suffix, origin), 'production')).toBe(false)
    }
  })

  it.each(routes.filter(route => privateRoutes.includes(route) || privateFamily.test(route)))(
    'keeps the protected route private even with consent/debug parameters: %s', route => {
      vi.stubEnv('NODE_ENV', 'production')
      const path = samplePath(route)
      const url = new URL(path + '?gtm_debug=x', origin)
      expect(canMeasureLocation(url, 'production')).toBe(false)
      expect(publicPageView(url, 'production')).toBeNull()
      const headers = { cookie: 'sp_session=fixture-only', rsc: '1', referer: origin + '/cart' }
      expect(proxy(new NextRequest(url, { headers })).status).toBe(204)
      expect(proxy(new NextRequest(url, { headers: { cookie: headers.cookie } })).headers.get(eligibility)).toBe('0')
    },
  )

  it('fails closed for unknown routes, nonproduction hosts and development/test', () => {
    for (const path of ['/future-page', '/new-private-area', '/checkout#contact-enquiry']) {
      expect(isSafeTrackingUrl(new URL(path, origin))).toBe(false)
    }
    for (const host of ['https://example.test', 'http://localhost:3000', 'https://starpyramids.com.evil.test']) {
      expect(canMeasureLocation(new URL('/cart', host), 'production')).toBe(false)
    }
    for (const environment of ['development', 'test', undefined]) expect(canMeasureLocation(new URL('/cart', origin), environment)).toBe(false)
  })
})

const publicSections = [
  ['/about', 'our-story'], ['/about', 'travel-styles'], ['/contact', 'contact-enquiry'],
  ['/rent-car', 'fleet'], ['/destinations', 'destinations-catalogue'], ['/blogs', 'blog-stories'],
  ['/special-offers', 'current-offers'], ['/egypt-tours/one-day-tours', 'one-day-regions'],
  ['/egypt-tours/multi-days-tours', 'multi-day-categories'], ['/egypt-tours/nile-cruises', 'cruise-types'],
  ['/egypt-tours/shore-excursions', 'tour-listing'], ['/events/public-event', 'event-book'],
  ['/events/public-event', 'event-program'], ['/destinations/cairo', 'destination-experiences'],
]
describe('public URL producer compatibility', () => {
  it.each(publicSections)('accepts only the reviewed section on %s: #%s', (path, section) => {
    const url = new URL(`${path}?gtm_debug=x#${section}`, origin)
    expect(canMeasureLocation(url, 'production')).toBe(true)
    expect(sanitizeMeasurementUrl(url.href, 'production')).toBe(origin + path)
    expect(publicPageView(url, 'production')?.page_location).toBe(origin + path)
    for (const hash of [`${section}-private-token`, `${section}?token=private`, `%${section}`, 'unknown']) {
      url.hash = hash
      expect(isSafeTrackingUrl(url)).toBe(false)
    }
    url.hash = section
    url.searchParams.set('token', 'private')
    expect(isSafeTrackingUrl(url)).toBe(false)
    expect(isSafeTrackingUrl(new URL(`/checkout#${section}`, origin))).toBe(false)
  })

  it.each([...new Set(catalogTours.map(tour => tour.location))])('admits the reviewed reference-catalogue destination: %s', destination => {
    const url = new URL('/trips', origin)
    url.searchParams.set('destination', destination)
    expect(isSafeTrackingUrl(url)).toBe(true)
    expect(publicPageView(url, 'production')?.page_location).toBe(origin + '/trips')
  })

  it.each([...new Set(catalogTours.map(tour => tour.duration)), 'day', 'short', 'long'])(
    'admits the reference-catalogue duration without copying it into a payload: %s', duration => {
      const url = new URL('/egypt-tours/shore-excursions', origin)
      url.searchParams.set('duration', duration)
      url.searchParams.set('destination', 'Cairo, Giza')
      expect(isSafeTrackingUrl(url)).toBe(true)
      expect(publicPageView(url, 'production')?.page_location).toBe(origin + '/egypt-tours/shore-excursions')
    },
  )

  it.each([
    '/trips?destination=Private%20Name', '/trips?destination=Cairo%2C%20private%40example.test',
    '/trips?destination=Cairo&destination=Giza', '/trips?q=private',
    '/trips?duration=Call%2012025550123', '/trips?duration=8%20Hours%20private',
    '/contact?destination=Cairo', '/cart?duration=8%20Hours', '/search?q=Cairo',
    '/rent-car/request?pickup=private-address',
  ])('keeps unreviewed and private query values excluded: %s', path => {
    expect(isSafeTrackingUrl(new URL(path, origin))).toBe(false)
  })
})
