import { dayTourTerms, findTour, getBookingTotal } from '@/data/tours'
import type { CartItem } from '@/lib/cart'
import type { Tour } from '@/data/types'
import { localeFromAr, pickLocaleText, type Locale } from '@/lib/locale-config'
import type { BookingPaymentSummary } from '@/lib/payment'

/**
 * Booking contract (Phase 2E: real backend).
 *
 * UI (tour detail -> cart -> checkout -> account/admin) builds a
 * `BookingCheckoutDraft` of SELECTIONS ONLY (slugs, dates, headcounts,
 * add-on titles, contact). The server (`POST /api/bookings`,
 * `lib/server/bookings.ts`) resolves canonical tours/prices, computes
 * totals in integer cents, links ownership from the server session, and
 * issues the official reference (`SP-BK-…`).
 *
 * This module is intentionally neutral (no React, no storage): the client
 * UI and the server service share the lifecycle, labels, and
 * frontend-estimate helpers. The browser cart (localStorage `sp-cart`)
 * remains valid pre-checkout state but is UNTRUSTED input — never a
 * price authority. MySQL is the only booking store.
 *
 * A booking is a trip reservation request pending staff review — never a
 * ticket, and never paid until a real gateway event (Phase 2F). New
 * bookings are always `paymentStatus: 'pending'` (unpaid).
 */

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export type BookingPaymentStatus = 'pending' | 'paid' | 'refunded'

export type BookingActor = 'customer' | 'staff' | 'system'

export type BookingActivity = {
  at: string
  by: BookingActor
  action: string
  note?: string
  /** Staff-only marker. Never set on customer-facing rows. */
  internal?: boolean
}

export type BookingLine = {
  key: string
  tourSlug: string
  title: string
  image: string
  /** Preferred/requested date (YYYY-MM-DD) or '' for an open date. */
  date: string
  adults: number
  children: number
  infants: number
  /** Priced add-on titles (server-resolved). */
  addons: string[]
  addonTotal: number
  adultUnit: number
  childUnit: number
  infantUnit: number
  total: number
}

export type BookingContact = {
  name: string
  email: string
  phone: string
}

/**
 * Server-issued booking view (MySQL-backed). `reference` is the official
 * public reference (`SP-BK-…`); database IDs are never exposed.
 * Amounts are USD base dollars; the UI formats them into the active
 * display currency. The contact block is the historical snapshot taken
 * at checkout.
 */
export type Booking = {
  reference: string
  createdAt: string
  updatedAt: string
  status: BookingStatus
  paymentStatus: BookingPaymentStatus
  /**
   * Derived payment summary from real Payment rows (Phase 2F-A).
   * Present on database-backed views; absent on local preview
   * literals, which must be treated as unpaid.
   */
  paymentSummary?: BookingPaymentSummary
  /** Established payment method, when genuinely known. Omitted in Phase 2E. */
  paymentMethod?: 'card' | 'arrival'
  subtotal: number
  discount: number
  total: number
  currency: 'USD'
  contact: BookingContact
  notes: string
  lines: BookingLine[]
  activity: BookingActivity[]
}

/** Linked registered account info (staff views only, never customer-facing). */
export type BookingAccount = {
  email: string
  name: string
} | null

export type StaffBooking = Booking & {
  account: BookingAccount
}

/**
 * Checkout draft: SELECTIONS ONLY. No prices, totals, statuses,
 * references, user linkage, or payment state — the server owns all of
 * those and rejects them when present.
 */
export type BookingCheckoutLine = {
  tourSlug: string
  date: string
  adults: number
  children: number
  infants: number
  addons: string[]
}

export type BookingCheckoutDraft = {
  lines: BookingCheckoutLine[]
  contact: BookingContact
  notes: string
  currency: 'USD'
  /** Client-generated submission key (idempotency). */
  idempotencyKey: string
}

export const BOOKING_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled']

/** Customer-side cancel is allowed while pending or confirmed. */
export const CUSTOMER_BOOKING_CANCELLABLE_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed']

