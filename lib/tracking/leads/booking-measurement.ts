import { MAX_BOOKING_AMOUNT_CENTS } from '../../booking/booking-selection'
import { isTrackingGrant } from '../tracking'

export const BOOKING_MEASUREMENT_HEADER = 'x-sp-booking-measurement'
export const BOOKING_MARKETING_GRANT_HEADER = 'x-sp-booking-marketing-grant'
export type BookingMeasurementGrants = { analytics: string; marketing?: string }

export function bookingMeasurementGrants(analytics: unknown, marketing: unknown): BookingMeasurementGrants | undefined {
  if (!isTrackingGrant(analytics)) return undefined
  return { analytics, ...(isTrackingGrant(marketing) ? { marketing } : {}) }
}

type TourItem = { item_id: string; quantity: 1 }
type BookNowClick = {
  event: 'sp_book_now_click'
  event_id: string
  item_id: string
  placement: 'tour_detail'
}
type CheckoutView = {
  event: 'sp_checkout_view'
  event_id: string
  checkout_page_path: '/checkout'
}
type FunnelIntent = {
  event: 'sp_add_to_cart' | 'sp_begin_checkout'
  event_id: string
  items: TourItem[]
}
export type BookingMeasurement = {
  event: 'sp_booking_created'
  event_id: string
  currency: 'USD'
  value: number
  items: (TourItem & { price: number })[]
}
export type TripRequestMeasurement = { event: 'trip_request_created'; event_id: string }
export const FORM_LEAD_TYPES = ['home_help', 'shared_help', 'contact', 'car_request', 'event_request'] as const
export type FormLeadType = typeof FORM_LEAD_TYPES[number]
export type FormLeadName = 'enquiry_created' | 'car_request_created' | 'event_request_created'
export type FormLeadReceipt = { event: FormLeadName; event_id: string }
export type FormLeadEvent = FormLeadReceipt & { form_type: FormLeadType }
export type BookingFunnelEvent = BookNowClick | CheckoutView | FunnelIntent | BookingMeasurement | TripRequestMeasurement | FormLeadEvent
export const isFunnelLead = (event: BookingFunnelEvent): boolean =>
  event.event === 'sp_booking_created' || event.event === 'trip_request_created' ||
  event.event === 'enquiry_created' || event.event === 'car_request_created' || event.event === 'event_request_created'
export type BookingMeasurementReceipt = { event: BookingMeasurement; grants: BookingMeasurementGrants }

export const isPublicTourId = (id: unknown): id is string =>
  typeof id === 'string' && id.length <= 120 && /^[a-z0-9]{1,32}(?:-[a-z0-9]{1,32})*$/.test(id)

const FUNNEL_INTENT_ID = /^f_[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/

function usdCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  const cents = Math.round(value * 100)
  return cents <= MAX_BOOKING_AMOUNT_CENTS && cents / 100 === value ? cents : null
}

/** Rebuild the allowlisted payload at the API, storage and dataLayer boundaries. */
export function parseBookingFunnelEvent(input: unknown): BookingFunnelEvent | null {
  if (!input || typeof input !== 'object') return null
  const { event, event_id, items, currency, value } = input as Record<string, unknown>
  const { form_type } = input as Record<string, unknown>
  const forms = event === 'enquiry_created' ? ['home_help', 'shared_help', 'contact'] :
    event === 'car_request_created' ? ['car_request'] : event === 'event_request_created' ? ['event_request'] : null
  if (forms) {
    const prefix = event === 'enquiry_created' ? 'enq' : event === 'car_request_created' ? 'car' : 'evt'
    return typeof event_id === 'string' && new RegExp(`^${prefix}_[a-f0-9]{32}$`).test(event_id) &&
      typeof form_type === 'string' && forms.includes(form_type) ? { event, event_id, form_type } as FormLeadEvent : null
  }
  if (event === 'trip_request_created') {
    return typeof event_id === 'string' && /^tr_[a-f0-9]{32}$/.test(event_id) ? { event, event_id } : null
  }
  if (event === 'sp_book_now_click') {
    const { item_id } = input as Record<string, unknown>
    return typeof event_id === 'string' && FUNNEL_INTENT_ID.test(event_id) && isPublicTourId(item_id)
      ? { event, event_id, item_id, placement: 'tour_detail' } : null
  }
  if (event === 'sp_checkout_view') {
    return typeof event_id === 'string' && FUNNEL_INTENT_ID.test(event_id)
      ? { event, event_id, checkout_page_path: '/checkout' } : null
  }
  if (event !== 'sp_add_to_cart' && event !== 'sp_begin_checkout' && event !== 'sp_booking_created') return null
  const idPattern = event === 'sp_booking_created' ? /^bk_[a-f0-9]{32}$/ : FUNNEL_INTENT_ID
  if (typeof event_id !== 'string' || !idPattern.test(event_id) || !Array.isArray(items) ||
      items.length < 1 || items.length > 20 || event === 'sp_add_to_cart' && items.length !== 1) return null

  const tours: TourItem[] = []
  const priced: BookingMeasurement['items'] = []
  let totalCents = 0
  for (const entry of items) {
    if (!entry || typeof entry !== 'object' || !isPublicTourId(entry.item_id) || entry.quantity !== 1) return null
    const item = { item_id: entry.item_id, quantity: 1 } as const
    tours.push(item)
    if (event === 'sp_booking_created') {
      const cents = usdCents(entry.price)
      if (cents === null) return null
      totalCents += cents
      priced.push({ ...item, price: cents / 100 })
    }
  }
  if (event !== 'sp_booking_created') return { event, event_id, items: tours }
  if (currency !== 'USD' || usdCents(value) !== totalCents) return null
  return { event, event_id, currency, value: totalCents / 100, items: priced }
}
