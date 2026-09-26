'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { CartItem } from '@/lib/cart'
import { createLocalReference, type BookingRequestDraft } from '@/lib/booking'
import { bookings as adminBookings } from '@/components/admin/admin-data'
import { catalogTours } from '@/data/tours'
import { readInquiries, saveInquiry } from '@/lib/admin-store'

export type CustomerBookingStatus = 'request_received' | 'confirmed' | 'completed' | 'cancelled'
export type CustomerPaymentStatus = 'pending' | 'pay_on_arrival' | 'paid' | 'refunded'
/** Where a booking record came from. Local previews must never look like confirmed history. */
export type CustomerBookingOrigin = 'local' | 'demo'

export type CustomerBooking = {
  reference: string
  createdAt: string
  status: CustomerBookingStatus
  paymentStatus: CustomerPaymentStatus
  /**
   * Established payment method, when one is genuinely known (demo fixtures).
   * Omitted for browser-local previews: no payment policy has been
   * established, so local drafts must not claim a payment method.
   */
  paymentMethod?: 'card' | 'arrival'
  total: number
  currency: 'USD'
  contact: { name: string; email: string; phone: string }
  notes: string
  lines: CartItem[]
  /**
   * Where a booking record came from. Optional so older browser-saved
   * previews and unrelated snapshots keep typechecking; the reader backfills
   * it (`SP-` references are local previews, everything else is demo).
   */
  origin?: CustomerBookingOrigin
}

export type CustomerProfile = {
  firstName: string
  lastName: string
  fullName: string
  username: string
  email: string
  avatar: string
  phone: string
  country: string
  dialCode: string
  preferredLanguage: 'en' | 'ar'
  marketingEmails: boolean
  bookingUpdates: boolean
  tripReminders: boolean
  smsUpdates: boolean
  paymentUpdates: boolean
  messageReplies: boolean
  cartReminders: boolean
  savedTripUpdates: boolean
  securityAlerts: boolean
}

const BOOKINGS_KEY = 'sp-customer-bookings-v1'
const FAVORITES_KEY = 'sp-customer-favorites-v1'
const PROFILE_KEY = 'sp-customer-profile-v1'
const accountListeners = new Set<() => void>()
const EMPTY_BOOKINGS: CustomerBooking[] = []
const EMPTY_FAVORITES: string[] = []
let bookingsCache: CustomerBooking[] | null = null
let favoritesCache: string[] | null = null

export const defaultCustomerProfile: CustomerProfile = {
  firstName: 'James',
  lastName: 'Carter',
  fullName: 'James Carter',
  username: 'james_carter',
  email: 'james.carter@example.com',
  avatar: 'https://randomuser.me/api/portraits/men/22.jpg',
  phone: '555 013 2400',
  country: 'US',
  dialCode: '+1',
  preferredLanguage: 'en',
  marketingEmails: false,
  bookingUpdates: true,
  tripReminders: true,
  smsUpdates: false,
  paymentUpdates: true,
  messageReplies: true,
  cartReminders: true,
  savedTripUpdates: false,
  securityAlerts: true,
}

const DEMO_CUSTOMER = 'James Carter'
const DEMO_FAVORITES = ['cairo-and-giza-pyramids', 'luxor-east-west-bank', 'giftun-island-snorkeling-trip']

function matchCatalogTour(title: string) {
  const words = title.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3)
  let best: (typeof catalogTours)[number] | undefined
  let bestScore = 0
  for (const tour of catalogTours) {
    const haystack = `${tour.slug} ${tour.title}`.toLowerCase()
    const score = words.filter((word) => haystack.includes(word)).length
    if (score > bestScore) {
      bestScore = score
      best = tour
    }
  }
  return bestScore >= 2 ? best : undefined
}

