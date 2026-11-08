import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_GTM_CONTAINER_ID,
  TRACKING_CONSENT_STORAGE_KEY,
  canMeasureLocation,
  isSafeTrackingUrl,
  isValidGtmContainerId,
  normalizeGtmContainerId,
  resolveTrackingSettings,
  sanitizeMeasurementUrl,
} from '@/lib/tracking'
import { analyticsDataLayer, GTM_CONSENT_READY_EVENT, initializeGtm, isGtmReady, readTrackingConsent, readTrackingGrants, subscribeToTrackingConsent, updateGoogleConsent } from '@/lib/tracking-browser'

const production = 'https://starpyramids.com'

function browserAt(href: string, stored?: string) {
  const values = new Map<string, string>()
  if (stored) values.set(TRACKING_CONSENT_STORAGE_KEY, stored)
  const browser = Object.assign(new EventTarget(), {
    location: { href },
    crypto: { randomUUID },
    localStorage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
      removeItem: vi.fn((key: string) => { values.delete(key) }),
    },
    document: {
      createElement: vi.fn(() => ({})),
      head: { appendChild: vi.fn() },
    },
    dataLayer: [] as unknown[],
  })
  return { browser, window: browser as unknown as Window }
}

function consentChange(detail: unknown) {
  return Object.assign(new Event('sp:consent-change'), { detail })
}

function finishLoading(browser: ReturnType<typeof browserAt>['browser']) {
  const script = browser.document.head.appendChild.mock.calls[0][0] as { onload(): void }
  script.onload()
}

