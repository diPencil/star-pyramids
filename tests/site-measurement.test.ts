import { randomUUID } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { SiteMeasurement } from '@/components/site-measurement'
import { installEnquiryHistoryTracking } from '@/lib/enquiry-navigation'
import { TRACKING_CONSENT_STORAGE_KEY } from '@/lib/tracking'
import { GTM_CONSENT_READY_EVENT, readTrackingGrants } from '@/lib/tracking-browser'
import { FUNNEL_STORAGE_PREFIX } from '@/lib/booking-funnel'
import { submitTripRequest } from '@/lib/trip-request-submission'
import type { MakeYourTripRequestDraft } from '@/lib/trip-request'

const effects = vi.hoisted(() => [] as Array<() => void | (() => void)>)
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
  useCallback: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
  useState: (value: unknown) => [value, () => {}],
}))

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  effects.length = 0
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function mount(path: string, modern: boolean, granted = true) {
  const origin = 'https://starpyramids.com'
  const location = { href: origin + path }
  const navigation = modern ? new EventTarget() : undefined
  const values = new Map(granted ? [[TRACKING_CONSENT_STORAGE_KEY, '{"analytics":true,"marketing":false}']] : [])
  const script: { onload?: () => void; onerror?: () => void } = {}
  const appendChild = vi.fn()
  const history = {
    state: null as unknown,
    replaceState(state: unknown, _unused: string, url: string) {
      history.state = state
      location.href = new URL(url, location.href).href
    },
    pushState(state: unknown, _unused: string, url: string) {
      history.state = state
      location.href = new URL(url, location.href).href
    },
  }
  const browser = Object.assign(new EventTarget(), {
    location, navigation, history, crypto: { randomUUID },
    dataLayer: [] as unknown[],
    document: { createElement: () => script, head: { appendChild } },
    localStorage: {
      get length() { return values.size },
      key: (i: number) => [...values.keys()][i] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    },
  })
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubGlobal('window', browser)
  installEnquiryHistoryTracking(browser as unknown as Window)
  SiteMeasurement({ containerId: 'GTM-TEST', explicitPageViews: false })
  for (const effect of effects.splice(0)) {
    const cleanup = effect()
    if (cleanup) cleanups.push(cleanup)
  }
  return { browser, origin, location, navigation, script, appendChild }
}

it('mounts one Advanced container before a first-visit choice and leaves optional consent denied', () => {
  const { browser, script, appendChild } = mount('/trips', false, false)
  expect(appendChild).toHaveBeenCalledOnce()
  script.onload?.()
  expect(browser.dataLayer).not.toContainEqual({ event: GTM_CONSENT_READY_EVENT })
  browser.dispatchEvent(new Event('hashchange'))
  expect(appendChild).toHaveBeenCalledOnce()
})

it('drains the existing saved booking once when the clean confirmation container becomes ready', () => {
  const { browser, script, appendChild } = mount('/booking-confirmation?flow=' + 'a'.repeat(32), false)
  const event = { event: 'sp_booking_created', event_id: 'bk_' + 'b'.repeat(32), currency: 'USD', value: 100, items: [{ item_id: 'cairo-tour', quantity: 1, price: 100 }] }
  browser.localStorage.setItem(FUNNEL_STORAGE_PREFIX + event.event_id, JSON.stringify({ event, capturedAt: Date.now(), grants: readTrackingGrants(browser as unknown as Window) }))
  script.onload?.()
  browser.dispatchEvent(new Event('online'))
  browser.dispatchEvent(new Event('hashchange'))
  expect(browser.dataLayer.filter(entry => (entry as { event?: string }).event === 'sp_booking_created')).toEqual([{ ...event, ads_eligible: false }])
  expect(appendChild).toHaveBeenCalledOnce()
  expect(JSON.stringify(browser.dataLayer)).not.toContain('flow=')
})

it.each(['/contact#contact-enquiry', '/events/cairo-event#event-book', '/egypt-tours/shore-excursions#tour-listing'])(
  'loads once on a reviewed public anchor without granting optional consent: %s', path => {
    const { browser, script, appendChild } = mount(path, false, false)
    script.onload?.()
    browser.dispatchEvent(new Event('hashchange'))
    expect(appendChild).toHaveBeenCalledOnce()
    expect(browser.dataLayer).not.toContainEqual({ event: GTM_CONSENT_READY_EVENT })
    expect(JSON.stringify(browser.dataLayer)).not.toContain('#')
  },
)

