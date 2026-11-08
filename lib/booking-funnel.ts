import { BOOKING_MARKETING_GRANT_HEADER, BOOKING_MEASUREMENT_HEADER, bookingMeasurementGrants, isFunnelLead, parseBookingFunnelEvent, type BookingFunnelEvent, type BookingMeasurementGrants } from './booking-measurement'
import { isProductionTrackingHost, isSafeTrackingUrl } from './tracking'
import { analyticsDataLayer, canCaptureAnalytics, readTrackingConsent, readTrackingGrants } from './tracking-browser'
import { queueBookingFunnelEvent } from './tracking-events'

export const FUNNEL_STORAGE_PREFIX = 'sp-funnel-v1:'
const DELIVERED_PREFIX = 'sp-funnel-delivered-v1:'
const CHECKOUT_KEY = 'sp-funnel-checkout-v1'
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000
type PendingRecord = { event: BookingFunnelEvent; capturedAt: number; grants?: BookingMeasurementGrants }

function isConsentedCheckout(browser: Window, environment: string | undefined): boolean {
  const url = new URL(browser.location.href)
  return url.protocol === 'https:' && isProductionTrackingHost(environment, url.host) &&
    url.pathname === '/checkout' && !url.search && !url.hash && readTrackingConsent(browser).analytics
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

function remember(browser: Window, event: BookingFunnelEvent, grants?: BookingMeasurementGrants) {
  const key = FUNNEL_STORAGE_PREFIX + event.event_id
  const storage = browser.localStorage
  if (storage.getItem(DELIVERED_PREFIX + event.event_id) !== null) return
  const stored = storage.getItem(key)
  const now = Date.now()
  if (stored !== null && (!isFunnelLead(event) || readPendingRecord(key, stored, now))) return
  storage.setItem(key, JSON.stringify({ event, capturedAt: now, grants }))
}

function readPendingRecord(key: string, stored: string, now: number): PendingRecord | null {
  try {
    const record = JSON.parse(stored)
    const event = parseBookingFunnelEvent(record?.event)
    const capturedAt: unknown = record?.capturedAt
    const grants = bookingMeasurementGrants(record?.grants?.analytics, record?.grants?.marketing)
    if (event && key === FUNNEL_STORAGE_PREFIX + event.event_id && typeof capturedAt === 'number' &&
        Number.isFinite(capturedAt) && capturedAt + RETENTION_MS > now &&
        (!isFunnelLead(event) || grants)) return { event, capturedAt, grants }
  } catch { /* Ignore malformed storage records. */ }
  return null
}

export function recordCartAddition(browser: Window, environment: string | undefined, tourSlug: string) {
  try {
    if (!canCaptureAnalytics(browser, environment)) return
    const event = parseBookingFunnelEvent({ event: 'sp_add_to_cart', event_id: 'f_' + browser.crypto.randomUUID(), items: [{ item_id: tourSlug, quantity: 1 }] })
    if (!event) return
    remember(browser, event)
    void flushBookingFunnel(browser, environment)
  } catch { /* Measurement must not affect a successful cart change. */ }
}

export function recordBeginCheckout(browser: Window, environment: string | undefined, tourSlugs: readonly string[]) {
  try {
    if (!isConsentedCheckout(browser, environment)) return
    const basket = JSON.stringify([...tourSlugs].sort())
    const previous = JSON.parse(browser.sessionStorage.getItem(CHECKOUT_KEY) ?? 'null')
    const id = previous?.basket === basket ? previous.id : 'f_' + browser.crypto.randomUUID()
    const event = parseBookingFunnelEvent({ event: 'sp_begin_checkout', event_id: id, items: tourSlugs.map(item_id => ({ item_id, quantity: 1 })) })
    if (!event) return
    browser.sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify({ basket, id }))
    remember(browser, event)
  } catch { /* A tracking storage failure must not block checkout. */ }
}

