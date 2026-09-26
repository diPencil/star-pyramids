import { createLocalReference } from '@/lib/booking'
import type { Currency } from '@/components/locale'

/**
 * Phase D custom-trip request boundary.
 *
 * UI (`/make-your-trip`) builds a `MakeYourTripRequestDraft`, validates it
 * with the deterministic helpers below, then hands it to the local prototype
 * adapter (`recordTripRequestPreview`) which stores a browser-local preview.
 *
 * Later this becomes: UI -> MakeYourTripRequestDraft -> real backend
 * service/API, which will resolve slugs, revalidate everything, check
 * availability, and issue the official reference. The draft carries no fake
 * backend fields (no database IDs, server timestamps, API responses, or
 * "sent/received" claims). The local reference is labelled `Local ref` in
 * the UI and will be replaced by the backend later.
 *
 * A Make Your Trip request is NOT a cart item, booking, payment, or quote.
 * It must never be inserted into the Trip Cart.
 */

export const TRIP_REQUEST_STORAGE_KEY = 'sp-make-trip-request-v1'
const TRIP_REQUEST_STORAGE_VERSION = 1

export const TRIP_BUDGET_CAP = 10000
export const TRIP_NOTE_MAX = 1000
export const TRIP_NAME_MAX = 80
export const TRIP_EMAIL_MAX = 120
export const TRIP_PHONE_MAX = 24
export const TRIP_TRAVELER_MAX = 50

export type TripTimeMode = 'exact' | 'approx' | 'unsure'

export type TripRequestContact = {
  name: string
  email: string
  /** Combined dial code + number as typed, e.g. "+20 101 234 5678". */
  phone: string
}

export type MakeYourTripRequestDraft = {
  /** Known destination slug, or '' when the request is anchored to a tour. */
  destinationSlug: string
  /** Canonical tour slug when the user arrived from a tour page, else ''. */
  tourSlug: string
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
  contact: TripRequestContact
}

export type TripRequestPreview = {
  draft: MakeYourTripRequestDraft
  /** Browser-local reference only. Never presented as a server reference. */
  localRef: string
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/

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

/** Deterministic frontend validation. The future backend validates again. */
export function validateTripRequest(draft: MakeYourTripRequestDraft, opts?: { isShore?: boolean }): TripFieldErrors {
  const errors: TripFieldErrors = {}
  const isShore = opts?.isShore === true

  if (!draft.destinationSlug && !draft.tourSlug) errors.destination = 'required'

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
 * Stored previews are UNTRUSTED browser input. Malformed records are dropped
 * (null) so stale data fails safely instead of crashing or substituting
 * unrelated values.
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
    nationality: safeText(raw.nationality, 40).trim(),
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

function sanitizeStoredPreview(value: unknown): TripRequestPreview | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as { version?: unknown; draft?: unknown; localRef?: unknown }
  if (raw.version !== TRIP_REQUEST_STORAGE_VERSION) return null
  const draft = sanitizeTripDraft(raw.draft)
  const localRef = typeof raw.localRef === 'string' ? raw.localRef.trim() : ''
  if (!draft || !localRef) return null
  return { draft, localRef }
}

export function readTripPreview(): TripRequestPreview | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(TRIP_REQUEST_STORAGE_KEY)
    if (!raw) return null
    return sanitizeStoredPreview(JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * Local prototype adapter: the single Make Your Trip boundary.
 *
 * UI -> MakeYourTripRequestDraft -> local browser preview (today).
 * UI -> MakeYourTripRequestDraft -> real backend service/API (later).
 *
 * The local reference is the stable identity of ONE saved preview:
 * - generated only when a genuinely new preview is created
 *   (first creation, or after the previous preview was discarded);
 * - an `existingRef` is reused only when it matches the currently stored
 *   preview, proving the same saved request is being re-recorded
 *   (edit/resume/view). Anything else mints a fresh identity.
 * - refresh/reload never generates: it only reads and restores.
 *
 * The result is truthful: browser-local only, labelled `Local ref`, never
 * presented as submitted, confirmed, quoted, or emailed.
 */
export function recordTripRequestPreview(draft: MakeYourTripRequestDraft, existingRef?: string | null): TripRequestPreview {
  const stored = readTripPreview()
  const carried = typeof existingRef === 'string' ? existingRef.trim() : ''
  let localRef: string
  if (carried !== '' && stored !== null && stored.localRef === carried) {
    localRef = carried
  } else {
    localRef = createLocalReference()
    if (stored && localRef === stored.localRef) localRef = createLocalReference()
  }
  const preview: TripRequestPreview = { draft, localRef }
  try {
    window.localStorage.setItem(
      TRIP_REQUEST_STORAGE_KEY,
      JSON.stringify({ version: TRIP_REQUEST_STORAGE_VERSION, draft, localRef }),
    )
  } catch {
    // Preview stays in memory only when storage is unavailable.
  }
  return preview
}

export function clearTripPreview() {
  try {
    window.localStorage.removeItem(TRIP_REQUEST_STORAGE_KEY)
  } catch {
    // Storage can be unavailable; nothing to clear.
  }
}
