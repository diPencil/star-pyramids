import { countryCode } from '@/data/countries'
import type { Currency } from '@/components/locale'
import { localeFromAr, pickLocaleText, type Locale } from '@/lib/locale-config'

/**
 * Custom-trip request contract (Phase 2B: real backend).
 *
 * UI (`/make-your-trip`, `/account/trip-requests`, `/admin/trip-requests`)
 * builds a `MakeYourTripRequestDraft`, validates it with the deterministic
 * helpers below, then talks to the server API (`POST /api/trip-requests`,
 * `/api/account/trip-requests/*`, `/api/admin/trip-requests/*`), which
 * revalidates everything, resolves slugs, links ownership from the server
 * session, and issues the official reference (`SP-TR-…`).
 *
 * This module is intentionally neutral (no `'use client'`, no React, no
 * storage): the client UI and `lib/server/trip-requests.ts` share the
 * lifecycle, labels, and validation-shape helpers. The browser never stores
 * trip requests; MySQL is the only store.
 *
 * A Make Your Trip request is NOT a cart item, booking, payment, or quote.
 * It must never be inserted into the Trip Cart.
 */

export const TRIP_BUDGET_CAP = 10000
export const TRIP_NOTE_MAX = 1000
export const TRIP_NAME_MAX = 80
export const TRIP_EMAIL_MAX = 120
export const TRIP_PHONE_MAX = 24
export const TRIP_TRAVELER_MAX = 50

export type TripTimeMode = 'exact' | 'approx' | 'unsure'

