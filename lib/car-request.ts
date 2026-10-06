import type { Currency } from '@/components/locale'
import { localeFromAr, pickLocaleText, type Locale } from '@/lib/locale-config'

/**
 * Car-request contract (Phase 2C: real backend).
 *
 * UI (`/rent-car/request`, `/account/car-requests`, `/admin/car-requests`)
 * builds a `CarRequestDraft`, validates it with the deterministic helpers
 * below, then talks to the server API (`POST /api/car-requests`,
 * `/api/account/car-requests/*`, `/api/admin/car-requests/*`), which
 * revalidates everything, links ownership from the server session, and
 * issues the official reference (`SP-CR-…`).
 *
 * This module is intentionally neutral (no `'use client'`, no React, no
 * storage): the client UI and `lib/server/car-requests.ts` share the
 * lifecycle, labels, and validation-shape helpers. The browser never stores
 * car requests; MySQL is the only store.
 *
 * A car request is NOT a cart item, booking, or payment. It must never be
 * inserted into the Trip Cart. Requested vehicle is a customer preference
 * only: it never confirms availability, assignment, rate, or booking.
 */

export const CAR_LOCATION_MAX = 160
export const CAR_NOTE_MAX = 1000
export const CAR_NAME_MAX = 80
export const CAR_EMAIL_MAX = 120
export const CAR_PHONE_MAX = 24
export const CAR_PASSENGER_MAX = 50

export type CarTripType = 'One Way' | 'Round Trip'

export type CarRequestContact = {
  fullName: string
  email: string
  /** Phone number as typed, e.g. "+20 101 234 5678". */
  phone: string
}

export type CarRequestDraft = {
  /** Canonical or admin-custom vehicle slug. Never a fabricated vehicle. */
  vehicleSlug: string
  /** Required: 'One Way' needs pickup date only; 'Round Trip' needs both. */
  tripType: CarTripType | ''
  pickup: string
  dropoff: string
  /** Preferred/requested dates (YYYY-MM-DD). No live availability backend. */
  preferredPickupDate: string
  /** '' unless tripType is 'Round Trip'. */
  preferredReturnDate: string
  passengers: number
  notes: string
  contact: CarRequestContact
  currency: Currency
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/

/**
 * Official + legacy-tolerant reference shape for route params and links.
 * The backend issues `SP-CR-XXXXXX`; older browser-local `SP-…` refs are
 * still routable so they fail honestly (not found) instead of crashing.
 */
const CAR_REF_PATTERN = /^SP-(CR-)?[A-Z0-9]{6,12}$/
export const OFFICIAL_CAR_REF_PATTERN = /^SP-CR-[A-Z0-9]{6}$/

export function isCarReference(value: string): boolean {
  return CAR_REF_PATTERN.test(value.trim())
}

/** Preferred/requested date only. There is no live availability backend. */
export function isValidCarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** True when the preferred date is before today (local calendar day). */
export function isPastCarDate(value: string): boolean {
  if (!isValidCarDate(value)) return false
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return value < today
}

export type CarFieldErrors = Partial<Record<
  'vehicle' | 'tripType' | 'pickup' | 'dropoff' | 'pickupDate' | 'returnDate' | 'passengers' | 'name' | 'email' | 'phone' | 'notes',
  'required' | 'invalid'
>>

function safeCount(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function safeText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, max)
}

function safeSlug(value: unknown): string {
  if (typeof value !== 'string') return ''
  const slug = value.trim().slice(0, 80)
  return SLUG_PATTERN.test(slug) ? slug : ''
}

