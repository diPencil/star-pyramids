import { randomUUID } from 'node:crypto'
import { openBookingConfirmation } from '@/lib/booking/booking-confirmation'
import { afterEach, expect, it, vi } from 'vitest'
import { bookingMeasurementHeaders, flushBookingFunnel, FUNNEL_STORAGE_PREFIX, recordBeginCheckout, recordBookingReceipt, recordBookNowClick, recordCartAddition, recordTripRequestReceipt, resetCheckoutStart, tripRequestMeasurementGrants } from '@/lib/tracking/leads/booking-funnel'
import { BOOKING_MEASUREMENT_HEADER, parseBookingFunnelEvent } from '@/lib/tracking/leads/booking-measurement'
import { TRACKING_CONSENT_STORAGE_KEY } from '@/lib/tracking/tracking'
import { initializeGtm, readTrackingConsent, updateGoogleConsent } from '@/lib/tracking/tracking-browser'
import { submitTripRequest } from '@/lib/trip-builder/trip-request-submission'
import { tripRequestMeasurement } from '@/lib/server/tracking/leads/trip-request-measurement'
import type { MakeYourTripRequestDraft } from '@/lib/trip-builder/trip-request'
import { beginFormLead, confirmFormLead } from '@/lib/tracking/leads/form-lead'
import { formLeadMeasurement } from '@/lib/server/tracking/leads/form-lead-measurement'
import { validateTourWrite } from '@/lib/tours/tour-write'
import type { FormLeadType, FormLeadName } from '@/lib/tracking/leads/booking-measurement'

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

it('dispatches Book Now synchronously when GTM is ready, with only safe interaction fields', () => {
  const tour = documentAt('/egypt-tours/cairo-tour')
  setConsent(tour.local, true)
  tour.boot(); tour.ready()
  recordBookNowClick(tour.browser, environment, 'cairo-tour')
  recordBookNowClick(tour.browser, environment, 'private@example.test')
  expect(tour.layer).toEqual([{
    event: 'sp_book_now_click', event_id: expect.stringMatching(/^f_/), item_id: 'cairo-tour', placement: 'tour_detail',
  }])
})

it('recovers a startup Book Now click on a fresh cart document and drains it only once', async () => {
  const tour = documentAt('/egypt-tours/cairo-tour')
  setConsent(tour.local, true)
  tour.boot()
  recordBookNowClick(tour.browser, environment, 'cairo-tour')
  expect(tour.layer).toEqual([])

  const cart = documentAt('/cart', tour.local)
  cart.boot(); cart.ready()
  await flushBookingFunnel(cart.browser, environment)
  await flushBookingFunnel(cart.browser, environment)
  expect(cart.layer).toEqual([{
    event: 'sp_book_now_click', event_id: expect.stringMatching(/^f_/), item_id: 'cairo-tour', placement: 'tour_detail',
  }])
})

it('keeps deferred Book Now clicks off checkout and drops them after Analytics consent changes', async () => {
  const tour = documentAt('/egypt-tours/cairo-tour')
  setConsent(tour.local, true)
  tour.boot()
  recordBookNowClick(tour.browser, environment, 'cairo-tour')
  const checkout = documentAt('/checkout/details', tour.local)
  await flushBookingFunnel(checkout.browser, environment)
  expect(checkout.layer).toEqual([])

  setConsent(tour.local, false)
  setConsent(tour.local, true, undefined, newAnalyticsGrant)
  const cart = documentAt('/cart', tour.local)
  cart.boot(); cart.ready()
  await flushBookingFunnel(cart.browser, environment)
  expect(cart.layer).toEqual([])
})

it('does not dispatch old cart and checkout intents after Analytics is withdrawn and granted again', async () => {
  const cart = documentAt('/cart')
  setConsent(cart.local, true)
  cart.boot()
  recordCartAddition(cart.browser, environment, 'cairo-tour')
  recordBeginCheckout(cart.browser, environment, ['cairo-tour'])
  expect(cart.local.length).toBe(3)

  setConsent(cart.local, false)
  setConsent(cart.local, true, undefined, newAnalyticsGrant)
  const reloaded = documentAt('/cart', cart.local, cart.session)
  reloaded.boot(); reloaded.ready()
  await flushBookingFunnel(reloaded.browser, environment)
  expect(reloaded.layer).toEqual([])

  recordBeginCheckout(reloaded.browser, environment, ['cairo-tour'])
  recordBeginCheckout(reloaded.browser, environment, ['cairo-tour'])
  expect(reloaded.layer).toEqual([expect.objectContaining({ event: 'sp_begin_checkout' })])
})

