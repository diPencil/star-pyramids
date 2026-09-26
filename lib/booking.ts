import { dayTourTerms, findTour, getBookingTotal } from '@/data/tours'
import type { CartItem } from '@/lib/cart'
import type { Tour } from '@/data/types'

/**
 * Phase C booking-request boundary.
 *
 * UI (tour detail -> cart -> checkout) builds a `BookingRequestDraft`.
 * The local prototype adapter (`recordBookingRequestDraft` in
 * `@/lib/customer-account`) turns that draft into a browser-local preview.
 *
 * Later this becomes: UI -> BookingRequestDraft -> real backend service/API,
 * which will resolve canonical slugs, revalidate configuration, recalculate
 * authoritative pricing, check availability, create the database booking,
 * generate the official reference, and process payment. The draft carries no
 * fake backend fields (no database IDs, confirmation IDs, transaction IDs,
 * or server timestamps).
 */

export type BookingContact = {
  name: string
  email: string
  phone: string
}

export type BookingRequestDraft = {
  /** Sanitized cart configurations. Slugs must be canonical tour slugs. */
  lines: CartItem[]
  contact: BookingContact
  notes: string
  /**
   * Frontend USD/base estimate across all lines. Display only.
   * The future backend recalculates the authoritative total.
   *
   * NOTE: there is intentionally no payment/request method field. No payment
   * policy (including pay-on-arrival) has been established, so the draft
   * must not claim one. Payment arrangements are confirmed later, outside
   * this frontend contract.
   */
  estimateUSD: number
  currency: 'USD'
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

/**
 * Collision-resistant local preview reference. Treated as LOCAL/PREVIEW,
 * never as an official STAR PYRAMIDS booking reference.
 */
export function createLocalReference(): string {
  const time = Date.now().toString(36).toUpperCase().slice(-6)
  const random = Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
  return `SP-${time}${random}`
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
 * strings or invents rates. Persisted numeric totals are shown only when the
 * tour can no longer be resolved (stale), and then excluded from totals.
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

/** Deterministic frontend validation. The future backend validates everything again. */
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
    if (digits.length < 7 || phone.length > 24) errors.phone = 'invalid'
  }
  return errors
}

export function hasContactErrors(errors: ContactErrors): boolean {
  return Boolean(errors.name || errors.email || errors.phone)
}