export function recordBookingReceipt(browser: Window, environment: string | undefined, input: unknown) {
  try {
    if (isConsentedCheckout(browser, environment) && input && typeof input === 'object') {
      const receipt = input as { event?: unknown; grants?: Partial<BookingMeasurementGrants> }
      const event = parseBookingFunnelEvent(receipt.event)
      const grants = bookingMeasurementGrants(receipt.grants?.analytics, receipt.grants?.marketing)
      if (event?.event === 'sp_booking_created' && grants && grants.analytics === readTrackingGrants(browser).analytics) {
        remember(browser, event, grants)
      }
    }
    browser.sessionStorage.removeItem(CHECKOUT_KEY)
  } catch { /* Keep receipt, cart cleanup and attempt recovery independent. */ }
}

/** Capture only consent proofs on the planner; no Google tag or URL is queued here. */
export function tripRequestMeasurementGrants(browser: Window, environment: string | undefined): BookingMeasurementGrants | undefined {
  try {
    const url = new URL(browser.location.href)
    if (url.protocol !== 'https:' || !isProductionTrackingHost(environment, url.host) ||
        url.pathname !== '/make-your-trip' || url.hash || !readTrackingConsent(browser).analytics) return
    const allowed = new Set(['destination', 'tour', 'from', 'to', 'date', 'guests', 'addons', 'step', 'src', 'blog'])
    const seen = new Set<string>()
    const campaign = new URL(url)
    campaign.pathname = '/'
    for (const key of url.searchParams.keys()) {
      if (seen.has(key)) return
      seen.add(key)
      if (allowed.has(key)) campaign.searchParams.delete(key)
    }
    // Reuse the existing strict attribution/debug allowlist for remaining parameters.
    if (!isSafeTrackingUrl(campaign)) return
    const grants = readTrackingGrants(browser)
    return bookingMeasurementGrants(grants.analytics, grants.marketing)
  } catch { return }
}

export function recordTripRequestReceipt(browser: Window, environment: string | undefined, input: unknown, captured?: BookingMeasurementGrants) {
  try {
    const current = tripRequestMeasurementGrants(browser, environment)
    const event = parseBookingFunnelEvent(input)
    const grants = bookingMeasurementGrants(captured?.analytics, captured?.marketing)
    if (event?.event === 'trip_request_created' && grants && current?.analytics === grants.analytics) remember(browser, event, grants)
  } catch { /* An optional measurement failure must never hide a persisted request. */ }
}

function storedKeys(storage: Storage): string[] {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key?.startsWith(FUNNEL_STORAGE_PREFIX)) keys.push(key)
  }
  return keys
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
      if (!consent) { storage.removeItem(key); continue }
      const record = readPendingRecord(key, stored, now)
      if (!record || (isFunnelLead(record.event) && record.grants?.analytics !== currentGrants.analytics)) {
        // A replay in another tab may have refreshed this entry.
        if (storage.getItem(key) === stored) storage.removeItem(key)
        continue
      }
      if (canDispatch) pending.push({ key, ...record })
    }
    const order = { sp_add_to_cart: 0, sp_begin_checkout: 1, sp_booking_created: 2, trip_request_created: 2 }
    pending.sort((a, b) => a.capturedAt - b.capturedAt || order[a.event.event] - order[b.event.event])
    for (const { key, event, grants } of pending) {
      if (storage.getItem(key) === null) continue
      const deliveredKey = DELIVERED_PREFIX + event.event_id
      if (storage.getItem(deliveredKey) !== null) { storage.removeItem(key); continue }
      // Claim before queueing so a replay cannot enqueue the same milestone.
      // A separate marker cannot be overwritten by a concurrent receipt.
      storage.setItem(deliveredKey, '1')
      if (queueBookingFunnelEvent(browser, environment, event, grants)) storage.removeItem(key)
      else storage.removeItem(deliveredKey)
    }
  }
  try {
    const locks = browser.navigator?.locks
    if (locks) await locks.request('sp-booking-funnel', flush)
    else flush()
  } catch { /* Tracking is optional, including when browser storage is unavailable. */ }
}