it('drops an expired Book Now click even if its original consent remains granted', async () => {
  const tour = documentAt('/egypt-tours/cairo-tour')
  setConsent(tour.local, true)
  tour.boot()
  recordBookNowClick(tour.browser, environment, 'cairo-tour')
  const key = tour.local.key(1)!
  expect(key).toMatch(/^sp-funnel-v1:/)
  const pending = JSON.parse(tour.local.getItem(key)!)
  tour.local.setItem(key, JSON.stringify({ ...pending, capturedAt: Date.now() - 15 * 60 * 1000 }))

  const cart = documentAt('/cart', tour.local)
  cart.boot(); cart.ready()
  await flushBookingFunnel(cart.browser, environment)
  expect(cart.layer).toEqual([])
  expect(cart.local.getItem(key)).toBeNull()
})

const formCases: [FormLeadType, FormLeadName, string][] = [
  ['home_help', 'enquiry_created', '/'], ['shared_help', 'enquiry_created', '/egypt-tours/cairo-tour'],
  ['contact', 'enquiry_created', '/contact'], ['car_request', 'car_request_created', '/rent-car/request?vehicle=van'],
  ['event_request', 'event_request_created', '/events/cairo-event'],
  ['contact', 'enquiry_created', '/contact#contact-enquiry'],
  ['event_request', 'event_request_created', '/events/cairo-event#event-book'],
  ['event_request', 'event_request_created', '/events/cairo-event#event-program'],
]

it.each(formCases)('dispatches a persisted %s lead once with only safe fields', (form, event, path) => {
  const page = documentAt(path)
  setConsent(page.local, true, marketingGrant)
  page.boot(); page.ready()
  const attempt = beginFormLead(page.browser, environment, form)
  expect(page.layer).toEqual([])
  const leadMeasurement = formLeadMeasurement(event, 'private-reference')
  const data = { ...privateDraft, reference: 'private-reference', leadMeasurement: { ...leadMeasurement, ...privateDraft } }
  confirmFormLead(page.browser, environment, attempt, 201, data)
  confirmFormLead(page.browser, environment, attempt, event === 'enquiry_created' ? 200 : 201, data)
  expect(page.layer).toEqual([{ ...leadMeasurement, form_type: form, ads_eligible: true }])
  expect(JSON.stringify(page.layer)).not.toMatch(/private|reference|email|phone|notes|purchase|value|currency/)
})

it.each([400, 403, 422, 429, 500, 503])('does not measure unsuccessful form response %s', status => {
  const page = documentAt('/contact'); setConsent(page.local, true); page.boot(); page.ready()
  confirmFormLead(page.browser, environment, beginFormLead(page.browser, environment, 'contact'), status,
    { leadMeasurement: formLeadMeasurement('enquiry_created', 'persisted-fixture') })
  expect(page.layer).toEqual([])
})

it.each(['denied', 'late_grant', 'withdrawal', 'regrant'] as const)('does not promote a form attempt after %s', scenario => {
  const page = documentAt('/contact')
  setConsent(page.local, scenario === 'withdrawal' || scenario === 'regrant'); page.boot(); page.ready()
  const attempt = beginFormLead(page.browser, environment, 'contact')
  if (scenario === 'late_grant') setConsent(page.local, true)
  if (scenario === 'withdrawal') setConsent(page.local, false)
  if (scenario === 'regrant') setConsent(page.local, true, undefined, newAnalyticsGrant)
  confirmFormLead(page.browser, environment, attempt, 201, { leadMeasurement: formLeadMeasurement('enquiry_created', 'fixture') })
  expect(page.layer).toEqual([])
})

