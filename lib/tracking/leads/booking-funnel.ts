import { CHECKOUT_DETAILS_PATH } from '../../booking/booking-confirmation'
import { BOOKING_MARKETING_GRANT_HEADER, BOOKING_MEASUREMENT_HEADER, bookingMeasurementGrants, isFunnelLead, parseBookingFunnelEvent, type BookingFunnelEvent, type BookingMeasurementGrants } from './booking-measurement'
import { hasOnlyTagAssistantQuery, isProductionTrackingHost, isSafeTrackingUrl } from '../tracking'
import { analyticsDataLayer, canCaptureAnalytics, readTrackingConsent, readTrackingGrants } from '../tracking-browser'
import { enqueueBookingFunnelEvent, queueBookingFunnelEvent } from '../tracking-events'
import { reportBookingMeasurement } from './booking-diagnostics'
import { claimBookingEnqueue } from './booking-enqueue-claim'

export const FUNNEL_STORAGE_PREFIX = 'sp-funnel-v1:'
const DELIVERED_PREFIX = 'sp-funnel-delivered-v1:'
const CHECKOUT_KEY = 'sp-funnel-checkout-v1'
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const FUNNEL_CLICK_RETENTION_MS = 15 * 60 * 1000
type PendingRecord = { event: BookingFunnelEvent; capturedAt: number; grants: BookingMeasurementGrants }

function isConsentedCheckout(browser: Window, environment: string | undefined): boolean {
  const url = new URL(browser.location.href)
  // Preview can add its debug flag to a direct visit. Only the local capture
  // is eligible here; the details document itself never initializes GTM.
  return url.protocol === 'https:' && isProductionTrackingHost(environment, url.host) &&
    url.pathname === CHECKOUT_DETAILS_PATH && !url.hash && hasOnlyTagAssistantQuery(url.searchParams) && readTrackingConsent(browser).analytics
}

export function bookingMeasurementHeaders(enabled: boolean): Record<string, string> {
  if (!enabled || !isConsentedCheckout(window, process.env.NODE_ENV)) return {}
  const grants = readTrackingGrants(window)
  if (!grants.analytics) return {}
  return {
    [BOOKING_MEASUREMENT_HEADER]: grants.analytics,
    ...(grants.marketing ? { [BOOKING_MARKETING_GRANT_HEADER]: grants.marketing } : {}),
  }
}

function remember(browser: Window, event: BookingFunnelEvent, grants: BookingMeasurementGrants) {
  const key = FUNNEL_STORAGE_PREFIX + event.event_id
  const storage = browser.localStorage
  if (storage.getItem(DELIVERED_PREFIX + event.event_id) !== null) return 'already_enqueued'
  const stored = storage.getItem(key)
  const now = Date.now()
  if (stored !== null) {
    const previous = readPendingRecord(key, stored, now)
    if (event.event === 'sp_begin_checkout') {
      if (previous?.grants.analytics === grants.analytics) return 'already_queued'
    } else if (!isFunnelLead(event) || previous) {
      return previous?.grants.analytics === grants.analytics ? 'already_queued' : 'ineligible'
    }
  }
  const pending = JSON.stringify({ event, capturedAt: now, grants })
  storage.setItem(key, pending)
  return storage.getItem(key) === pending ? 'queued' : 'storage_failed'
}

function readPendingRecord(key: string, stored: string, now: number): PendingRecord | null {
  try {
    const record = JSON.parse(stored)
    const event = parseBookingFunnelEvent(record?.event)
    const capturedAt: unknown = record?.capturedAt
    const grants = bookingMeasurementGrants(record?.grants?.analytics, record?.grants?.marketing)
    if (event && grants && key === FUNNEL_STORAGE_PREFIX + event.event_id && typeof capturedAt === 'number' && Number.isFinite(capturedAt)) {
      const retention = event.event === 'sp_book_now_click' || event.event === 'sp_checkout_continue' ? FUNNEL_CLICK_RETENTION_MS : RETENTION_MS
      if (capturedAt <= now && capturedAt + retention > now) return { event, capturedAt, grants }
    }
  } catch { /* Ignore malformed storage records. */ }
  return null
}