/** Deterministic frontend validation. The backend validates everything again. */
export function validateCarRequest(draft: CarRequestDraft): CarFieldErrors {
  const errors: CarFieldErrors = {}

  if (!draft.vehicleSlug) errors.vehicle = 'required'

  if (draft.tripType !== 'One Way' && draft.tripType !== 'Round Trip') errors.tripType = 'required'

  if (!draft.pickup.trim()) errors.pickup = 'required'
  else if (draft.pickup.trim().length > CAR_LOCATION_MAX) errors.pickup = 'invalid'

  if (!draft.dropoff.trim()) errors.dropoff = 'required'
  else if (draft.dropoff.trim().length > CAR_LOCATION_MAX) errors.dropoff = 'invalid'

  if (!draft.preferredPickupDate) errors.pickupDate = 'required'
  else if (!isValidCarDate(draft.preferredPickupDate) || isPastCarDate(draft.preferredPickupDate)) errors.pickupDate = 'invalid'

  if (draft.tripType === 'Round Trip') {
    if (!draft.preferredReturnDate) errors.returnDate = 'required'
    else if (!isValidCarDate(draft.preferredReturnDate) || isPastCarDate(draft.preferredReturnDate)) errors.returnDate = 'invalid'
    else if (!errors.pickupDate && draft.preferredReturnDate < draft.preferredPickupDate) errors.returnDate = 'invalid'
  }

  const { passengers } = draft
  if (!Number.isSafeInteger(passengers) || passengers < 1 || passengers > CAR_PASSENGER_MAX) errors.passengers = 'invalid'

  const name = draft.contact.fullName.trim()
  if (!name) errors.name = 'required'
  else if (name.length < 2 || /^\d+$/.test(name.replace(/[\s.'-]+/g, ''))) errors.name = 'invalid'

  const email = draft.contact.email.trim()
  if (!email) errors.email = 'required'
  else if (email.length > CAR_EMAIL_MAX || !EMAIL_PATTERN.test(email)) errors.email = 'invalid'

  const phone = draft.contact.phone.trim()
  if (!phone) errors.phone = 'required'
  else {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 7 || phone.length > CAR_PHONE_MAX) errors.phone = 'invalid'
  }

  if (draft.notes.length > CAR_NOTE_MAX) errors.notes = 'invalid'

  return errors
}

export function hasCarErrors(errors: CarFieldErrors): boolean {
  return Object.keys(errors).length > 0
}

/**
 * Untrusted-input shaping for drafts (edit prefill). Malformed input is
 * dropped (null) so stale data fails safely instead of crashing or
 * substituting unrelated values.
 */
export function sanitizeCarDraft(value: unknown): CarRequestDraft | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<CarRequestDraft>
  const contact = (typeof raw.contact === 'object' && raw.contact !== null ? raw.contact : {}) as Partial<CarRequestContact>
  const tripType: CarRequestDraft['tripType'] = raw.tripType === 'One Way' || raw.tripType === 'Round Trip' ? raw.tripType : ''
  const currency: Currency = raw.currency === 'EUR' || raw.currency === 'EGP' ? raw.currency : 'USD'
  const preferredPickupDate = typeof raw.preferredPickupDate === 'string' && (raw.preferredPickupDate === '' || isValidCarDate(raw.preferredPickupDate))
    ? raw.preferredPickupDate
    : ''
  const preferredReturnDate = tripType === 'Round Trip' && typeof raw.preferredReturnDate === 'string' && (raw.preferredReturnDate === '' || isValidCarDate(raw.preferredReturnDate))
    ? raw.preferredReturnDate
    : ''
  return {
    vehicleSlug: safeSlug(raw.vehicleSlug),
    tripType,
    pickup: safeText(raw.pickup, CAR_LOCATION_MAX),
    dropoff: safeText(raw.dropoff, CAR_LOCATION_MAX),
    preferredPickupDate,
    preferredReturnDate,
    passengers: safeCount(raw.passengers, 1, CAR_PASSENGER_MAX, 1),
    notes: safeText(raw.notes, CAR_NOTE_MAX),
    contact: {
      fullName: safeText(contact.fullName, CAR_NAME_MAX),
      email: safeText(contact.email, CAR_EMAIL_MAX),
      phone: safeText(contact.phone, CAR_PHONE_MAX),
    },
    currency,
  }
}

export type CarRequestStatus = 'new' | 'reviewing' | 'confirmed' | 'cancelled'

export type CarRequestActor = 'customer' | 'staff' | 'system'

export type CarRequestActivity = {
  at: string
  by: CarRequestActor
  action: string
  note?: string
  /** Staff-only marker. Never set on customer-facing rows. */
  internal?: boolean
}

export type CarRequestContactView = {
  name: string
  email: string
  phone: string
}

/**
 * Server-issued request view (MySQL-backed). `reference` is the official
 * public reference (`SP-CR-…`); database IDs are never exposed. The contact
 * block is the historical snapshot taken at submit/edit time.
 * `assignedVehicleSlug` is the staff-assigned fleet vehicle, if any.
 */
export type CarRequest = {
  reference: string
  vehicleSlug: string
  assignedVehicleSlug: string
  tripType: CarTripType
  pickup: string
  dropoff: string
  preferredPickupDate: string
  preferredReturnDate: string
  passengers: number
  contact: CarRequestContactView
  notes: string
  status: CarRequestStatus
  createdAt: string
  updatedAt: string
  activity: CarRequestActivity[]
}

/** Linked registered account info (staff views only, never customer-facing). */
export type CarRequestAccount = {
  email: string
  name: string
} | null

export type StaffCarRequest = CarRequest & {
  account: CarRequestAccount
}

export const CAR_REQUEST_STATUSES: readonly CarRequestStatus[] = ['new', 'reviewing', 'confirmed', 'cancelled']

/** Customer-side edit/cancel is allowed only while new or under review. */
export const CUSTOMER_CAR_EDITABLE_STATUSES: readonly CarRequestStatus[] = ['new', 'reviewing']

const CAR_TRANSITIONS: Record<CarRequestStatus, CarRequestStatus[]> = {
  new: ['reviewing', 'cancelled'],
  reviewing: ['confirmed', 'cancelled'],
  confirmed: [],
  cancelled: ['reviewing'],
}

export function canTransitionCarRequest(from: CarRequestStatus, to: CarRequestStatus): boolean {
  return CAR_TRANSITIONS[from]?.includes(to) ?? false
}

/** Display strings are stored in English; UI maps known actions to Arabic. */
export function labelForCarTransition(from: CarRequestStatus, to: CarRequestStatus): string {
  if (to === 'reviewing' && from === 'cancelled') return 'Reopened for review'
  switch (to) {
    case 'reviewing': return 'Review started'
    case 'confirmed': return 'Request confirmed'
    case 'cancelled': return 'Request cancelled'
    default: return 'Status updated'
  }
}

export function carRequestStatusLabel(status: CarRequestStatus, ar: boolean | Locale): string {
  const locale = localeFromAr(ar)
  switch (status) {
    case 'new': return pickLocaleText(locale, { en: 'New', es: 'Nueva', it: 'Nuova', ar: 'جديد' })
    case 'reviewing': return pickLocaleText(locale, { en: 'Reviewing', es: 'En revisión', it: 'In revisione', ar: 'قيد المراجعة' })
    case 'confirmed': return pickLocaleText(locale, { en: 'Confirmed', es: 'Confirmada', it: 'Confermata', ar: 'مؤكد' })
    case 'cancelled': return pickLocaleText(locale, { en: 'Cancelled', es: 'Cancelada', it: 'Annullata', ar: 'ملغي' })
  }
}

/**
 * Canonical fleet display title for a vehicle slug. Source of truth is the
 * caller's fleet list (base catalogue plus admin overrides); an unknown or
 * removed slug falls back to the stored slug verbatim — never a fabricated
 * capitalization.
 */
export function fleetVehicleTitle(fleet: { slug: string; title: string }[], slug: string): string {
  return fleet.find((car) => car.slug === slug)?.title ?? slug
}

export function carActivityLabel(action: string, ar: boolean | Locale): string {
  const locale = localeFromAr(ar)
  if (locale === 'en') return action
  const map: Record<string, { es?: string; it?: string; ar?: string }> = {
    'Request created': { es: 'Solicitud creada', it: 'Richiesta creata', ar: 'تم إنشاء الطلب' },
    'Request updated': { es: 'Solicitud actualizada', it: 'Richiesta aggiornata', ar: 'تم تحديث الطلب' },
    'Review started': { es: 'Revisión iniciada', it: 'Revisione avviata', ar: 'بدأت المراجعة' },
    'Request confirmed': { es: 'Solicitud confirmada', it: 'Richiesta confermata', ar: 'تم تأكيد الطلب' },
    'Request cancelled': { es: 'Solicitud cancelada', it: 'Richiesta annullata', ar: 'تم إلغاء الطلب' },
    'Reopened for review': { es: 'Reabierta para revisión', it: 'Riaperto per la revisione', ar: 'أعيد فتحه للمراجعة' },
    'Assigned vehicle updated': { es: 'Vehículo asignado actualizado', it: 'Veicolo assegnato aggiornato', ar: 'تم تحديث المركبة المخصصة' },
    'Internal note added': { es: 'Nota interna añadida', it: 'Nota interna aggiunta', ar: 'أضيفت ملاحظة داخلية' },
  }
  const entry = map[action]
  if (!entry) return action
  return pickLocaleText(locale, { en: action, ...entry })
}