it('retains original Marketing eligibility on an enquiry retry and drains only after GTM readiness', async () => {
  const page = documentAt('/contact'); setConsent(page.local, true); page.boot()
  const attempt = beginFormLead(page.browser, environment, 'contact')
  setConsent(page.local, true, marketingGrant)
  const leadMeasurement = formLeadMeasurement('enquiry_created', 'replayed-fixture')
  confirmFormLead(page.browser, environment, attempt, 200, { leadMeasurement })
  expect(page.layer).toEqual([])
  page.ready(); await flushBookingFunnel(page.browser, environment)
  expect(page.layer).toEqual([{ ...leadMeasurement, form_type: 'contact', ads_eligible: false }])
  const reload = documentAt('/contact', page.local); reload.boot(); reload.ready()
  confirmFormLead(reload.browser, environment, beginFormLead(reload.browser, environment, 'contact'), 200, { leadMeasurement })
  expect(reload.layer).toEqual([])
})

it('rejects mismatched/missing receipts, updates and storage failures without breaking the form', () => {
  const page = documentAt('/contact'); setConsent(page.local, true); page.boot(); page.ready()
  const attempt = beginFormLead(page.browser, environment, 'contact')
  confirmFormLead(page.browser, environment, attempt, 201, { leadMeasurement: formLeadMeasurement('car_request_created', 'fixture') })
  confirmFormLead(page.browser, environment, attempt, 201, {})
  confirmFormLead(page.browser, environment, beginFormLead(page.browser, environment, 'car_request'), 200, { leadMeasurement: formLeadMeasurement('car_request_created', 'fixture') })
  expect(page.layer).toEqual([])
  vi.spyOn(page.local, 'setItem').mockImplementation(() => { throw Error('blocked') })
  expect(() => confirmFormLead(page.browser, environment, attempt, 201, { leadMeasurement: formLeadMeasurement('enquiry_created', 'fixture') })).not.toThrow()
  expect(page.layer).toEqual([])
})

it('keeps address-bearing car URLs untagged while retaining a safe consent-bound receipt for recovery', async () => {
  const car = documentAt('/rent-car/request?pickup=private%20address&dropoff=private%20hotel&type=One%20Way&date=2026-11-27')
  setConsent(car.local, true); car.boot(); car.ready()
  const leadMeasurement = formLeadMeasurement('car_request_created', 'private-reference')
  confirmFormLead(car.browser, environment, beginFormLead(car.browser, environment, 'car_request'), 201, { leadMeasurement })
  expect(car.layer).toEqual([])
  expect(car.local.getItem(FUNNEL_STORAGE_PREFIX + leadMeasurement.event_id)).not.toMatch(/private|address|hotel|2026-11/)
  const page = documentAt('/rent-car', car.local); page.boot(); page.ready()
  await flushBookingFunnel(page.browser, environment)
  expect(page.layer).toEqual([{ ...leadMeasurement, form_type: 'car_request', ads_eligible: false }])
})

it.each(['private-reference', 'enq_private@example.test', 'enq_' + 'a'.repeat(33)])('rejects malformed form receipt ID %s', event_id => {
  const page = documentAt('/contact'); setConsent(page.local, true); page.boot(); page.ready()
  confirmFormLead(page.browser, environment, beginFormLead(page.browser, environment, 'contact'), 201,
    { leadMeasurement: { event: 'enquiry_created', event_id } })
  expect(page.layer).toEqual([])
})

it.each(['withdrawal', 'private_navigation'] as const)('rechecks privacy after waiting for a queue lock: %s', async change => {
  const page = documentAt('/contact'); setConsent(page.local, true); page.boot(); page.ready()
  let flush!: () => void
  Object.assign(page.browser.navigator, { locks: { request: vi.fn((_name: string, task: () => void) => {
    flush = task
    return Promise.resolve()
  }) } })
  const leadMeasurement = formLeadMeasurement('enquiry_created', 'persisted-fixture')
  confirmFormLead(page.browser, environment, beginFormLead(page.browser, environment, 'contact'), 201, { leadMeasurement })
  expect(page.layer).toEqual([])
  if (change === 'withdrawal') setConsent(page.local, false)
  else Object.assign(page.browser.location, { href: origin + '/account?token=private' })
  flush()
  expect(page.layer).toEqual([])
  if (change === 'withdrawal') expect(page.local.getItem(FUNNEL_STORAGE_PREFIX + leadMeasurement.event_id)).toBeNull()
  else {
    const publicPage = documentAt('/contact', page.local); publicPage.boot(); publicPage.ready()
    await flushBookingFunnel(publicPage.browser, environment)
    expect(publicPage.layer).toEqual([{ ...leadMeasurement, form_type: 'contact', ads_eligible: false }])
  }
})

