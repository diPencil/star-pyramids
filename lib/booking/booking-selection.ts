/** Selection limits shared by the widget, cart and authoritative server validator. */
import type { Tour } from '@/data/types'

/** Match the exact field family displayed by each public booking widget. */
export function bookingAddonCatalog(tour: Tour, dayFallback: readonly {title:string;price?:number}[]) {
  return tour.category==='one-day-tours' ? tour.dayDetail?.addOns??dayFallback : tour.detail?.addOns??[]
}

export const MAX_BOOKING_TRAVELERS = 60
export const MAX_BOOKING_PASSENGERS_PER_TYPE = 50
export const MAX_BOOKING_AMOUNT_CENTS = 9_999_999_999
export const MAX_BOOKING_NOTE_LENGTH = 1000

export function bookingSelectionKey(item: { tourSlug: string; date: string; adults: number; children: number; infants: number; addons: readonly string[] }): string {
  return JSON.stringify([item.tourSlug, item.date || '', item.adults, item.children, item.infants, [...new Set(item.addons)].sort()])
}

export function bookingRequestNotes(notes: string, lines: readonly { title: string; slug: string; requested: readonly string[] }[]): string {
  const requests = lines.filter(line => line.requested.length).map(line => `${line.title.slice(0, 200)} (${line.slug}): ${[...line.requested].sort().join('; ')}`).sort()
  return [notes, ...(requests.length ? ['Requested extras — price and availability NOT confirmed; excluded from the total:', ...requests] : [])].filter(Boolean).join('\n')
}

export function validBookingTravelers(adults: number, children: number, infants: number): boolean {
  return [adults, children, infants].every(value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_BOOKING_PASSENGERS_PER_TYPE)
    && adults >= 1 && adults + children + infants <= MAX_BOOKING_TRAVELERS
}

/** Money must fail closed, rather than silently turning a corrupt rate into zero. */
export function bookingCents(value: number): number {
  const cents = Math.round(value * 100)
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(cents) || cents > MAX_BOOKING_AMOUNT_CENTS) throw Error('The current price cannot be confirmed. Please contact our team.')
  return cents
}

export function bookingAddons(catalog: readonly { title: string; price?: number }[], titles: readonly string[]) {
  const priced: string[] = [], requested: string[] = [], unavailable: string[] = []
  let cents = 0
  for (const title of new Set(titles)) {
    const matches = catalog.filter(row => row.title === title)
    if (matches.length > 1) throw Error('The current price cannot be confirmed. Please contact our team.')
    const match = matches[0]
    if (!match) unavailable.push(title)
    else if (match.price === undefined) requested.push(title)
    else { cents += bookingCents(match.price); priced.push(title) }
  }
  if (cents > MAX_BOOKING_AMOUNT_CENTS) throw Error('The current price cannot be confirmed. Please contact our team.')
  return { priced, requested, unavailable, cents }
}