it('preserves consented tracking across public anchors but denies unknown fragments', () => {
  const { browser, origin, script, appendChild } = mount('/contact', false)
  script.onload?.()
  browser.history.pushState(null, '', '/contact#contact-enquiry')
  expect(appendChild).toHaveBeenCalledOnce()
  browser.history.replaceState(null, '', '/contact#private-token')
  expect(browser.dataLayer.at(-1)).toMatchObject({ 0: 'consent', 1: 'update', 2: { analytics_storage: 'denied', ad_storage: 'denied' } })
  browser.history.replaceState(null, '', '/contact#contact-enquiry')
  expect(browser.location.href).toBe(origin + '/contact#contact-enquiry')
  expect(appendChild).toHaveBeenCalledOnce()
  expect(browser.dataLayer.at(-1)).toEqual({ event: GTM_CONSENT_READY_EVENT })
  expect(JSON.stringify(browser.dataLayer)).not.toContain('private-token')
})
it('initializes the cart with denied defaults and preserves denial on a client transition to checkout', () => {
  const { browser, script, appendChild } = mount('/cart', false, false)
  script.onload?.()
  expect(appendChild).toHaveBeenCalledOnce()
  expect(browser.dataLayer).not.toContainEqual({ event: GTM_CONSENT_READY_EVENT })
  browser.history.pushState(null, '', '/checkout')
  expect(appendChild).toHaveBeenCalledOnce()
  expect(browser.dataLayer).not.toContainEqual({ event: GTM_CONSENT_READY_EVENT })
})

it.each([false, true])('the real GTM-ready listener drains the planner receipt while respecting withdrawal: %s', async withdraw => {
  const { browser, script, appendChild } = mount('/make-your-trip?from=2026-11-27&to=2026-11-30', false)
  const event = { event: 'trip_request_created', event_id: 'tr_' + 'a'.repeat(32) }
  Object.assign(browser, { fetch: vi.fn().mockResolvedValue(Response.json({ tripRequestMeasurement: event }, { status: 201 })) })
  const draft = { contact: { name: 'Private customer', email: 'private@example.test', phone: '+12025550123' }, notes: 'private notes' } as MakeYourTripRequestDraft
  await submitTripRequest(browser as unknown as Window, 'production', draft)
  const leads = () => browser.dataLayer.filter(entry => (entry as { event?: string }).event === 'trip_request_created')
  expect(leads()).toEqual([])
  if (withdraw) browser.dispatchEvent(Object.assign(new Event('sp:consent-change'), { detail: { analytics: false, marketing: false } }))
  script.onload?.()
  expect(leads()).toEqual(withdraw ? [] : [{ ...event, ads_eligible: false }])
  browser.dispatchEvent(new Event('online'))
  browser.dispatchEvent(new Event('hashchange'))
  expect(leads()).toHaveLength(withdraw ? 0 : 1)
  expect(appendChild).toHaveBeenCalledOnce()
  for (const secret of ['Private customer', 'private@example.test', '+12025550123', 'private notes', '2026-11-27']) expect(JSON.stringify(browser.dataLayer)).not.toContain(secret)
})

it('retries a failed container after reconnection while preserving current consent', () => {
  const { browser, script, appendChild } = mount('/trips', false)
  script.onerror?.()
  browser.dispatchEvent(new Event('online'))
  expect(appendChild).toHaveBeenCalledTimes(2)
  script.onload?.()
  expect(browser.dataLayer).toContainEqual({ event: GTM_CONSENT_READY_EVENT })
  browser.dispatchEvent(new Event('online'))
  expect(appendChild).toHaveBeenCalledTimes(2)
})

it.each(['hashchange', 'popstate', 'navigation', 'replaceState', 'pushState'] as const)('starts once after same-document fragment recovery via %s', change => {
  const { browser, origin, location, navigation, script, appendChild } = mount('/trips#private', change === 'navigation')
  expect(appendChild).not.toHaveBeenCalled()
  if (change === 'replaceState' || change === 'pushState') browser.history[change](null, '', '/trips')
  else {
    location.href = origin + '/trips'
    if (change === 'navigation') navigation!.dispatchEvent(new Event('currententrychange'))
    else browser.dispatchEvent(new Event(change))
  }
  expect(appendChild).toHaveBeenCalledOnce()
  script.onload?.()
  expect(browser.dataLayer).toContainEqual({ event: GTM_CONSENT_READY_EVENT })
  expect(JSON.stringify(browser.dataLayer)).not.toContain('private')
  browser.dispatchEvent(new Event('hashchange'))
  expect(appendChild).toHaveBeenCalledOnce()
})

it('keeps private routes excluded after a fragment is removed', () => {
  const { browser, location, origin, appendChild } = mount('/checkout#private', false)
  location.href = origin + '/checkout'
  browser.dispatchEvent(new Event('hashchange'))
  expect(appendChild).not.toHaveBeenCalled()
  expect(browser.dataLayer).toEqual([])
})