it('projects a stable opaque trip lead ID and rejects raw references or extra personal fields', () => {
  expect(tripLead).toEqual(tripRequestMeasurement('opaque-persisted-row-id'))
  expect(tripRequestMeasurement('different-row-id')).not.toEqual(tripLead)
  expect(tripLead.event_id).toMatch(/^tr_[a-f0-9]{32}$/)
  expect(parseBookingFunnelEvent({ ...tripLead, ...privateDraft, reference: tripResponse.reference, value: 1000 })).toEqual(tripLead)
  expect(parseBookingFunnelEvent({ ...tripLead, event_id: tripResponse.reference })).toBeNull()
})

it('dispatches a confirmed trip lead on the planner immediately, once, without private fields or a later page visit', async () => {
  const planner = documentAt('/make-your-trip?from=2026-11-27&to=2026-11-30')
  setConsent(planner.local, true, marketingGrant)
  planner.boot(); planner.ready()
  let respond!: (response: Response) => void
  Object.assign(planner.browser, { fetch: vi.fn(() => new Promise<Response>(resolve => { respond = resolve })) })
  const submission = submitTripRequest(planner.browser, environment, privateDraft)
  expect(planner.layer).toEqual([])
  respond(Response.json(tripResponse, { status: 201 }))
  await submission
  expect(planner.layer).toEqual([{ ...tripLead, ads_eligible: true }])
  recordTripRequestReceipt(planner.browser, environment, tripLead, { analytics: analyticsGrant, marketing: marketingGrant })
  await flushBookingFunnel(planner.browser, environment)
  const reload = documentAt('/make-your-trip', planner.local)
  reload.boot(); reload.ready()
  await flushBookingFunnel(reload.browser, environment)
  expect(reload.layer).toEqual([])
  expect(planner.layer).toHaveLength(1)
  for (const secret of ['Private Name', 'private@example.test', '+12025550123', 'private-note', tripResponse.reference, '2026-11-27']) {
    expect(JSON.stringify(planner.layer)).not.toContain(secret)
  }
})

it('drains a trip lead captured during GTM loading on the same planner once ready', async () => {
  const planner = documentAt('/make-your-trip')
  setConsent(planner.local, true)
  planner.boot()
  Object.assign(planner.browser, { fetch: vi.fn().mockResolvedValue(Response.json(tripResponse, { status: 201 })) })
  await submitTripRequest(planner.browser, environment, privateDraft)
  expect(planner.layer).toEqual([])
  expect(planner.local.getItem(FUNNEL_STORAGE_PREFIX + tripLead.event_id)).not.toBeNull()
  planner.ready()
  await flushBookingFunnel(planner.browser, environment)
  expect(planner.layer).toEqual([{ ...tripLead, ads_eligible: false }])
})

