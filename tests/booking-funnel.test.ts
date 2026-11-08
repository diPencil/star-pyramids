import { randomUUID } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { bookingMeasurementHeaders, flushBookingFunnel, FUNNEL_STORAGE_PREFIX, recordBeginCheckout, recordBookingReceipt, recordCartAddition, recordTripRequestReceipt, tripRequestMeasurementGrants } from '@/lib/booking-funnel'
import { BOOKING_MEASUREMENT_HEADER, parseBookingFunnelEvent } from '@/lib/booking-measurement'
import { TRACKING_CONSENT_STORAGE_KEY } from '@/lib/tracking'
import { initializeGtm, readTrackingConsent, updateGoogleConsent } from '@/lib/tracking-browser'
import { submitTripRequest } from '@/lib/trip-request-submission'
import { tripRequestMeasurement } from '@/lib/server/trip-request-measurement'
import type { MakeYourTripRequestDraft } from '@/lib/trip-request'

const origin = 'https://starpyramids.com'
const environment = 'production'
const analyticsGrant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const marketingGrant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const newAnalyticsGrant = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const newMarketingGrant = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const booking = {
  event: 'sp_booking_created',
  event_id: 'bk_' + 'a'.repeat(32),
  currency: 'USD',
  value: 305.10,
  items: [{ item_id: 'cairo-tour', quantity: 1, price: 105.10 }, { item_id: 'luxor-tour', quantity: 1, price: 200 }],
}
const receipt = { event: booking, grants: { analytics: analyticsGrant } }
const analyticsLead = { ...booking, ads_eligible: false }
const tripLead = tripRequestMeasurement('opaque-persisted-row-id')
const privateDraft = { contact: { name: 'Private Name', email: 'private@example.test', phone: '+12025550123' }, notes: 'private-note' } as MakeYourTripRequestDraft
const tripResponse = { reference: 'SP-TR-ABC123', ...privateDraft, tripRequestMeasurement: tripLead }

function storage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

function documentAt(path: string, local = storage(), session = storage()) {
  const layer: unknown[] = []
  const script: { onload?: () => void } = {}
  const browser = Object.assign(new EventTarget(), {
    location: { href: new URL(path, origin).href },
    localStorage: local, sessionStorage: session,
    crypto: { randomUUID }, dataLayer: layer, navigator: {},
    document: { createElement: () => script, head: { appendChild: vi.fn() } },
  }) as unknown as Window
  return {
    browser, layer, local, session,
    boot: () => {
      initializeGtm(browser, 'GTM-TEST', readTrackingConsent(browser), environment)
      layer.length = 0
    },
    ready: () => { script.onload?.(); layer.length = 0 },
  }
}