export function recordBookNowClick(browser: Window, environment: string | undefined, tourSlug: string) {
  try {
    if (!canCaptureAnalytics(browser, environment)) return
    const analytics = readTrackingGrants(browser).analytics
    if (!analytics) return
    const event = parseBookingFunnelEvent({ event: 'sp_book_now_click', event_id: 'f_' + browser.crypto.randomUUID(), item_id: tourSlug })
    if (!event) return
    const grants = { analytics }
    if (analyticsDataLayer(browser, environment)) {
      queueBookingFunnelEvent(browser, environment, event, grants)
      return
    }
    // The cart can be a fresh document while GTM is still starting.
    remember(browser, event, grants)
  } catch { /* Measurement must never interfere with booking. */ }
}

export function recordCheckoutContinue(browser: Window, environment: string | undefined) {
  try {
    if (!/^\/checkout\/?$/.test(new URL(browser.location.href).pathname) || !canCaptureAnalytics(browser, environment)) return
    const analytics = readTrackingGrants(browser).analytics
    if (!analytics) return
    const event = { event: 'sp_checkout_continue', event_id: 'f_' + browser.crypto.randomUUID() } as const
    const grants = { analytics }
    // The native details link can unload this document before GTM is ready.
    if (!queueBookingFunnelEvent(browser, environment, event, grants)) remember(browser, event, grants)
  } catch { /* Measurement must not delay or interrupt checkout navigation. */ }
}

export function recordCartAddition(browser: Window, environment: string | undefined, tourSlug: string) {
  try {
    if (!canCaptureAnalytics(browser, environment)) return
    const analytics = readTrackingGrants(browser).analytics
    if (!analytics) return
    const event = parseBookingFunnelEvent({ event: 'sp_add_to_cart', event_id: 'f_' + browser.crypto.randomUUID(), items: [{ item_id: tourSlug, quantity: 1 }] })
    if (!event) return
    remember(browser, event, { analytics })
    void flushBookingFunnel(browser, environment)
  } catch { /* Measurement must not affect a successful cart change. */ }
}

export function resetCheckoutStart(browser: Window) {
  try { browser.sessionStorage.removeItem(CHECKOUT_KEY) } catch { /* Checkout navigation still proceeds. */ }
}

export function recordBeginCheckout(browser: Window, environment: string | undefined, tourSlugs: readonly string[]) {
  try {
    const fromPublicStep = /^\/(cart|checkout)\/?$/.test(new URL(browser.location.href).pathname)
    if (fromPublicStep ? !canCaptureAnalytics(browser, environment) : !isConsentedCheckout(browser, environment)) return
    const analytics = readTrackingGrants(browser).analytics
    if (!analytics) return
    const basket = JSON.stringify([...tourSlugs].sort())
    const previous = JSON.parse(browser.sessionStorage.getItem(CHECKOUT_KEY) ?? 'null')
    // The details form reuses the public step's intent across hydration and
    // reload. Returning to the public step starts another attempt.
    const reuse = previous?.basket === basket && (!fromPublicStep || previous.entered !== true)
    const id = reuse ? previous.id : 'f_' + browser.crypto.randomUUID()
    const event = parseBookingFunnelEvent({ event: 'sp_begin_checkout', event_id: id, items: tourSlugs.map(item_id => ({ item_id, quantity: 1 })) })
    if (!event) return
    browser.sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify({ basket, id, entered: !fromPublicStep }))
    const grants = { analytics }
    remember(browser, event, grants)
    if (fromPublicStep && analyticsDataLayer(browser, environment)) {
      // The summary can dispatch immediately once the existing container is ready.
      dispatchPendingEvent(browser, environment, FUNNEL_STORAGE_PREFIX + id, event, grants)
    }
  } catch { /* A tracking storage failure must not block checkout. */ }
}