it.each([400, 422, 500])('does not emit a lead for a failed request on an initialized planner (%s)', async status => {
  const planner = documentAt('/make-your-trip')
  setConsent(planner.local, true)
  planner.boot(); planner.ready()
  Object.assign(planner.browser, { fetch: vi.fn().mockResolvedValue(Response.json({ ...tripResponse, error: 'fixture failure' }, { status })) })
  await expect(submitTripRequest(planner.browser, environment, privateDraft)).rejects.toThrow('fixture failure')
  expect(planner.layer).toEqual([])
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

it('dispatches checkout intent on cart before navigation and deduplicates the protected checkout', async () => {
  const cart = documentAt('/cart')
  setConsent(cart.local, true)
  cart.boot(); cart.ready()
  recordBeginCheckout(cart.browser, environment, ['cairo-tour', 'luxor-tour'])
  recordBeginCheckout(cart.browser, environment, ['luxor-tour', 'cairo-tour'])
  expect(cart.layer).toEqual([{
    event: 'sp_begin_checkout', event_id: expect.stringMatching(/^f_/),
    items: [{ item_id: 'cairo-tour', quantity: 1 }, { item_id: 'luxor-tour', quantity: 1 }],
  }])

  const checkout = documentAt('/checkout/details', cart.local, cart.session)
  recordBeginCheckout(checkout.browser, environment, ['cairo-tour', 'luxor-tour'])
  recordBookingReceipt(checkout.browser, environment, receipt)
  const confirmation = documentAt('/booking-confirmation', cart.local)
  confirmation.boot(); confirmation.ready()
  await flushBookingFunnel(confirmation.browser, environment)
  expect(checkout.layer).toEqual([])
  expect(confirmation.layer).toEqual([analyticsLead])
})

it('dispatches the checkout start once from the checkout summary after GTM startup', async () => {
  const summary = documentAt('/checkout?gtm_debug=x')
  setConsent(summary.local, true)
  recordBeginCheckout(summary.browser, environment, ['cairo-tour'])
  summary.boot()
  recordBeginCheckout(summary.browser, environment, ['cairo-tour'])
  expect(summary.layer).toEqual([])
  summary.ready()
  recordBeginCheckout(summary.browser, environment, ['cairo-tour'])
  recordBeginCheckout(summary.browser, environment, ['cairo-tour'])
  const details = documentAt('/checkout/details', summary.local, summary.session)
  recordBeginCheckout(details.browser, environment, ['cairo-tour'])
  await flushBookingFunnel(summary.browser, environment)
  expect(summary.layer).toEqual([{
    event: 'sp_begin_checkout', event_id: expect.stringMatching(/^f_/), items: [{ item_id: 'cairo-tour', quantity: 1 }],
  }])
  expect(details.layer).toEqual([])
})

it('preserves a multi-tour booking lead with a long public slug accepted by the catalogue', async () => {
  const slug = 'alexandriaarchaeologicalmuseumexperience-private-tour'
  expect(() => validateTourWrite({ slug })).not.toThrow()
  const checkout = documentAt('/checkout/details')
  setConsent(checkout.local, true)
  const event = { ...booking, items: [{ ...booking.items[0], item_id: slug }, booking.items[1]] }
  recordBookingReceipt(checkout.browser, environment, { ...receipt, event })
  const confirmation = documentAt('/booking-confirmation?flow=' + 'a'.repeat(32) + '&gtm_debug=x', checkout.local)
  confirmation.boot(); confirmation.ready()
  await flushBookingFunnel(confirmation.browser, environment)
  await flushBookingFunnel(confirmation.browser, environment)
  expect(checkout.layer).toEqual([])
  expect(confirmation.layer).toEqual([{ ...event, ads_eligible: false }])
})

it('tracks the booking funnel through a Preview-decorated private form and a clean public confirmation', async () => {
  vi.stubEnv('NODE_ENV', environment)
  const tour = documentAt('/egypt-tours/cairo-tour')
  setConsent(tour.local, true)
  tour.boot(); tour.ready()
  recordBookNowClick(tour.browser, environment, 'cairo-tour')
  recordCartAddition(tour.browser, environment, 'cairo-tour')
  const summary = documentAt('/checkout', tour.local, tour.session)
  summary.boot(); summary.ready()
  recordBeginCheckout(summary.browser, environment, ['cairo-tour'])

  const details = documentAt('/checkout/details?gtm_debug=x', tour.local, tour.session)
  vi.stubGlobal('window', details.browser)
  expect(bookingMeasurementHeaders(true)).toEqual({ [BOOKING_MEASUREMENT_HEADER]: analyticsGrant })
  recordBeginCheckout(details.browser, environment, ['cairo-tour'])
  const saved = { ...booking, items: [booking.items[0]], value: booking.items[0].price }
  recordBookingReceipt(details.browser, environment, { ...receipt, event: saved })
  const target = '/booking-confirmation?flow=' + 'a'.repeat(32)
  const assign = vi.fn()
  Object.assign(details.browser.location, { assign })
  Object.assign(details.browser, { fetch: vi.fn().mockResolvedValue(Response.json({ ready: true })) })
  expect(await openBookingConfirmation(details.browser, target)).toBe(true)
  expect(assign).toHaveBeenCalledExactlyOnceWith(target)
  expect(details.layer).toEqual([])

  const confirmation = documentAt(target, tour.local, tour.session)
  confirmation.boot(); confirmation.ready()
  await flushBookingFunnel(confirmation.browser, environment)
  await flushBookingFunnel(confirmation.browser, environment)
  expect([...tour.layer, ...summary.layer, ...confirmation.layer].map(entry => (entry as { event: string }).event)).toEqual([
    'sp_book_now_click', 'sp_add_to_cart', 'sp_begin_checkout', 'sp_booking_created',
  ])
  expect(confirmation.layer).toEqual([{ ...saved, ads_eligible: false }])
})

it.each(['?gtm_debug=secret', '?gtm_debug=x&gtm_debug=x', '?gtm_debug=x&token=private', '?gtm_debug=x#private'])(
  'rejects unsafe Preview query data on booking details: %s', suffix => {
    vi.stubEnv('NODE_ENV', environment)
    const details = documentAt('/checkout/details' + suffix)
    setConsent(details.local, true)
    vi.stubGlobal('window', details.browser)
    expect(bookingMeasurementHeaders(true)).toEqual({})
    recordBookingReceipt(details.browser, environment, receipt)
    expect(details.local.getItem(FUNNEL_STORAGE_PREFIX + booking.event_id)).toBeNull()
  },
)

it('records a new checkout start when the visitor returns to the cart before ever opening the form', () => {
  const first = documentAt('/checkout')
  setConsent(first.local, true)
  first.boot(); first.ready()
  recordBeginCheckout(first.browser, environment, ['cairo-tour'])
  expect(first.layer).toHaveLength(1)

  const cart = documentAt('/cart', first.local, first.session)
  resetCheckoutStart(cart.browser)
  expect(cart.layer).toEqual([])

  const second = documentAt('/checkout', first.local, first.session)
  second.boot(); second.ready()
  recordBeginCheckout(second.browser, environment, ['cairo-tour'])
  expect(second.layer).toHaveLength(1)
  expect(second.layer[0]).toMatchObject({ event: 'sp_begin_checkout' })
  expect(second.layer[0]).not.toEqual(first.layer[0])

  const reload = documentAt('/checkout', second.local, second.session)
  reload.boot(); reload.ready()
  recordBeginCheckout(reload.browser, environment, ['cairo-tour'])
  expect(reload.layer).toEqual([])
})

it('counts a new cart departure after returning from an unfinished checkout with the same basket', async () => {
  const cart = documentAt('/cart')
  setConsent(cart.local, true)
  cart.boot(); cart.ready()
  recordBeginCheckout(cart.browser, environment, ['cairo-tour'])

  const summary = documentAt('/checkout', cart.local, cart.session)
  summary.boot(); summary.ready()
  recordBeginCheckout(summary.browser, environment, ['cairo-tour'])
  expect(summary.layer).toEqual([])
  const checkout = documentAt('/checkout/details', cart.local, cart.session)
  recordBeginCheckout(checkout.browser, environment, ['cairo-tour'])
  const reloaded = documentAt('/checkout/details', cart.local, cart.session)
  recordBeginCheckout(reloaded.browser, environment, ['cairo-tour'])
  await flushBookingFunnel(cart.browser, environment)
  expect(cart.layer).toHaveLength(1)

  recordBeginCheckout(cart.browser, environment, ['cairo-tour'])
  recordBeginCheckout(cart.browser, environment, ['cairo-tour'])
  const starts = cart.layer as { event: string; event_id: string }[]
  expect(starts.map(start => start.event)).toEqual(['sp_begin_checkout', 'sp_begin_checkout'])
  expect(starts[0].event_id).not.toBe(starts[1].event_id)
  expect(checkout.layer).toEqual([])
  expect(reloaded.layer).toEqual([])
})

it.each(['/cart?token=private', '/cart#private', '/account'])('does not record checkout intent on %s', path => {
  const cart = documentAt('/cart')
  setConsent(cart.local, true)
  cart.boot(); cart.ready()
  cart.browser.location.href = origin + path
  recordBeginCheckout(cart.browser, environment, ['cairo-tour'])
  expect(cart.layer).toEqual([])
  expect(cart.session.length).toBe(0)
})

it('requires Analytics consent and keeps a consented cart start pending while GTM loads', async () => {
  const cart = documentAt('/cart')
  setConsent(cart.local, false)
  cart.boot()
  recordBeginCheckout(cart.browser, environment, ['cairo-tour'])
  expect(cart.session.length).toBe(0)
  setConsent(cart.local, true)
  cart.boot()
  recordBeginCheckout(cart.browser, environment, ['cairo-tour'])
  expect(cart.layer).toEqual([])
  cart.ready()
  await flushBookingFunnel(cart.browser, environment)
  expect(cart.layer).toEqual([expect.objectContaining({ event: 'sp_begin_checkout' })])
})

it('queues checkout and receipt across refresh and drains them once on a ready public page', async () => {
  const checkout = documentAt('/checkout/details')
  setConsent(checkout.local, true)
  recordBeginCheckout(checkout.browser, environment, ['cairo-tour', 'luxor-tour'])
  const reloaded = documentAt('/checkout/details', checkout.local, checkout.session)
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

it('can drain an existing protected checkout receipt on a consented cart without loading Google on checkout', async () => {
  const checkout = documentAt('/checkout/details'); setConsent(checkout.local, true)
  recordBookingReceipt(checkout.browser, environment, receipt)
  const cart = documentAt('/cart', checkout.local); cart.boot(); cart.ready()
  await flushBookingFunnel(cart.browser, environment)
  await flushBookingFunnel(cart.browser, environment)
  expect(cart.layer).toEqual([analyticsLead])
  expect(checkout.layer).toEqual([])
})

it.each(['analytics', 'both', 'denied', 'withdrawn'] as const)(
  'drains a saved multi-tour booking on its clean confirmation once under %s consent', async choice => {
    const checkout = documentAt('/checkout/details')
    setConsent(checkout.local, choice !== 'denied', choice === 'both' ? marketingGrant : undefined)
    const captured = { ...receipt, grants: { analytics: analyticsGrant, ...(choice === 'both' ? { marketing: marketingGrant } : {}) } }
    recordBeginCheckout(checkout.browser, environment, ['cairo-tour', 'luxor-tour'])
    recordBookingReceipt(checkout.browser, environment, captured)
    if (choice === 'withdrawn') setConsent(checkout.local, false)
    const confirmation = documentAt('/booking-confirmation?flow=' + 'f'.repeat(32), checkout.local)
    confirmation.boot(); confirmation.ready()
    await flushBookingFunnel(confirmation.browser, environment)
    await flushBookingFunnel(confirmation.browser, environment)
    const expected = choice === 'analytics' || choice === 'both' ? [{ ...booking, ads_eligible: choice === 'both' }] : []
    expect(confirmation.layer.filter(entry => (entry as { event?: string }).event === 'sp_booking_created')).toEqual(expected)
    const reload = documentAt('/booking-confirmation?flow=' + 'f'.repeat(32), checkout.local)
    reload.boot(); reload.ready(); await flushBookingFunnel(reload.browser, environment)
    expect(reload.layer).toEqual([])
    expect(checkout.layer).toEqual([])
    expect(JSON.stringify(confirmation.layer)).not.toMatch(/SP-BK|email|phone|token|purchase|flow/)
  },
)

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
  const checkout = documentAt('/checkout/details')
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
  const checkout = documentAt('/checkout/details')
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
  const checkout = documentAt('/checkout/details')
  vi.stubGlobal('window', checkout.browser)
  vi.stubEnv('NODE_ENV', environment)
  expect(bookingMeasurementHeaders(true)).toEqual({})
  setConsent(checkout.local, true)
  expect(bookingMeasurementHeaders(true)).toEqual({ [BOOKING_MEASUREMENT_HEADER]: analyticsGrant })
  expect(bookingMeasurementHeaders(false)).toEqual({})
  for (const path of ['/checkout/details?token=private', '/checkout/details#private', '/booking/private', 'https://staging.example.com/checkout']) {
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
  const checkout = documentAt('/checkout/details')
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
  const checkout = documentAt('/checkout/details')
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