const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false
}

/** Display strings are stored in English; UI maps known actions to Arabic. */
export function labelForBookingTransition(from: BookingStatus, to: BookingStatus): string {
  switch (to) {
    case 'confirmed': return 'Booking confirmed'
    case 'completed': return 'Booking completed'
    case 'cancelled': return from === 'confirmed' ? 'Booking cancelled' : 'Booking request cancelled'
    default: return 'Status updated'
  }
}

export function bookingStatusLabel(status: BookingStatus, ar: boolean | Locale): string {
  const locale = localeFromAr(ar)
  switch (status) {
    case 'pending': return pickLocaleText(locale, { en: 'Request received', es: 'Solicitud recibida', it: 'Richiesta ricevuta', ar: 'تم استلام الطلب' })
    case 'confirmed': return pickLocaleText(locale, { en: 'Confirmed', es: 'Confirmada', it: 'Confermata', ar: 'مؤكد' })
    case 'completed': return pickLocaleText(locale, { en: 'Completed', es: 'Completada', it: 'Completata', ar: 'مكتمل' })
    case 'cancelled': return pickLocaleText(locale, { en: 'Cancelled', es: 'Cancelada', it: 'Annullata', ar: 'ملغي' })
  }
}

export function bookingPaymentStatusLabel(status: BookingPaymentStatus, ar: boolean | Locale): string {
  const locale = localeFromAr(ar)
  switch (status) {
    case 'pending': return pickLocaleText(locale, { en: 'Unpaid', es: 'Sin pagar', it: 'Non pagata', ar: 'غير مدفوع' })
    case 'paid': return pickLocaleText(locale, { en: 'Paid', es: 'Pagada', it: 'Pagata', ar: 'مدفوع' })
    case 'refunded': return pickLocaleText(locale, { en: 'Refunded', es: 'Reembolsada', it: 'Rimborsata', ar: 'مسترد' })
  }
}

export function bookingActivityLabel(action: string, ar: boolean | Locale): string {
  const locale = localeFromAr(ar)
  if (locale === 'en') return action
  const map: Record<string, { es?: string; it?: string; ar?: string }> = {
    'Booking created': { es: 'Reserva creada', it: 'Prenotazione creata', ar: 'تم إنشاء الحجز' },
    'Booking confirmed': { es: 'Reserva confirmada', it: 'Prenotazione confermata', ar: 'تم تأكيد الحجز' },
    'Booking completed': { es: 'Reserva completada', it: 'Prenotazione completata', ar: 'اكتمل الحجز' },
    'Booking cancelled': { es: 'Reserva cancelada', it: 'Prenotazione annullata', ar: 'تم إلغاء الحجز' },
    'Booking request cancelled': { es: 'Solicitud de reserva cancelada', it: 'Richiesta di prenotazione annullata', ar: 'تم إلغاء طلب الحجز' },
    'Internal note added': { es: 'Nota interna añadida', it: 'Nota interna aggiunta', ar: 'أضيفت ملاحظة داخلية' },
  }
  const entry = map[action]
  if (!entry) return action
  return pickLocaleText(locale, { en: action, ...entry })
}

/**
 * Official reference shape for route params and links.
 * The backend issues `SP-BK-XXXXXX`; older browser-local `SP-…` previews
 * are still routable so they fail honestly (not found) instead of
 * crashing.
 */
const BOOKING_REF_PATTERN = /^(SP-BK-[A-Z0-9]{6}|SP-[A-Z0-9]{10})$/
export const OFFICIAL_BOOKING_REF_PATTERN = /^SP-BK-[A-Z0-9]{6}$/