export function recordBookingReceipt(browser: Window, environment: string | undefined, input: unknown, enabled = true) {
  const report = (status: Parameters<typeof reportBookingMeasurement<'capture'>>[2]) => reportBookingMeasurement(browser, 'capture', status)
  if (!enabled) return report('disabled')
  try {
    if (!isConsentedCheckout(browser, environment)) return report('ineligible')
    if (!input || typeof input !== 'object') return report('invalid_receipt')
    const receipt = input as { event?: unknown; grants?: Partial<BookingMeasurementGrants> }
    const event = parseBookingFunnelEvent(receipt.event)
    const grants = bookingMeasurementGrants(receipt.grants?.analytics, receipt.grants?.marketing)
    if (event?.event !== 'sp_booking_created' || !grants) return report('invalid_receipt')
    if (grants.analytics !== readTrackingGrants(browser).analytics) return report('ineligible')
    report(remember(browser, event, grants))
  } catch { report('storage_failed') }
  finally { resetCheckoutStart(browser) }
}

/** Capture consent proofs only; planner fields never enter a measurement payload. */
export function tripRequestMeasurementGrants(browser: Window, environment: string | undefined): BookingMeasurementGrants | undefined {
  try {
    const url = new URL(browser.location.href)
    if (url.protocol !== 'https:' || !isProductionTrackingHost(environment, url.host) ||
        url.pathname !== '/make-your-trip' || url.hash || !readTrackingConsent(browser).analytics) return
    if (!isSafeTrackingUrl(url)) return
    const grants = readTrackingGrants(browser)
    return bookingMeasurementGrants(grants.analytics, grants.marketing)
  } catch { return }
}

export function recordTripRequestReceipt(browser: Window, environment: string | undefined, input: unknown, captured?: BookingMeasurementGrants) {
  try {
    const current = tripRequestMeasurementGrants(browser, environment)
    const event = parseBookingFunnelEvent(input)
    const grants = bookingMeasurementGrants(captured?.analytics, captured?.marketing)
    if (event?.event === 'trip_request_created' && grants && current?.analytics === grants.analytics) {
      remember(browser, event, grants)
      // A successful request must not depend on a later catalogue visit.
      // If GTM is still loading, SiteMeasurement drains the same queue on ready.
      void flushBookingFunnel(browser, environment)
    }
  } catch { /* An optional measurement failure must never hide a persisted request. */ }
}

export function formLeadMeasurementGrants(browser: Window, environment: string | undefined): BookingMeasurementGrants | undefined {
  try {
    const url = new URL(browser.location.href)
    if (url.protocol !== 'https:' || !isProductionTrackingHost(environment, url.host) || !readTrackingConsent(browser).analytics) return
    // Free-text transfer addresses stay outside every Google document. Only
    // the local receipt may be captured here, for a later safe-page drain.
    if (url.pathname === '/rent-car/request') {
      for (const key of ['pickup', 'dropoff']) {
        if (url.searchParams.getAll(key).length > 1) return
        url.searchParams.delete(key)
      }
    }
    if (!isSafeTrackingUrl(url)) return
    const grants = readTrackingGrants(browser)
    return bookingMeasurementGrants(grants.analytics, grants.marketing)
  } catch { return }
}

export function recordFormLeadReceipt(browser: Window, environment: string | undefined, input: unknown, captured?: BookingMeasurementGrants) {
  try {
    const current = formLeadMeasurementGrants(browser, environment)
    const event = parseBookingFunnelEvent(input)
    const grants = bookingMeasurementGrants(captured?.analytics, captured?.marketing)
    if (event && 'form_type' in event && grants && current?.analytics === grants.analytics) {
      remember(browser, event, grants)
      void flushBookingFunnel(browser, environment)
    }
  } catch { /* Optional measurement cannot affect a saved form. */ }
}

function storedKeys(storage: Storage): string[] {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key?.startsWith(FUNNEL_STORAGE_PREFIX)) keys.push(key)
  }
  return keys
}

function dispatchPendingEvent(browser: Window, environment: string | undefined, key: string, event: BookingFunnelEvent, grants: BookingMeasurementGrants) {
  const storage = browser.localStorage
  if (storage.getItem(key) === null) return
  const deliveredKey = DELIVERED_PREFIX + event.event_id
  if (storage.getItem(deliveredKey) !== null) {
    storage.removeItem(key)
    return
  }
  // Claim before queueing so the private checkout and later drains reuse the same milestone.
  storage.setItem(deliveredKey, '1')
  if (queueBookingFunnelEvent(browser, environment, event, grants)) storage.removeItem(key)
  else storage.removeItem(deliveredKey)
}