function toCustomerBooking(booking: (typeof adminBookings)[number]): CustomerBooking {
  const match = matchCatalogTour(booking.tour)
  const perAdult = booking.guests > 0 ? Math.round(booking.total / booking.guests) : booking.total
  return {
    reference: booking.id,
    createdAt: booking.date,
    status: booking.status === 'confirmed' ? 'confirmed' : booking.status === 'cancelled' ? 'cancelled' : 'request_received',
    paymentStatus: booking.status === 'confirmed' ? 'paid' : 'pending',
    paymentMethod: 'card',
    total: booking.total,
    currency: 'USD',
    contact: { name: booking.customer, email: 'james.carter@example.com', phone: '+1 555 013 2400' },
    notes: '',
    origin: 'demo',
    lines: [{
      key: booking.id,
      tourSlug: match?.slug ?? '',
      title: booking.tour,
      image: match?.image ?? '/egypt-hero.png',
      date: booking.date,
      adults: booking.guests,
      children: 0,
      infants: 0,
      addons: [],
      addonTotal: 0,
      adultUnit: perAdult,
      childUnit: 0,
      infantUnit: 0,
      total: booking.total,
    }],
  }
}

function ensureDemoSeed() {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(BOOKINGS_KEY) === null) {
      const seeded = adminBookings.filter((booking) => booking.customer === DEMO_CUSTOMER).map(toCustomerBooking)
      window.localStorage.setItem(BOOKINGS_KEY, JSON.stringify(seeded))
      bookingsCache = null
    }
    if (window.localStorage.getItem(FAVORITES_KEY) === null) {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(DEMO_FAVORITES))
      favoritesCache = null
    }
    if (readInquiries().length === 0) {
      saveInquiry({
        channel: 'whatsapp',
        name: DEMO_CUSTOMER,
        contact: '',
        message: 'Hi! Is the Giza day tour suitable for kids?',
        tourSlug: 'cairo-and-giza-pyramids',
        tourTitle: 'Cairo & Giza Pyramids Day Tour',
      })
      saveInquiry({
        channel: 'email',
        name: DEMO_CUSTOMER,
        contact: 'james.carter@example.com',
        message: 'Could you confirm hotel pickup in Giza for October 2nd?',
        tourSlug: 'cairo-and-giza-pyramids',
        tourTitle: 'Cairo & Giza Pyramids Day Tour',
      })
    }
  } catch {
    // Demo seed is best-effort only.
  }
}

function emitAccountChange() {
  accountListeners.forEach((listener) => listener())
  window.dispatchEvent(new Event('sp-customer-account'))
}

function subscribe(listener: () => void) {
  accountListeners.add(listener)
  const syncExternalTab = () => {
    bookingsCache = null
    favoritesCache = null
    listener()
  }
  window.addEventListener('storage', syncExternalTab)
  return () => {
    accountListeners.delete(listener)
    window.removeEventListener('storage', syncExternalTab)
  }
}

const BOOKING_STATUSES: readonly CustomerBookingStatus[] = ['request_received', 'confirmed', 'completed', 'cancelled']
const PAYMENT_STATUSES: readonly CustomerPaymentStatus[] = ['pending', 'pay_on_arrival', 'paid', 'refunded']