function setConsent(local: Storage, analytics: boolean, marketing?: string, analyticsId = analyticsGrant) {
  local.setItem(TRACKING_CONSENT_STORAGE_KEY, JSON.stringify({
    analytics, marketing: Boolean(marketing), grants: { analytics: analytics ? analyticsId : undefined, marketing },
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('projects a stable opaque trip lead ID and rejects raw references or extra personal fields', () => {
  expect(tripLead).toEqual(tripRequestMeasurement('opaque-persisted-row-id'))
  expect(tripRequestMeasurement('different-row-id')).not.toEqual(tripLead)
  expect(tripLead.event_id).toMatch(/^tr_[a-f0-9]{32}$/)
  expect(parseBookingFunnelEvent({ ...tripLead, ...privateDraft, reference: tripResponse.reference, value: 1000 })).toEqual(tripLead)
  expect(parseBookingFunnelEvent({ ...tripLead, event_id: tripResponse.reference })).toBeNull()
})

it('captures only a successful persisted creation and dispatches it once on a public page after reload/replay', async () => {
  const planner = documentAt('/make-your-trip?tour=cairo-tour&guests=2&utm_source=google&gclid=abc_123')
  setConsent(planner.local, true)
  const request = vi.fn().mockResolvedValue(Response.json(tripResponse, { status: 201 }))
  Object.assign(planner.browser, { fetch: request })
  expect(await submitTripRequest(planner.browser, environment, privateDraft)).toEqual(tripResponse)
  expect(request).toHaveBeenCalledWith('/api/trip-requests', expect.objectContaining({ method: 'POST', credentials: 'same-origin' }))
  expect(planner.layer).toEqual([])
  const key = FUNNEL_STORAGE_PREFIX + tripLead.event_id
  const queued = planner.local.getItem(key)
  expect(queued).not.toBeNull()
  for (const secret of ['Private Name', 'private@example.test', '+12025550123', 'private-note', tripResponse.reference, 'opaque-persisted-row-id', 'cairo-tour']) expect(queued).not.toContain(secret)
  const reloaded = documentAt('/make-your-trip', planner.local)
  recordTripRequestReceipt(reloaded.browser, environment, tripLead, { analytics: analyticsGrant })
  expect(planner.local.getItem(key)).toBe(queued)
  const page = documentAt('/', planner.local)
  page.boot(); page.ready()
  await flushBookingFunnel(page.browser, environment)
  expect(page.layer).toEqual([{ ...tripLead, ads_eligible: false }])
  recordTripRequestReceipt(reloaded.browser, environment, tripLead, { analytics: analyticsGrant })
  await flushBookingFunnel(page.browser, environment)
  const revisit = documentAt('/', planner.local)
  revisit.boot(); revisit.ready()
  await flushBookingFunnel(revisit.browser, environment)
  expect(revisit.layer).toEqual([])
  expect(page.layer).toHaveLength(1)
})

it.each([200, 400, 422, 500])('does not count an unconfirmed creation response (%s)', async status => {
  const planner = documentAt('/make-your-trip')
  setConsent(planner.local, true)
  Object.assign(planner.browser, { fetch: vi.fn().mockResolvedValue(Response.json({ ...tripResponse, error: 'fixture failure' }, { status })) })
  const result = submitTripRequest(planner.browser, environment, privateDraft)
  if (status >= 400) await expect(result).rejects.toThrow('fixture failure')
  else await expect(result).resolves.toEqual(expect.objectContaining({ reference: tripResponse.reference }))
  expect(planner.local.getItem(FUNNEL_STORAGE_PREFIX + tripLead.event_id)).toBeNull()
})

it('does not count a lost response or an update of an existing request', async () => {
  const planner = documentAt('/make-your-trip')
  setConsent(planner.local, true)
  const request = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(Response.json(tripResponse, { status: 201 }))
  Object.assign(planner.browser, { fetch: request })
  await expect(submitTripRequest(planner.browser, environment, privateDraft)).rejects.toThrow('offline')
  await submitTripRequest(planner.browser, environment, privateDraft, tripResponse.reference)
  expect(request).toHaveBeenLastCalledWith(`/api/account/trip-requests/${tripResponse.reference}`, expect.objectContaining({ method: 'PATCH' }))
  expect(planner.local.getItem(FUNNEL_STORAGE_PREFIX + tripLead.event_id)).toBeNull()
})

it.each(['denied', 'late-grant', 'withdrawn', 'regranted'] as const)('requires continuous Analytics consent through creation: %s', async scenario => {
  const planner = documentAt('/make-your-trip')
  setConsent(planner.local, scenario === 'withdrawn' || scenario === 'regranted')
  Object.assign(planner.browser, { fetch: vi.fn().mockImplementation(async () => {
    if (scenario === 'late-grant') setConsent(planner.local, true)
    if (scenario === 'withdrawn') setConsent(planner.local, false)
    if (scenario === 'regranted') setConsent(planner.local, true, undefined, newAnalyticsGrant)
    return Response.json(tripResponse, { status: 201 })
  }) })
  await submitTripRequest(planner.browser, environment, privateDraft)
  expect(planner.local.getItem(FUNNEL_STORAGE_PREFIX + tripLead.event_id)).toBeNull()
})

it('does not restore a queued trip lead after Analytics withdrawal and a new grant', async () => {
  const planner = documentAt('/make-your-trip')
  setConsent(planner.local, true)
  recordTripRequestReceipt(planner.browser, environment, tripLead, tripRequestMeasurementGrants(planner.browser, environment))
  setConsent(planner.local, true, undefined, newAnalyticsGrant)
  const page = documentAt('/', planner.local)
  page.boot(); page.ready()
  await flushBookingFunnel(page.browser, environment)
  expect(page.layer).toEqual([])
  expect(planner.local.getItem(FUNNEL_STORAGE_PREFIX + tripLead.event_id)).toBeNull()
})

it.each([
  [undefined, marketingGrant, false], [marketingGrant, newMarketingGrant, false], [marketingGrant, marketingGrant, true],
])('preserves Marketing eligibility captured before trip persistence (%s -> %s)', async (captured, current, eligible) => {
  const planner = documentAt('/make-your-trip')
  setConsent(planner.local, true, captured)
  const grants = tripRequestMeasurementGrants(planner.browser, environment)
  setConsent(planner.local, true, current)
  recordTripRequestReceipt(planner.browser, environment, tripLead, grants)
  const page = documentAt('/', planner.local)
  page.boot(); page.ready()
  await flushBookingFunnel(page.browser, environment)
  expect(page.layer).toEqual([{ ...tripLead, ads_eligible: eligible }])
})

it.each(['/make-your-trip?token=private', '/make-your-trip#private', '/make-your-trip?utm_source=person%40example.test', '/make-your-trip?tour=a&tour=b', '/account/trip-requests', 'https://qa.example.test/make-your-trip'])(
  'does not capture a trip lead on an ineligible location: %s', path => {
    const planner = documentAt(path)
    setConsent(planner.local, true)
    recordTripRequestReceipt(planner.browser, environment, tripLead, { analytics: analyticsGrant })
    expect(planner.local.getItem(FUNNEL_STORAGE_PREFIX + tripLead.event_id)).toBeNull()
  },
)

it('keeps successful trip submission usable when measurement storage fails', async () => {
  const planner = documentAt('/make-your-trip')
  setConsent(planner.local, true)
  Object.assign(planner.browser, { fetch: vi.fn().mockResolvedValue(Response.json(tripResponse, { status: 201 })) })
  vi.spyOn(planner.local, 'setItem').mockImplementation(() => { throw Error('storage blocked') })
  await expect(submitTripRequest(planner.browser, environment, privateDraft)).resolves.toEqual(tripResponse)
  expect(planner.layer).toEqual([])
})

it('queues checkout and receipt across refresh and drains them once on a ready public page', async () => {
  const checkout = documentAt('/checkout')
  setConsent(checkout.local, true)
  recordBeginCheckout(checkout.browser, environment, ['cairo-tour', 'luxor-tour'])
  const reloaded = documentAt('/checkout', checkout.local, checkout.session)
  recordBeginCheckout(reloaded.browser, environment, ['luxor-tour', 'cairo-tour'])
  recordBookingReceipt(reloaded.browser, environment, {
    ...receipt,
    event: { ...booking, guestAccessUrl: '/booking/private-token', email: 'guest@example.com',
      items: booking.items.map(item => ({ ...item, notes: 'private notes' })) },
  })
  recordBookingReceipt(reloaded.browser, environment, receipt)
  await flushBookingFunnel(reloaded.browser, environment)
  expect(reloaded.layer).toEqual([])
  expect(checkout.local.getItem(FUNNEL_STORAGE_PREFIX + booking.event_id)).not.toMatch(/private|guest@/)

  const publicPage = documentAt('/', checkout.local)
  publicPage.boot()
  await flushBookingFunnel(publicPage.browser, environment)
  expect(publicPage.layer).toEqual([])
  publicPage.ready()
  await flushBookingFunnel(publicPage.browser, environment)
  expect(publicPage.layer).toEqual([
    {
      event: 'sp_begin_checkout', event_id: expect.stringMatching(/^f_/),
      items: [{ item_id: 'cairo-tour', quantity: 1 }, { item_id: 'luxor-tour', quantity: 1 }],
    },
    analyticsLead,
  ])
  expect(checkout.local.getItem(FUNNEL_STORAGE_PREFIX + booking.event_id)).toBeNull()

  recordBookingReceipt(reloaded.browser, environment, receipt)
  const later = documentAt('/', checkout.local)
  later.boot()
  later.ready()
  await flushBookingFunnel(later.browser, environment)
  expect(later.layer).toEqual([])
})

it('dispatches a single safe cart item only with consent and a production public page', async () => {
  const page = documentAt('/')
  setConsent(page.local, true)
  page.boot()
  page.ready()
  recordCartAddition(page.browser, 'development', 'cairo-tour')
  recordCartAddition(page.browser, environment, 'guest@example.com')
  recordCartAddition(page.browser, environment, 'cairo-tour')
  setConsent(page.local, false)
  recordCartAddition(page.browser, environment, 'luxor-tour')
  await flushBookingFunnel(page.browser, environment)
  expect(page.layer).toEqual([{
    event: 'sp_add_to_cart', event_id: expect.stringMatching(/^f_/),
    items: [{ item_id: 'cairo-tour', quantity: 1 }],
  }])
})

it('drains a recovered receipt only once across simultaneous public tabs', async () => {
  const checkout = documentAt('/checkout')
  setConsent(checkout.local, true)
  recordBookingReceipt(checkout.browser, environment, receipt)
  const first = documentAt('/', checkout.local)
  const second = documentAt('/', checkout.local)
  let tail = Promise.resolve()
  const request = vi.fn((_name: string, task: () => void) => {
    tail = tail.then(task)
    return tail
  })
  for (const tab of [first, second]) {
    Object.assign(tab.browser.navigator, { locks: { request } })
    tab.boot()
    tab.ready()
  }
  await Promise.all([flushBookingFunnel(first.browser, environment), flushBookingFunnel(second.browser, environment)])
  expect(request).toHaveBeenCalledTimes(2)
  expect([...first.layer, ...second.layer]).toEqual([analyticsLead])
})

it('refreshes an expired undelivered booking on replay without refreshing it twice or overriding delivery', async () => {
  const checkout = documentAt('/checkout')
  setConsent(checkout.local, true)
  const key = FUNNEL_STORAGE_PREFIX + booking.event_id
  const expired = Date.now() - 7 * 24 * 60 * 60 * 1000
  checkout.local.setItem(key, JSON.stringify({ ...receipt, capturedAt: expired }))

  recordBookingReceipt(checkout.browser, environment, receipt)
  const refreshed = checkout.local.getItem(key)
  expect(JSON.parse(refreshed!)).toMatchObject({ event: booking })
  expect(JSON.parse(refreshed!).capturedAt).toBeGreaterThan(expired)
  recordBookingReceipt(checkout.browser, environment, receipt)
  expect(checkout.local.getItem(key)).toBe(refreshed)

  const publicPage = documentAt('/', checkout.local)
  publicPage.boot()
  publicPage.ready()
  await flushBookingFunnel(publicPage.browser, environment)
  expect(publicPage.layer).toEqual([analyticsLead])
  checkout.local.setItem(key, JSON.stringify({ ...receipt, capturedAt: expired }))
  recordBookingReceipt(checkout.browser, environment, receipt)
  expect(JSON.parse(checkout.local.getItem(key)!).capturedAt).toBe(expired)
  await flushBookingFunnel(publicPage.browser, environment)
  expect(publicPage.layer).toEqual([analyticsLead])
  expect(checkout.local.getItem(key)).toBeNull()
})

it('fails closed for consent withdrawal, token-bearing checkout and nonproduction hosts', async () => {
  const checkout = documentAt('/checkout')
  vi.stubGlobal('window', checkout.browser)
  vi.stubEnv('NODE_ENV', environment)
  expect(bookingMeasurementHeaders(true)).toEqual({})
  setConsent(checkout.local, true)
  expect(bookingMeasurementHeaders(true)).toEqual({ [BOOKING_MEASUREMENT_HEADER]: analyticsGrant })
  expect(bookingMeasurementHeaders(false)).toEqual({})
  for (const path of ['/checkout?token=private', '/checkout#private', '/booking/private', 'https://staging.example.com/checkout']) {
    const { browser } = documentAt(path, checkout.local)
    vi.stubGlobal('window', browser)
    expect(bookingMeasurementHeaders(true)).toEqual({})
    recordBookingReceipt(browser, environment, receipt)
  }
  expect(checkout.local.length).toBe(1)
  recordBookingReceipt(checkout.browser, environment, receipt)
  const publicPage = documentAt('/', checkout.local)
  publicPage.boot()
  publicPage.ready()
  setConsent(publicPage.local, false)
  updateGoogleConsent(publicPage.browser, { analytics: false, marketing: false })
  await flushBookingFunnel(publicPage.browser, environment)
  expect(checkout.local.getItem(FUNNEL_STORAGE_PREFIX + booking.event_id)).toBeNull()
  expect(publicPage.layer).not.toContainEqual(booking)
})

it.each([
  [undefined, marketingGrant, false],
  [marketingGrant, undefined, false],
  [marketingGrant, newMarketingGrant, false],
  [marketingGrant, marketingGrant, true],
])('requires continuous Marketing consent at capture and dispatch (%s -> %s)', async (captured, current, eligible) => {
  const checkout = documentAt('/checkout')
  setConsent(checkout.local, true, captured)
  recordBookingReceipt(checkout.browser, environment, { ...receipt, grants: { analytics: analyticsGrant, marketing: captured } })
  setConsent(checkout.local, true, current)
  const page = documentAt('/', checkout.local)
  page.boot()
  page.ready()
  await flushBookingFunnel(page.browser, environment)
  expect(page.layer).toEqual([{ ...booking, ads_eligible: eligible }])
})

it('rejects old receipts and pending leads after Analytics withdrawal and regrant, even if queue cleanup did not run', async () => {
  const checkout = documentAt('/checkout')
  setConsent(checkout.local, true, marketingGrant)
  recordBookingReceipt(checkout.browser, environment, receipt)
  const key = FUNNEL_STORAGE_PREFIX + booking.event_id
  expect(checkout.local.getItem(key)).not.toBeNull()
  setConsent(checkout.local, false, marketingGrant)
  setConsent(checkout.local, true, marketingGrant, newAnalyticsGrant)
  const page = documentAt('/', checkout.local)
  page.boot()
  page.ready()
  await flushBookingFunnel(page.browser, environment)
  recordBookingReceipt(checkout.browser, environment, receipt)
  expect(checkout.local.getItem(key)).toBeNull()
  expect(page.layer).toEqual([])
})

it.each([
  { value: 0 }, { currency: 'EUR' }, { event_id: 'SP-BK-ABC123' },
  { items: [{ item_id: '/booking/token', quantity: 1, price: 305.10 }] },
  { items: [{ item_id: 'tour', quantity: 3, price: 305.10 }] },
])('rejects malformed or private booking payload fields (%j)', change => {
  expect(parseBookingFunnelEvent({ ...booking, ...change })).toBeNull()
})