async function dispatchPendingBooking(browser: Window, environment: string | undefined, key: string, eventId: string) {
  const storage = browser.localStorage
  const marker = DELIVERED_PREFIX + eventId
  // Keep legacy markers. Their original format cannot distinguish an enqueue from an interrupted claim.
  const result = storage.getItem(marker) !== null ? 'already_enqueued' : await claimBookingEnqueue(browser, eventId, () => {
    const stored = storage.getItem(key)
    if (storage.getItem(marker) !== null) return 'already_enqueued'
    const record = stored && readPendingRecord(key, stored, Date.now())
    if (!record || record.event.event !== 'sp_booking_created') return 'ineligible'
    const status = enqueueBookingFunnelEvent(browser, environment, record.event, record.grants)
    if (status === 'enqueued') {
      // A completed push can also be recognized if the transaction later aborts.
      try { storage.setItem(marker, '1') } catch { /* The IndexedDB transaction can still commit. */ }
    }
    return status
  })
  reportBookingMeasurement(browser, 'dispatch', result)
  if (result === 'enqueued' || result === 'already_enqueued') storage.removeItem(key)
}

export function discardPendingBookingFunnel(browser: Window, environment: string | undefined) {
  const url = new URL(browser.location.href)
  if (url.protocol !== 'https:' || !isProductionTrackingHost(environment, url.host)) return
  try {
    const storage = browser.localStorage
    for (const key of storedKeys(storage)) storage.removeItem(key)
  } catch { /* Consent still blocks dispatch if storage cannot be cleared. */ }
}

export async function flushBookingFunnel(browser: Window, environment: string | undefined) {
  const url = new URL(browser.location.href)
  if (url.protocol !== 'https:' || !isProductionTrackingHost(environment, url.host)) return
  const bookings: { key: string; eventId: string }[] = []
  const flush = () => {
    const consent = readTrackingConsent(browser).analytics
    const currentGrants = readTrackingGrants(browser)
    const canDispatch = consent && Boolean(analyticsDataLayer(browser, environment))
    const storage = browser.localStorage
    const pending: (PendingRecord & { key: string })[] = []
    const now = Date.now()
    for (const key of storedKeys(storage)) {
      const stored = storage.getItem(key)
      if (!stored) continue
      const record = readPendingRecord(key, stored, now)
      if (!consent || !record || record.grants.analytics !== currentGrants.analytics) {
        // A replay in another tab may have refreshed this entry.
        if (storage.getItem(key) === stored) {
          storage.removeItem(key)
          if (key.startsWith(FUNNEL_STORAGE_PREFIX + 'bk_')) reportBookingMeasurement(browser, 'drain', 'discarded')
        }
        continue
      }
      if (canDispatch) pending.push({ key, ...record })
      else if (record.event.event === 'sp_booking_created') reportBookingMeasurement(browser, 'drain', 'waiting_for_gtm')
    }
    const order = { sp_book_now_click: 0, sp_add_to_cart: 1, sp_begin_checkout: 2, sp_checkout_continue: 3, sp_booking_created: 4, trip_request_created: 4, enquiry_created: 4, car_request_created: 4, event_request_created: 4 }
    pending.sort((a, b) => a.capturedAt - b.capturedAt || order[a.event.event] - order[b.event.event])
    for (const { key, event, grants } of pending) {
      if (event.event === 'sp_booking_created') bookings.push({ key, eventId: event.event_id })
      else dispatchPendingEvent(browser, environment, key, event, grants)
    }
  }
  try {
    const locks = browser.navigator?.locks
    if (locks) await locks.request('sp-booking-funnel', flush)
    else flush()
    // IndexedDB serializes booking claims independently of the shared funnel lock.
    for (const { key, eventId } of bookings) await dispatchPendingBooking(browser, environment, key, eventId)
  } catch { reportBookingMeasurement(browser, 'drain', 'storage_failed') }
}