export type MakeYourTripRequestDraft = {
  /** Known destination slug, or '' when the request is anchored to a tour. */
  destinationSlug: string
  /** Canonical tour slug when the user arrived from a tour page, else ''. */
  tourSlug: string
  /** Free-text trip name typed by the customer (account flow). Never charged or resolved. */
  customTitle: string
  /** Requested add-on titles (canonical titles only, never charged here). */
  requestedAddOns: string[]
  timeMode: TripTimeMode
  /** Preferred/requested dates (YYYY-MM-DD). No live availability backend. */
  preferredFrom: string
  preferredTo: string
  adults: number
  children: number
  infants: number
  /** Customer's preferred budget range — never a quote or confirmed price. */
  budgetMin: number
  budgetMax: number
  currency: Currency
  flightOffer: boolean
  nationality: string
  dialCode: string
  notes: string
  /** Submitted contact; nationality/dialCode travel top-level on the draft. */
  contact: { name: string; email: string; phone: string }
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/

/**
 * Official + legacy-tolerant reference shape for route params and links.
 * The backend issues `SP-TR-XXXXXX`; older browser-local `SP-…` refs are
 * still routable so they fail honestly (not found) instead of crashing.
 */
const REF_PATTERN = /^SP-(TR-)?[A-Z0-9]{6,12}$/
export const OFFICIAL_REF_PATTERN = /^SP-TR-[A-Z0-9]{6}$/

export function isTripReference(value: string): boolean {
  return REF_PATTERN.test(value.trim())
}

/** Preferred/requested date only. There is no live availability backend. */
export function isValidTripDate(value: string): boolean {
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
export function isPastTripDate(value: string): boolean {
  if (!isValidTripDate(value)) return false
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return value < today
}

export type TripFieldErrors = Partial<Record<
  'destination' | 'from' | 'to' | 'travelers' | 'name' | 'email' | 'nationality' | 'phone' | 'budget' | 'notes',
  'required' | 'invalid'
>>

function safeCount(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function safeMoney(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(TRIP_BUDGET_CAP, Math.max(0, n))
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
export function validateTripRequest(draft: MakeYourTripRequestDraft, opts?: { isShore?: boolean }): TripFieldErrors {
  const errors: TripFieldErrors = {}
  const isShore = opts?.isShore === true

  if (!draft.destinationSlug && !draft.tourSlug && !draft.customTitle.trim()) errors.destination = 'required'

  const datesProvided = draft.preferredFrom !== '' || draft.preferredTo !== ''
  if (draft.timeMode === 'exact') {
    if (!draft.preferredFrom || !isValidTripDate(draft.preferredFrom) || isPastTripDate(draft.preferredFrom)) {
      errors.from = !draft.preferredFrom ? 'required' : 'invalid'
    }
    if (!isShore) {
      if (!draft.preferredTo || !isValidTripDate(draft.preferredTo) || isPastTripDate(draft.preferredTo)) {
        errors.to = !draft.preferredTo ? 'required' : 'invalid'
      } else if (!errors.from && draft.preferredTo < draft.preferredFrom) {
        errors.to = 'invalid'
      }
    }
  } else if (datesProvided) {
    if (draft.preferredFrom !== '' && (!isValidTripDate(draft.preferredFrom) || isPastTripDate(draft.preferredFrom))) {
      errors.from = 'invalid'
    }
    if (!isShore && draft.preferredTo !== '' && (!isValidTripDate(draft.preferredTo) || isPastTripDate(draft.preferredTo))) {
      errors.to = 'invalid'
    }
    if (!errors.from && !errors.to && !isShore && draft.preferredFrom !== '' && draft.preferredTo !== '' && draft.preferredTo < draft.preferredFrom) {
      errors.to = 'invalid'
    }
  }

  const { adults, children, infants } = draft
  const countsOk =
    Number.isSafeInteger(adults) && Number.isSafeInteger(children) && Number.isSafeInteger(infants) &&
    adults >= 1 && adults <= TRIP_TRAVELER_MAX &&
    children >= 0 && children <= TRIP_TRAVELER_MAX &&
    infants >= 0 && infants <= TRIP_TRAVELER_MAX
  if (!countsOk) errors.travelers = 'invalid'

  const name = draft.contact.name.trim()
  if (!name) errors.name = 'required'
  else if (name.length < 2 || /^\d+$/.test(name.replace(/[\s.'-]+/g, ''))) errors.name = 'invalid'

  const email = draft.contact.email.trim()
  if (!email) errors.email = 'required'
  else if (email.length > TRIP_EMAIL_MAX || !EMAIL_PATTERN.test(email)) errors.email = 'invalid'

  if (!draft.nationality.trim()) errors.nationality = 'required'

  const phone = draft.contact.phone.trim()
  if (!phone) errors.phone = 'required'
  else {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 7 || phone.length > TRIP_PHONE_MAX) errors.phone = 'invalid'
  }

  if (
    !Number.isFinite(draft.budgetMin) || !Number.isFinite(draft.budgetMax) ||
    draft.budgetMin < 0 || draft.budgetMax < 0 ||
    draft.budgetMin > TRIP_BUDGET_CAP || draft.budgetMax > TRIP_BUDGET_CAP ||
    draft.budgetMin > draft.budgetMax
  ) {
    errors.budget = 'invalid'
  }

  if (draft.notes.length > TRIP_NOTE_MAX) errors.notes = 'invalid'

  return errors
}

export function hasTripErrors(errors: TripFieldErrors): boolean {
  return Object.keys(errors).length > 0
}

/**
 * Untrusted-input shaping for drafts (edit prefill, stored previews).
 * Malformed input is dropped (null) so stale data fails safely instead of
 * crashing or substituting unrelated values.
 */
export function sanitizeTripDraft(value: unknown): MakeYourTripRequestDraft | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<MakeYourTripRequestDraft>
  const contact = (typeof raw.contact === 'object' && raw.contact !== null ? raw.contact : {}) as Partial<TripRequestContact>
  const timeMode: TripTimeMode = raw.timeMode === 'approx' || raw.timeMode === 'unsure' ? raw.timeMode : 'exact'
  const currency: Currency = raw.currency === 'EUR' || raw.currency === 'EGP' ? raw.currency : 'USD'
  const preferredFrom = typeof raw.preferredFrom === 'string' && (raw.preferredFrom === '' || isValidTripDate(raw.preferredFrom))
    ? raw.preferredFrom
    : ''
  const preferredTo = typeof raw.preferredTo === 'string' && (raw.preferredTo === '' || isValidTripDate(raw.preferredTo))
    ? raw.preferredTo
    : ''
  const draft: MakeYourTripRequestDraft = {
    destinationSlug: safeSlug(raw.destinationSlug),
    tourSlug: safeSlug(raw.tourSlug),
    customTitle: safeText(raw.customTitle, 120).trim(),
    requestedAddOns: Array.isArray(raw.requestedAddOns)
      ? raw.requestedAddOns.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter((entry) => entry.length > 0).slice(0, 20)
      : [],
    timeMode,
    preferredFrom,
    preferredTo,
    adults: safeCount(raw.adults, 1, TRIP_TRAVELER_MAX, 1),
    children: safeCount(raw.children, 0, TRIP_TRAVELER_MAX, 0),
    infants: safeCount(raw.infants, 0, TRIP_TRAVELER_MAX, 0),
    budgetMin: safeMoney(raw.budgetMin, 0),
    budgetMax: safeMoney(raw.budgetMax, 0),
    currency,
    flightOffer: raw.flightOffer === true,
    // New writes use ISO codes; legacy records may carry a country NAME,
    // which normalizes here so old requests keep hydrating. Unknown values
    // are preserved verbatim and surface through the display fallback.
    nationality: countryCode(raw.nationality) || safeText(raw.nationality, 40).trim(),
    dialCode: safeText(raw.dialCode, 8).trim(),
    notes: safeText(raw.notes, TRIP_NOTE_MAX),
    contact: {
      name: safeText(contact.name, TRIP_NAME_MAX),
      email: safeText(contact.email, TRIP_EMAIL_MAX),
      phone: safeText(contact.phone, TRIP_PHONE_MAX),
    },
  }
  if (draft.budgetMin > draft.budgetMax) draft.budgetMax = draft.budgetMin
  return draft
}

export type TripRequestStatus = 'new' | 'reviewing' | 'proposal_ready' | 'approved' | 'rejected' | 'cancelled'

export type TripRequestActor = 'customer' | 'staff' | 'system'

export type TripRequestActivity = {
  at: string
  by: TripRequestActor
  action: string
  note?: string
  /** Staff-only marker. Never set on customer-facing rows. */
  internal?: boolean
}

export type TripRequestContact = {
  name: string
  email: string
  phone: string
  dialCode: string
  nationality: string
}

/**
 * Server-issued request view (MySQL-backed). `reference` is the official
 * public reference (`SP-TR-…`); database IDs are never exposed. The contact
 * block is the historical snapshot taken at submit/edit time.
 */
export type TripRequest = {
  reference: string
  destinationSlug: string
  tourSlug: string
  customTitle: string
  requestedAddOns: string[]
  timeMode: TripTimeMode
  preferredFrom: string
  preferredTo: string
  adults: number
  children: number
  infants: number
  budgetMin: number
  budgetMax: number
  currency: Currency
  flightOffer: boolean
  contact: TripRequestContact
  notes: string
  status: TripRequestStatus
  createdAt: string
  updatedAt: string
  activity: TripRequestActivity[]
}

/** Linked registered account info (staff views only, never customer-facing). */
export type TripRequestAccount = {
  email: string
  name: string
} | null

export type StaffTripRequest = TripRequest & {
  account: TripRequestAccount
}

export const TRIP_REQUEST_STATUSES: readonly TripRequestStatus[] = ['new', 'reviewing', 'proposal_ready', 'approved', 'rejected', 'cancelled']

/** Customer-side edit/cancel is allowed only while new or under review. */
export const CUSTOMER_EDITABLE_STATUSES: readonly TripRequestStatus[] = ['new', 'reviewing']

const TRANSITIONS: Record<TripRequestStatus, TripRequestStatus[]> = {
  new: ['reviewing', 'cancelled'],
  reviewing: ['proposal_ready', 'rejected', 'cancelled'],
  proposal_ready: ['approved', 'rejected', 'cancelled'],
  approved: ['reviewing'],
  rejected: ['reviewing'],
  cancelled: [],
}

export function canTransitionTripRequest(from: TripRequestStatus, to: TripRequestStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

/** Display strings are stored in English; UI maps known actions to Arabic. */
export function labelForTransition(from: TripRequestStatus, to: TripRequestStatus): string {
  if (to === 'reviewing' && (from === 'approved' || from === 'rejected')) return 'Reopened for review'
  switch (to) {
    case 'reviewing': return 'Review started'
    case 'proposal_ready': return 'Proposal marked ready'
    case 'approved': return 'Request approved'
    case 'rejected': return 'Request rejected'
    case 'cancelled': return 'Request cancelled'
    default: return 'Status updated'
  }
}

export function tripRequestStatusLabel(status: TripRequestStatus, ar: boolean | Locale): string {
  const locale = localeFromAr(ar)
  switch (status) {
    case 'new': return pickLocaleText(locale, { en: 'New', es: 'Nueva', it: 'Nuova', ar: 'جديد' })
    case 'reviewing': return pickLocaleText(locale, { en: 'Reviewing', es: 'En revisión', it: 'In revisione', ar: 'قيد المراجعة' })
    case 'proposal_ready': return pickLocaleText(locale, { en: 'Proposal ready', es: 'Propuesta lista', it: 'Proposta pronta', ar: 'العرض جاهز' })
    case 'approved': return pickLocaleText(locale, { en: 'Approved', es: 'Aprobada', it: 'Approvata', ar: 'تمت الموافقة' })
    case 'rejected': return pickLocaleText(locale, { en: 'Rejected', es: 'Rechazada', it: 'Rifiutata', ar: 'مرفوض' })
    case 'cancelled': return pickLocaleText(locale, { en: 'Cancelled', es: 'Cancelada', it: 'Annullata', ar: 'ملغي' })
  }
}

export function tripActivityLabel(action: string, ar: boolean | Locale): string {
  const locale = localeFromAr(ar)
  if (locale === 'en') return action
  const map: Record<string, { es?: string; it?: string; ar?: string }> = {
    'Request created': { es: 'Solicitud creada', it: 'Richiesta creata', ar: 'تم إنشاء الطلب' },
    'Request updated': { es: 'Solicitud actualizada', it: 'Richiesta aggiornata', ar: 'تم تحديث الطلب' },
    'Review started': { es: 'Revisión iniciada', it: 'Revisione avviata', ar: 'بدأت المراجعة' },
    'Proposal marked ready': { es: 'Propuesta marcada como lista', it: 'Proposta contrassegnata come pronta', ar: 'تم تحديد العرض كجاهز' },
    'Request approved': { es: 'Solicitud aprobada', it: 'Richiesta approvata', ar: 'تمت الموافقة على الطلب' },
    'Request rejected': { es: 'Solicitud rechazada', it: 'Richiesta rifiutata', ar: 'تم رفض الطلب' },
    'Request cancelled': { es: 'Solicitud cancelada', it: 'Richiesta annullata', ar: 'تم إلغاء الطلب' },
    'Reopened for review': { es: 'Reabierta para revisión', it: 'Riaperto per la revisione', ar: 'أعيد فتحه للمراجعة' },
    'Internal note added': { es: 'Nota interna añadida', it: 'Nota interna aggiunta', ar: 'أضيفت ملاحظة داخلية' },
  }
  const entry = map[action]
  if (!entry) return action
  return pickLocaleText(locale, { en: action, ...entry })
}
