import { randomUUID } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { SiteMeasurement } from '@/components/site-measurement'
import { installEnquiryHistoryTracking } from '@/lib/enquiry-navigation'
import { TRACKING_CONSENT_STORAGE_KEY } from '@/lib/tracking'
import { GTM_CONSENT_READY_EVENT } from '@/lib/tracking-browser'
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
