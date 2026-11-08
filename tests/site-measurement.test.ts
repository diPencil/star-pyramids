import { randomUUID } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { SiteMeasurement } from '@/components/site-measurement'
import { installEnquiryHistoryTracking } from '@/lib/enquiry-navigation'
import { TRACKING_CONSENT_STORAGE_KEY } from '@/lib/tracking'
import { GTM_CONSENT_READY_EVENT } from '@/lib/tracking-browser'

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

function mount(path: string, modern: boolean) {
  const origin = 'https://starpyramids.com'
  const location = { href: origin + path }
  const navigation = modern ? new EventTarget() : undefined
  const values = new Map([[TRACKING_CONSENT_STORAGE_KEY, '{"analytics":true,"marketing":false}']])
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