function safeMoney(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function safeCount(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Booking lines stored with a preview are snapshots: the tour may since have
 * been removed, so an empty slug is kept (rendered without a tour link)
 * instead of crashing or substituting another tour.
 */
function sanitizeBookingLine(value: unknown, fallbackKey: string): CartItem | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<CartItem>
  const title = safeText(raw.title).trim()
  if (!title) return null
  const addons = Array.isArray(raw.addons)
    ? raw.addons.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter((entry) => entry.length > 0).slice(0, 20)
    : []
  const key = safeText(raw.key).trim() || fallbackKey
  return {
    key,
    tourSlug: safeText(raw.tourSlug).trim(),
    title,
    image: safeText(raw.image),
    date: safeText(raw.date),
    adults: safeCount(raw.adults, 1, 50, 1),
    children: safeCount(raw.children, 0, 50, 0),
    infants: safeCount(raw.infants, 0, 50, 0),
    addons,
    addonTotal: safeMoney(raw.addonTotal),
    adultUnit: safeMoney(raw.adultUnit),
    childUnit: safeMoney(raw.childUnit),
    infantUnit: safeMoney(raw.infantUnit),
    total: safeMoney(raw.total),
  }
}

/**
 * Stored previews are UNTRUSTED browser input. Malformed records are dropped;
 * unknown/missing lookups fail safely and never fall back to another record.
 */
export function sanitizeBooking(value: unknown): CustomerBooking | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<CustomerBooking>
  const reference = safeText(raw.reference).trim()
  if (!reference) return null
  const status = BOOKING_STATUSES.includes(raw.status as CustomerBookingStatus) ? raw.status as CustomerBookingStatus : 'request_received'
  const lines = Array.isArray(raw.lines)
    ? raw.lines
      .map((line, index) => sanitizeBookingLine(line, `${reference}-line-${index}`))
      .filter((line): line is CartItem => line !== null)
      .slice(0, 20)
    : []
  const contact = (typeof raw.contact === 'object' && raw.contact !== null ? raw.contact : {}) as Partial<CustomerBooking['contact']>
  const storedOrigin = raw.origin
  const origin: CustomerBookingOrigin = storedOrigin === 'local' || storedOrigin === 'demo'
    ? storedOrigin
    : reference.startsWith('SP-') ? 'local' : 'demo'
  // Local previews never carry a payment promise: older stored previews may
  // still hold 'pay_on_arrival', which was never an established policy.
  const paymentStatus = PAYMENT_STATUSES.includes(raw.paymentStatus as CustomerPaymentStatus) ? raw.paymentStatus as CustomerPaymentStatus : 'pending'
  return {
    reference,
    createdAt: safeText(raw.createdAt),
    status,
    paymentStatus: origin === 'local' && paymentStatus === 'pay_on_arrival' ? 'pending' : paymentStatus,
    paymentMethod: raw.paymentMethod === 'card' ? 'card' : raw.paymentMethod === 'arrival' ? 'arrival' : undefined,
    total: safeMoney(raw.total),
    currency: 'USD',
    contact: { name: safeText(contact.name), email: safeText(contact.email), phone: safeText(contact.phone) },
    notes: safeText(raw.notes),
    lines,
    origin,
  }
}

function readBookings(): CustomerBooking[] {
  if (typeof window === 'undefined') return EMPTY_BOOKINGS
  ensureDemoSeed()
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(BOOKINGS_KEY) || '[]')
    if (!Array.isArray(parsed)) return EMPTY_BOOKINGS
    return parsed
      .map(sanitizeBooking)
      .filter((item): item is CustomerBooking => item !== null)
      .slice(0, 50)
  } catch {
    return EMPTY_BOOKINGS
  }
}

function getBookingsSnapshot() {
  if (bookingsCache === null) bookingsCache = readBookings()
  return bookingsCache
}

export function recordCustomerBooking(booking: CustomerBooking) {
  bookingsCache = [booking, ...getBookingsSnapshot().filter((item) => item.reference !== booking.reference)].slice(0, 50)
  try { window.localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookingsCache)) } catch { /* storage can be unavailable */ }
  emitAccountChange()
}

/**
 * Local prototype adapter: the single checkout boundary.
 *
 * UI -> BookingRequestDraft -> local browser preview (today).
 * UI -> BookingRequestDraft -> real backend service/API (later, without UI changes).
 *
 * The result is a truthful LOCAL request preview: it is stored only in this
 * browser, carries a local-only reference, and is never presented as a
 * confirmed booking, payment, ticket, or email.
 */