export function isBookingReference(value: string): boolean {
  return BOOKING_REF_PATTERN.test(value.trim())
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Preferred/requested date only. There is no live availability backend. */
export function isValidPreferredDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export type ResolvedCartLine = {
  item: CartItem
  tour: Tour | null
  /** True when the slug no longer resolves to canonical tour data. Never substitute another tour. */
  stale: boolean
  /** Canonical traveler units for the stored headcount (USD base). */
  adultUnit: number
  childUnit: number
  infantUnit: number
  travelerTotal: number
  /** Stored add-on titles that match a priced canonical add-on. */
  pricedAddons: readonly string[]
  /** Stored add-on titles that are on-request, unknown, or unmatched. Preserved, never charged. */
  onRequestAddons: readonly string[]
  /** Priced add-on subtotal (USD base). On-request services are excluded. */
  addonTotal: number
  /** Canonical line estimate (USD base). Stale lines resolve to 0 and are excluded from totals. */
  canonicalTotal: number
}

function addonCatalog(tour: Tour): readonly { title: string; price?: number }[] {
  const catalog = tour.detail?.addOns ?? tour.dayDetail?.addOns
  if (catalog) return catalog
  return tour.category === 'one-day-tours' ? dayTourTerms.addOns : []
}

/**
 * Revalidate one persisted cart line against canonical tour data.
 * Uses the single pricing engine (`getBookingTotal`); never parses price
 * strings or invents rates. Display estimate only — the backend
 * recalculates authoritatively at checkout.
 */
export function resolveCartLine(item: CartItem): ResolvedCartLine {
  const tour = findTour(item.tourSlug) ?? null
  if (!tour) {
    return {
      item, tour, stale: true,
      adultUnit: 0, childUnit: 0, infantUnit: 0, travelerTotal: 0,
      pricedAddons: [], onRequestAddons: item.addons, addonTotal: 0, canonicalTotal: 0,
    }
  }
  const pricing = getBookingTotal(tour, item.adults, item.children, item.infants)
  const catalog = addonCatalog(tour)
  const pricedAddons: string[] = []
  const onRequestAddons: string[] = []
  for (const title of item.addons) {
    const match = catalog.find((addon) => addon.title === title)
    if (match && typeof match.price === 'number') pricedAddons.push(title)
    else onRequestAddons.push(title)
  }
  const addonTotal = pricedAddons.reduce((sum, title) => {
    const match = catalog.find((addon) => addon.title === title)
    return sum + (match?.price ?? 0)
  }, 0)
  const travelerTotal = pricing.total
  return {
    item, tour, stale: false,
    adultUnit: pricing.adult, childUnit: pricing.child, infantUnit: pricing.infant,
    travelerTotal, pricedAddons, onRequestAddons, addonTotal,
    canonicalTotal: travelerTotal + addonTotal,
  }
}

export type CartEstimate = {
  lines: ResolvedCartLine[]
  validLines: ResolvedCartLine[]
  staleLines: ResolvedCartLine[]
  /** Frontend estimate across valid lines only (USD base). */
  subtotal: number
}

export function estimateCart(items: readonly CartItem[]): CartEstimate {
  const lines = items.map(resolveCartLine)
  const validLines = lines.filter((line) => !line.stale)
  const staleLines = lines.filter((line) => line.stale)
  return { lines, validLines, staleLines, subtotal: validLines.reduce((sum, line) => sum + line.canonicalTotal, 0) }
}

export type ContactErrors = { name?: 'required'; email?: 'required' | 'invalid'; phone?: 'required' | 'invalid' }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Deterministic frontend validation. The backend validates everything again. */
export function validateBookingContact(contact: BookingContact): ContactErrors {
  const errors: ContactErrors = {}
  if (!contact.name.trim()) errors.name = 'required'
  const email = contact.email.trim()
  if (!email) errors.email = 'required'
  else if (email.length > 120 || !EMAIL_PATTERN.test(email)) errors.email = 'invalid'
  const phone = contact.phone.trim()
  if (!phone) errors.phone = 'required'
  else {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 7 || phone.length > 32) errors.phone = 'invalid'
  }
  return errors
}

export function hasContactErrors(errors: ContactErrors): boolean {
  return Boolean(errors.name || errors.email || errors.phone)
}