describe('Google Tag Manager configuration', () => {
  it('preserves old explicit choices and supplies stable category grants across reloads and tabs', () => {
    const { browser, window } = browserAt(production, '{"analytics":true,"marketing":false}')
    expect(readTrackingConsent(window)).toEqual({ analytics: true, marketing: false })
    const grants = readTrackingGrants(window)
    expect(grants).toEqual({ analytics: expect.stringMatching(/^[a-f0-9-]{36}$/), marketing: undefined })
    const reload = browserAt(production)
    reload.browser.localStorage = browser.localStorage
    expect(readTrackingGrants(reload.window)).toEqual(grants)
    expect(browser.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY)).toBe('{"analytics":true,"marketing":false}')
  })

  it('never overwrites a withdrawal that occurs while old grant metadata is initialized', () => {
    const { browser, window } = browserAt(production, '{"analytics":true,"marketing":true}')
    const write = browser.localStorage.setItem.getMockImplementation()!
    browser.localStorage.setItem.mockImplementation((key, value) => {
      write(key, value)
      if (key === 'sp-consent-legacy-grants-v1') write(TRACKING_CONSENT_STORAGE_KEY, '{"analytics":false,"marketing":false}')
    })
    expect(readTrackingConsent(window)).toEqual({ analytics: false, marketing: false })
    const reload = browserAt(production)
    reload.browser.localStorage = browser.localStorage
    expect(readTrackingConsent(reload.window)).toEqual({ analytics: false, marketing: false })
    expect(readTrackingGrants(reload.window)).toEqual({ analytics: undefined, marketing: undefined })
    expect(browser.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY)).toBe('{"analytics":false,"marketing":false}')
  })

  it('fails closed if legacy grant metadata cannot be persisted', () => {
    const { browser, window } = browserAt(production, '{"analytics":true,"marketing":true}')
    const write = browser.localStorage.setItem.getMockImplementation()!
    browser.localStorage.setItem.mockImplementation((key, value) => {
      if (key === 'sp-consent-legacy-grants-v1') throw Error('storage unavailable')
      write(key, value)
    })
    expect(readTrackingConsent(window)).toEqual({ analytics: false, marketing: false })
    expect(readTrackingGrants(window)).toEqual({})
  })

  it('does not repair missing or malformed proofs in modern consent records as legacy consent', () => {
    for (const grants of [{}, { analytics: 'invalid-proof' }]) {
      const { browser, window } = browserAt(production, JSON.stringify({ analytics: true, marketing: false, grants }))
      expect(readTrackingConsent(window)).toEqual({ analytics: false, marketing: false })
      expect(readTrackingGrants(window)).toEqual({})
      expect(browser.localStorage.getItem('sp-consent-legacy-grants-v1')).toBeNull()
    }
  })
  it.each([
    '/make-your-trip', '/make-your-trip?from=2026-11-27&to=2026-11-30',
    '/make-your-trip?tour=cairo-tour&destination=cairo&guests=2&adults=2&children=0&infants=0&addons=0,1&step=2',
    '/make-your-trip?src=blog_vip_trip&blog=cairo-guide&utm_source=google&gtm_debug=x',
  ])('loads the public planner once in Advanced mode on validated entry %s', path => {
    const { browser, window } = browserAt(production + path)
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production', 'advanced')
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production', 'advanced')
    expect(browser.document.head.appendChild).toHaveBeenCalledOnce()
    expect(sanitizeMeasurementUrl(production + path, 'production')).toBe(production + '/make-your-trip')
  })

  it.each([
    '?email=private%40example.com', '?notes=private', '?edit=SP-TR-PRIVATE', '?ref=SP-TR-PRIVATE',
    '?token=secret', '?tour=person%40example.com', '?from=2026-02-30', '?from=2026-13-01',
    '?from=private', '?from=2026-11-27&from=2026-11-28', '?guests=999', '?addons=private', '#secret',
  ])('does not admit sensitive/malformed planner URL %s', suffix => {
    const { browser, window } = browserAt(production + '/make-your-trip' + suffix)
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, { analytics: true, marketing: true }, 'production', 'advanced')
    expect(browser.document.head.appendChild).not.toHaveBeenCalled()
    expect(browser.dataLayer).toEqual([])
  })
  it('retries Advanced load under denial without repeating defaults or startup', () => {
    const { browser, window } = browserAt(production)
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production', 'advanced')
    const first = browser.document.head.appendChild.mock.calls[0][0] as { onerror(): void; onload(): void }
    first.onerror()
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production', 'advanced')
    first.onload()
    expect(isGtmReady(window)).toBe(false)
    expect(browser.document.head.appendChild).toHaveBeenCalledTimes(2)
    expect(browser.dataLayer.filter(e => (e as { event?: string }).event === 'gtm.js')).toHaveLength(1)
    expect(browser.dataLayer.filter(e => Array.from(e as ArrayLike<unknown>)[1] === 'default')).toHaveLength(1)
  })

  it.each(['development', 'test'])('keeps Advanced disabled in %s', environment => {
    const { browser, window } = browserAt(production)
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, { analytics: false, marketing: false }, environment, 'advanced')
    expect(browser.document.head.appendChild).not.toHaveBeenCalled()
  })
  it('loads Advanced mode before consent with denied defaults and Google-only restrictions before execution', () => {
    const { browser, window } = browserAt(production)
    browser.document.head.appendChild.mockImplementation(() => {
      expect(browser.dataLayer[0]).toEqual({ 'gtm.allowlist': ['google'], 'gtm.blocklist': expect.arrayContaining(['html', 'nonGoogleScripts', 'sandboxedScripts']) })
      expect(Array.from(browser.dataLayer[1] as ArrayLike<unknown>)).toEqual(['consent', 'default', expect.objectContaining({
        analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
      })])
    })
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production', 'advanced')
    expect(browser.document.head.appendChild).toHaveBeenCalledOnce()
    finishLoading(browser)
    expect(isGtmReady(window)).toBe(true)
    expect(analyticsDataLayer(window, 'production')).toBeUndefined()
    expect(browser.dataLayer).not.toContainEqual({ event: GTM_CONSENT_READY_EVENT })
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production', 'advanced')
    expect(browser.document.head.appendChild).toHaveBeenCalledOnce()
  })

  it.each([
    { analytics: true, marketing: true }, { analytics: true, marketing: false },
    { analytics: false, marketing: true }, { analytics: false, marketing: false },
  ])('applies explicit Advanced preferences without reinjection: %j', choice => {
    const { browser, window } = browserAt(production)
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production', 'advanced')
    finishLoading(browser)
    browser.localStorage.setItem(TRACKING_CONSENT_STORAGE_KEY, JSON.stringify(choice))
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production', 'advanced')
    expect(Array.from(browser.dataLayer.filter(e => Array.from(e as ArrayLike<unknown>)[1] === 'update').at(-1) as ArrayLike<unknown>))
      .toEqual(['consent', 'update', expect.objectContaining({ analytics_storage: choice.analytics ? 'granted' : 'denied', ad_storage: choice.marketing ? 'granted' : 'denied' })])
    browser.localStorage.setItem(TRACKING_CONSENT_STORAGE_KEY, '{"analytics":false,"marketing":false}')
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production', 'advanced')
    expect(analyticsDataLayer(window, 'production')).toBeUndefined()
    expect(browser.document.head.appendChild).toHaveBeenCalledOnce()
  })

  it('does not restore a startup grant withdrawn while Advanced GTM is loading and copies an existing nonce', () => {
    const { browser, window } = browserAt(production, '{"analytics":true,"marketing":true}')
    Object.assign(browser.document, { querySelector: () => ({ nonce: 'fixture-nonce' }) })
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production', 'advanced')
    expect(browser.document.head.appendChild.mock.calls[0][0]).toHaveProperty('nonce', 'fixture-nonce')
    browser.localStorage.setItem(TRACKING_CONSENT_STORAGE_KEY, '{"analytics":false,"marketing":false}')
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production', 'advanced')
    finishLoading(browser)
    expect(analyticsDataLayer(window, 'production')).toBeUndefined()
    expect(browser.dataLayer).not.toContainEqual({ event: GTM_CONSENT_READY_EVENT })
    const updates = browser.dataLayer.map(e => Array.from(e as ArrayLike<unknown>)).filter(e => e[1] === 'update')
    for (const update of updates) expect(update[2]).toMatchObject({ analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
  })

  it.each(['/admin', '/account', '/website-cms-preview/home', '/trips#token', '/trips?token=secret'])('keeps Advanced excluded on %s', path => {
    const { browser, window } = browserAt(production + path)
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, { analytics: false, marketing: false }, 'production', 'advanced')
    expect(browser.document.head.appendChild).not.toHaveBeenCalled()
    expect(browser.dataLayer).toEqual([])
  })
  it('recovers a failed script without repeating defaults, startup or accepting a stale load callback', () => {
    const { browser, window } = browserAt(production, '{"analytics":true,"marketing":false}')
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    const first = browser.document.head.appendChild.mock.calls[0][0] as { onload(): void; onerror(): void; remove?: () => void }
    first.remove = vi.fn()
    first.onerror()
    expect(first.remove).toHaveBeenCalledOnce()
    expect(isGtmReady(window)).toBe(false)
    expect(analyticsDataLayer(window, 'production')).toBeUndefined()
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    expect(browser.document.head.appendChild).toHaveBeenCalledTimes(2)
    first.onload()
    expect(isGtmReady(window)).toBe(false)
    const second = browser.document.head.appendChild.mock.calls[1][0] as { onload(): void }
    second.onload()
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    expect(isGtmReady(window)).toBe(true)
    expect(browser.document.head.appendChild).toHaveBeenCalledTimes(2)
    expect(browser.dataLayer.filter(entry => (entry as { event?: string }).event === 'gtm.js')).toHaveLength(1)
    expect(browser.dataLayer.filter(entry => (entry as { event?: string }).event === GTM_CONSENT_READY_EVENT)).toHaveLength(1)
    expect(browser.dataLayer.filter(entry => Array.from(entry as ArrayLike<unknown>)[1] === 'default')).toHaveLength(1)
  })

  it('does not retry a failed script after withdrawal or on a protected URL', () => {
    const { browser, window } = browserAt(production, '{"analytics":true,"marketing":false}')
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    const first = browser.document.head.appendChild.mock.calls[0][0] as { onerror(): void; onload?: () => void }
    first.onerror()
    browser.localStorage.setItem(TRACKING_CONSENT_STORAGE_KEY, '{"analytics":false,"marketing":false}')
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, { analytics: true, marketing: false }, 'production')
    browser.localStorage.setItem(TRACKING_CONSENT_STORAGE_KEY, '{"analytics":true,"marketing":false}')
    browser.location.href = production + '/checkout'
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    expect(browser.document.head.appendChild).toHaveBeenCalledOnce()
    expect(isGtmReady(window)).toBe(false)
    first.onload?.()
    expect(isGtmReady(window)).toBe(false)
  })
  it('accepts only GTM container IDs', () => {
    expect(isValidGtmContainerId('GTM-KQ8GR36H')).toBe(true)
    expect(normalizeGtmContainerId('  GTM-KQ8GR36H  ')).toBe('GTM-KQ8GR36H')
    for (const invalid of ['', 'GTM-', 'GTM-kq8gr36h', 'UA-12345', 'GTM-KQ8GR36H;alert(1)', 'G-ABC123']) {
      expect(isValidGtmContainerId(invalid)).toBe(false)
    }
  })

  it('uses the supplied container and enables tracking when settings are unset', () => {
    expect(resolveTrackingSettings({ enabled: null, containerId: null })).toEqual({
      enabled: true,
      containerId: DEFAULT_GTM_CONTAINER_ID,
    })
  })

  it('honours an explicit disable and a configured container', () => {
    expect(resolveTrackingSettings({ enabled: 'false', containerId: 'GTM-ABC123' })).toEqual({
      enabled: false,
      containerId: 'GTM-ABC123',
    })
  })

  it('fails safely when a stored container ID is invalid', () => {
    expect(resolveTrackingSettings({ enabled: 'true', containerId: 'not-a-container' })).toEqual({
      enabled: false,
      containerId: '',
    })
  })

  it.each([
    '/admin/settings', '/account/bookings', '/website-cms-preview/homepage',
    '/login', '/register', '/forgot-password', '/reset-password?token=secret',
    '/booking/private', '/booking-account#token=secret', '/verify-voucher/private',
    '/checkout', '/search?q=person%40example.com', '/make-your-trip?edit=SP-TR-PRIVATE', '/rent-car/request',
    '/trips?%74oken=secret', '/trips?page=1&page=2', '/trips?gclid=person%40example.com',
    '/trips#token=secret', '/egypt-tours/person%40example.com', '/unknown',
    `/blogs/${'a'.repeat(43)}`, '/trips?sort=private', '/trips?destination=person%40example.com',
    '/trips?utm_source=google&utm_source=newsletter', '/trips?utm_unknown=google',
    '/trips?utm_source=person%40example.com', '/trips?utm_term=%2B1-555-123-4567',
    '/trips?utm_campaign=https%3A%2F%2Fexample.com', '/trips?utm_content=sale%0A',
    '/trips?utm_source=google&booking_token=private', '/trips?gclsrc=custom',
    '/account?utm_source=google', '/trips?utm_source=google#secret',
    `/trips?utm_term=${'a'.repeat(101)}`,
  ])('excludes %s from measurement', path => {
    expect(isSafeTrackingUrl(new URL(path, production))).toBe(false)
    expect(sanitizeMeasurementUrl(production + path, 'production')).toBeNull()
  })

  it('allows public landings and strips query data from the explicit analytics URL', () => {
    expect(isSafeTrackingUrl(new URL('/egypt-tours/cairo-day-tour?gclid=abc_123', production))).toBe(true)
    expect(isSafeTrackingUrl(new URL('/trips?category=one-day-tours&duration=day&price=under-200', production))).toBe(true)
    expect(sanitizeMeasurementUrl(`${production}/trips?page=2&wbraid=abc`, 'production')).toBe(`${production}/trips`)
  })

  it.each(['x', '1794000000000'])('permits the bounded Tag Assistant signal %s without putting it in measurement URLs', signal => {
    const url = `${production}/trips?gtm_debug=${signal}&utm_source=google`
    expect(canMeasureLocation(new URL(url), 'production')).toBe(true)
    expect(sanitizeMeasurementUrl(url, 'production')).toBe(`${production}/trips`)
    const { browser, window } = browserAt(url)
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    expect(browser.document.head.appendChild).not.toHaveBeenCalled()
    browser.localStorage.setItem(TRACKING_CONSENT_STORAGE_KEY, '{"analytics":true,"marketing":false}')
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    expect(browser.document.head.appendChild).toHaveBeenCalledOnce()
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    expect(browser.document.head.appendChild).toHaveBeenCalledOnce()
  })

  it.each([
    '/trips?gtm_debug=person%40example.com', '/trips?gtm_debug=', '/trips?gtm_debug=true',
    '/trips?gtm_debug=17940000000000', '/trips?gtm_debug=x&gtm_debug=x',
    '/trips?gtm_debug=x&token=secret', '/trips?gtm_debug=x#secret',
    '/account?gtm_debug=x', '/booking/private?gtm_debug=x',
    '/trips?gtm_debug=x&gtm_auth=secret', '/trips?gtm_debug=x&gtm_preview=env-1',
  ])('keeps invalid debug signals and sensitive contexts blocked: %s', path => {
    expect(canMeasureLocation(new URL(path, production), 'production')).toBe(false)
  })

  it('accepts bounded Google attribution and UTM parameters on the same public landing', () => {
    const campaign = 'gclid=abc_123&dclid=abc-123&gbraid=one&wbraid=two&gclsrc=aw.ds&gad_source=1&gad_campaignid=42' +
      '&utm_id=42&utm_source=google&utm_medium=cpc&utm_campaign=summer-2026&utm_term=cairo+day+tour' +
      '&utm_source_platform=Google+Ads&utm_content=text-ad&utm_creative_format=video&utm_marketing_tactic=remarketing'
    const landing = `${production}/trips?${campaign}`
    expect(canMeasureLocation(new URL(landing), 'production')).toBe(true)
    expect(sanitizeMeasurementUrl(landing, 'production')).toBe(`${production}/trips`)
  })

  it.each([
    [production, 'development'], [production, 'test'], ['http://starpyramids.com', 'production'],
    ['https://qa.starpyramids.com', 'production'], ['http://localhost:3000', 'production'],
    ['https://starpyramids.com.example.org', 'production'],
  ])('keeps %s (%s) isolated from the production container', (url, environment) => {
    expect(canMeasureLocation(new URL(url), environment)).toBe(false)
    const { browser, window } = browserAt(url)
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, { analytics: true, marketing: true }, environment)
    expect(browser.document.head.appendChild).not.toHaveBeenCalled()
    expect(browser.dataLayer).toEqual([])
  })

  it('waits for an explicit grant, queues denied defaults before GTM, and loads only once', () => {
    const { browser, window } = browserAt(production)
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    expect(browser.document.head.appendChild).not.toHaveBeenCalled()
    expect(browser.dataLayer).toEqual([])
    browser.localStorage.setItem(TRACKING_CONSENT_STORAGE_KEY, '{"analytics":true,"marketing":false}')
    browser.document.head.appendChild.mockImplementation(() => {
      expect(Array.from(browser.dataLayer[0] as ArrayLike<unknown>)).toEqual(['consent', 'default', {
        analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied',
        ad_personalization: 'denied', personalization_storage: 'denied',
        functionality_storage: 'granted', security_storage: 'granted', wait_for_update: 500,
      }])
      expect(Array.from(browser.dataLayer[1] as ArrayLike<unknown>)).toEqual(['set', 'ads_data_redaction', true])
      expect(browser.dataLayer[2]).toMatchObject({ event: 'gtm.js' })
    })
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    expect(browser.document.head.appendChild).toHaveBeenCalledExactlyOnceWith({
      async: true, referrerPolicy: 'no-referrer', onload: expect.any(Function), onerror: expect.any(Function), src: `https://www.googletagmanager.com/gtm.js?id=${DEFAULT_GTM_CONTAINER_ID}`,
    })
    expect(analyticsDataLayer(window, 'production')).toBeUndefined()
    finishLoading(browser)
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    expect(Array.from(browser.dataLayer[3] as ArrayLike<unknown>)).toEqual(['consent', 'update', expect.objectContaining({
      analytics_storage: 'granted', ad_storage: 'denied',
    })])
    expect(browser.dataLayer.filter(entry => (entry as { event?: string }).event === GTM_CONSENT_READY_EVENT)).toHaveLength(1)
  })

  it('restores only explicit choices, persists updates and supports withdrawal', () => {
    const { browser, window } = browserAt(production, '{"analytics":true,"marketing":false}')
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    finishLoading(browser)
    expect(Array.from(browser.dataLayer[3] as ArrayLike<unknown>)).toEqual(['consent', 'update', expect.objectContaining({
      analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    })])
    browser.localStorage.setItem.mockClear()
    const unsubscribe = subscribeToTrackingConsent(window, choice => updateGoogleConsent(window, choice))
    browser.dispatchEvent(consentChange({ analytics: 'true', marketing: true }))
    expect(browser.localStorage.setItem).not.toHaveBeenCalled()
    browser.dispatchEvent(consentChange({ analytics: false, marketing: false }))
    expect(browser.localStorage.setItem).toHaveBeenCalledExactlyOnceWith(TRACKING_CONSENT_STORAGE_KEY, '{"analytics":false,"marketing":false}')
    expect(Array.from(browser.dataLayer.at(-1) as ArrayLike<unknown>)).toEqual(['consent', 'update', expect.objectContaining({
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    })])
    unsubscribe()
  })

  it('keeps analytics denied when the visitor grants marketing alone', () => {
    const { browser, window } = browserAt(production, '{"analytics":false,"marketing":true}')
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    expect(browser.document.head.appendChild).toHaveBeenCalledOnce()
    finishLoading(browser)
    expect(Array.from(browser.dataLayer[3] as ArrayLike<unknown>)).toEqual(['consent', 'update', expect.objectContaining({
      analytics_storage: 'denied', ad_storage: 'granted', ad_user_data: 'granted',
    })])
    expect(analyticsDataLayer(window, 'production')).toBeUndefined()
  })

  it('clears the old grant before a failed preference write and denies on reload and in other tabs', () => {
    const { browser, window } = browserAt(production, '{"analytics":true,"marketing":true}')
    const other = browserAt(production)
    other.browser.localStorage = browser.localStorage
    initializeGtm(other.window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(other.window), 'production')
    finishLoading(other.browser)
    const update = vi.fn()
    const unsubscribe = subscribeToTrackingConsent(window, update)
    browser.localStorage.setItem.mockImplementation(() => { throw new Error('Storage quota') })

    browser.dispatchEvent(consentChange({ analytics: false, marketing: false }))
    expect(update).toHaveBeenCalledExactlyOnceWith({ analytics: false, marketing: false })
    expect(browser.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY)).toBeNull()
    expect(analyticsDataLayer(other.window, 'production')).toBeUndefined()
    const reloaded = browserAt(production)
    reloaded.browser.localStorage = browser.localStorage
    expect(readTrackingConsent(reloaded.window)).toEqual({ analytics: false, marketing: false })
    unsubscribe()
  })

  it('keeps startup denied after withdrawal and rereads current consent before applying a grant', () => {
    const { browser, window } = browserAt(production, '{"analytics":true,"marketing":true}')
    const stop = subscribeToTrackingConsent(window, choice => initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, choice, 'production'))
    initializeGtm(window, DEFAULT_GTM_CONTAINER_ID, readTrackingConsent(window), 'production')
    browser.dispatchEvent(consentChange({ analytics: false, marketing: false }))
    expect(Array.from(browser.dataLayer[3] as ArrayLike<unknown>)).toEqual(['consent', 'update', expect.objectContaining({
      analytics_storage: 'denied', ad_storage: 'denied',
    })])
    finishLoading(browser)
    expect(browser.dataLayer).not.toContainEqual({ event: GTM_CONSENT_READY_EVENT })
    expect(analyticsDataLayer(window, 'production')).toBeUndefined()
    browser.dispatchEvent(consentChange({ analytics: true, marketing: false }))
    expect(browser.dataLayer.at(-1)).toEqual({ event: GTM_CONSENT_READY_EVENT })
    expect(analyticsDataLayer(window, 'production')).toBe(browser.dataLayer)
    expect(browser.document.head.appendChild).toHaveBeenCalledOnce()
    stop()
  })

  it('retains only continuous category grants across explicit saves', () => {
    const { browser, window } = browserAt(production)
    const stop = subscribeToTrackingConsent(window, () => {})
    browser.dispatchEvent(consentChange({ analytics: true, marketing: true }))
    const original = readTrackingGrants(window)
    browser.dispatchEvent(consentChange({ analytics: true, marketing: false }))
    expect(readTrackingGrants(window)).toEqual({ analytics: original.analytics, marketing: undefined })
    browser.dispatchEvent(consentChange({ analytics: true, marketing: true }))
    const updated = readTrackingGrants(window)
    expect(updated.analytics).toBe(original.analytics)
    expect(updated.marketing).not.toBe(original.marketing)
    browser.dispatchEvent(consentChange({ analytics: false, marketing: true }))
    browser.dispatchEvent(consentChange({ analytics: true, marketing: true }))
    expect(readTrackingGrants(window)).toEqual({ analytics: expect.not.stringMatching(original.analytics!), marketing: updated.marketing })
    stop()
  })

  it('uses a denial-only cookie when the old grant cannot be removed, then honors a fresh saved choice', () => {
    const first = browserAt(production, '{"analytics":true,"marketing":true}')
    const second = browserAt(production)
    second.browser.localStorage = first.browser.localStorage
    let cookie = ''
    for (const tab of [first, second]) {
      Object.defineProperty(tab.browser.document, 'cookie', {
        get: () => cookie,
        set: (value: string) => { cookie = value.includes('Max-Age=0;') ? '' : value.split(';')[0] },
      })
    }
    const remove = first.browser.localStorage.removeItem.getMockImplementation()!
    const set = first.browser.localStorage.setItem.getMockImplementation()!
    first.browser.localStorage.removeItem.mockImplementation(() => { throw new Error('Storage is read-only') })
    first.browser.localStorage.setItem.mockImplementation(() => { throw new Error('Storage is read-only') })
    const firstUpdate = vi.fn()
    const secondUpdate = vi.fn()
    const unsubscribeFirst = subscribeToTrackingConsent(first.window, firstUpdate)
    const unsubscribeSecond = subscribeToTrackingConsent(second.window, secondUpdate)
    first.browser.dispatchEvent(consentChange({ analytics: false, marketing: false }))
    expect(firstUpdate).toHaveBeenLastCalledWith({ analytics: false, marketing: false })
    expect(first.browser.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY)).toContain('"analytics":true')
    expect(readTrackingConsent(second.window)).toEqual({ analytics: false, marketing: false })
    second.browser.dispatchEvent(Object.assign(new Event('storage'), { key: TRACKING_CONSENT_STORAGE_KEY, newValue: '{"analytics":true}' }))
    expect(secondUpdate).toHaveBeenLastCalledWith({ analytics: false, marketing: false })

    first.browser.localStorage.removeItem.mockImplementation(remove)
    first.browser.localStorage.setItem.mockImplementation(set)
    second.browser.dispatchEvent(consentChange({ analytics: true, marketing: false }))
    expect(cookie).toBe('')
    expect(readTrackingConsent(first.window)).toEqual({ analytics: true, marketing: false })
    unsubscribeFirst()
    unsubscribeSecond()
  })

  it('does not restore an old grant in a fresh document with read-only consent storage', () => {
    const { browser, window } = browserAt(production, '{"analytics":true,"marketing":true}')
    browser.localStorage.setItem.mockImplementation(() => { throw new Error('Storage is read-only') })
    expect(readTrackingConsent(window)).toEqual({ analytics: false, marketing: false })
  })

  it('fails closed for a reload when only a tab-local veto can be persisted and signals other open tabs', () => {
    const first = browserAt(production, '{"analytics":true,"marketing":true}')
    const second = browserAt(production)
    second.browser.localStorage = first.browser.localStorage
    const tabs = new Set<TestChannel>()
    class TestChannel {
      onmessage?: (event: { data: unknown }) => void
      constructor() { tabs.add(this) }
      postMessage(data: unknown) {
        for (const tab of tabs) if (tab !== this) tab.onmessage?.({ data })
      }
      close() { tabs.delete(this) }
    }
    function makeTabStorage() {
      const values = new Map<string, string>()
      return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value) },
      }
    }
    const tabStores = [makeTabStorage(), makeTabStorage()]
    for (const [index, tab] of [first, second].entries()) {
      Object.assign(tab.browser, { BroadcastChannel: TestChannel, sessionStorage: tabStores[index] })
      Object.defineProperty(tab.browser.document, 'cookie', { get: () => '', set: () => {} })
    }
    first.browser.localStorage.removeItem.mockImplementation(() => { throw new Error('Storage is read-only') })
    first.browser.localStorage.setItem.mockImplementation(() => { throw new Error('Storage is read-only') })
    const firstUpdate = vi.fn()
    const secondUpdate = vi.fn()
    const unsubscribeFirst = subscribeToTrackingConsent(first.window, firstUpdate)
    const unsubscribeSecond = subscribeToTrackingConsent(second.window, secondUpdate)

    first.browser.dispatchEvent(consentChange({ analytics: false, marketing: false }))
    expect(firstUpdate).toHaveBeenLastCalledWith({ analytics: false, marketing: false })
    expect(secondUpdate).toHaveBeenLastCalledWith({ analytics: false, marketing: false })
    for (const sessionStorage of tabStores) {
      const reload = browserAt(production)
      reload.browser.localStorage = first.browser.localStorage
      Object.assign(reload.browser, { sessionStorage })
      expect(readTrackingConsent(reload.window)).toEqual({ analytics: false, marketing: false })
    }
    unsubscribeFirst()
    unsubscribeSecond()
  })

  it('does not load for blocked URLs or disabled and invalid container IDs', () => {
    const denied = { analytics: false, marketing: false }
    for (const [url, container] of [[`${production}/booking-account#token=secret`, DEFAULT_GTM_CONTAINER_ID], [production, null], [production, 'GTM-<script>']] as const) {
      const { browser, window } = browserAt(url)
      initializeGtm(window, container, denied, 'production')
      expect(browser.document.head.appendChild).not.toHaveBeenCalled()
    }
  })

  it('applies consent revocation when another tab clears stored choices', () => {
    const { browser, window } = browserAt(production, '{"analytics":true,"marketing":true}')
    const update = vi.fn()
    expect(readTrackingConsent(window)).toEqual({ analytics: true, marketing: true })
    const unsubscribe = subscribeToTrackingConsent(window, update)
    browser.localStorage.removeItem(TRACKING_CONSENT_STORAGE_KEY)
    browser.dispatchEvent(Object.assign(new Event('storage'), { key: TRACKING_CONSENT_STORAGE_KEY }))
    expect(update).toHaveBeenCalledExactlyOnceWith({ analytics: false, marketing: false })
    unsubscribe()
  })
})