export function recordBookingRequestDraft(draft: BookingRequestDraft): CustomerBooking {
  const taken = new Set(getBookingsSnapshot().map((item) => item.reference))
  let reference = createLocalReference()
  while (taken.has(reference)) reference = createLocalReference()
  const booking: CustomerBooking = {
    reference,
    createdAt: new Date().toISOString(),
    status: 'request_received',
    paymentStatus: 'pending',
    total: draft.estimateUSD,
    currency: 'USD',
    contact: { ...draft.contact },
    notes: draft.notes,
    lines: draft.lines.map((line) => ({ ...line, addons: [...line.addons] })),
    origin: 'local',
  }
  recordCustomerBooking(booking)
  return booking
}

export function updateCustomerBooking(reference: string, patch: Partial<CustomerBooking>) {
  bookingsCache = getBookingsSnapshot().map((item) => (item.reference === reference ? { ...item, ...patch } : item))
  try { window.localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookingsCache)) } catch { /* storage can be unavailable */ }
  emitAccountChange()
}

export type MessageDraft = { reference: string; title: string }

const DRAFT_KEY = 'sp-message-draft-v1'

export function saveMessageDraft(draft: MessageDraft) {
  try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch { /* storage can be unavailable */ }
}

export function readMessageDraft(): MessageDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<MessageDraft>
    if (typeof parsed.reference !== 'string') return null
    return { reference: parsed.reference, title: typeof parsed.title === 'string' ? parsed.title : '' }
  } catch {
    return null
  }
}

export function clearMessageDraft() {
  try { window.sessionStorage.removeItem(DRAFT_KEY) } catch { /* storage can be unavailable */ }
}

export function useCustomerBookings() {
  return useSyncExternalStore(subscribe, getBookingsSnapshot, () => EMPTY_BOOKINGS)
}

function readFavorites(): string[] {
  if (typeof window === 'undefined') return EMPTY_FAVORITES
  ensureDemoSeed()
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((slug): slug is string => typeof slug === 'string').slice(0, 100) : EMPTY_FAVORITES
  } catch {
    return EMPTY_FAVORITES
  }
}

function getFavoritesSnapshot() {
  if (favoritesCache === null) favoritesCache = readFavorites()
  return favoritesCache
}

export function toggleCustomerFavorite(slug: string) {
  const current = getFavoritesSnapshot()
  favoritesCache = current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current]
  try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesCache)) } catch { /* storage can be unavailable */ }
  emitAccountChange()
}

export function useCustomerFavorites() {
  const slugs = useSyncExternalStore(subscribe, getFavoritesSnapshot, () => EMPTY_FAVORITES)
  return { slugs, has: (slug: string) => slugs.includes(slug), toggle: toggleCustomerFavorite }
}

export function readCustomerProfile(): CustomerProfile {
  if (typeof window === 'undefined') return defaultCustomerProfile
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFILE_KEY) || '{}') as Partial<CustomerProfile>
    const oldParts = (parsed.fullName || '').trim().split(/\s+/).filter(Boolean)
    const firstName = parsed.firstName || oldParts[0] || defaultCustomerProfile.firstName
    const lastName = parsed.lastName || oldParts.slice(1).join(' ') || defaultCustomerProfile.lastName
    const dialCode = parsed.dialCode || defaultCustomerProfile.dialCode
    const storedPhone = parsed.phone || defaultCustomerProfile.phone
    const phone = storedPhone.startsWith(dialCode) ? storedPhone.slice(dialCode.length).trimStart() : storedPhone
    return { ...defaultCustomerProfile, ...parsed, firstName, lastName, fullName: `${firstName} ${lastName}`.trim(), dialCode, phone, securityAlerts: true }
  } catch {
    return defaultCustomerProfile
  }
}

export function saveCustomerProfile(profile: CustomerProfile) {
  const normalized = { ...profile, fullName: `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim(), securityAlerts: true }
  try { window.localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized)) } catch { /* storage can be unavailable */ }
  emitAccountChange()
}

export function useCustomerProfile() {
  const [profile, setProfile] = useState<CustomerProfile>(defaultCustomerProfile)
  useEffect(() => {
    const sync = () => setProfile(readCustomerProfile())
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('sp-customer-account', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('sp-customer-account', sync)
    }
  }, [])
  return profile
}
