'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createLocalReference } from '@/lib/booking'
import { countryCode } from '@/data/countries'
import type { Currency } from '@/components/locale'

/**
 * Phase D custom-trip request boundary.
 *
 * UI (`/make-your-trip`, `/account/trip-requests`) builds a
 * `MakeYourTripRequestDraft`, validates it with the deterministic helpers
 * below, then hands it to the multi-request store (`createTripRequest` /
 * `updateTripRequest`), which persists browser-local records.
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

export const TRIP_REQUESTS_KEY = 'sp-trip-requests-v1'
const TRIP_REQUESTS_MAX = 200
const TRIP_REQUESTS_CHANNEL = 'sp-trip-requests'

/** Legacy singleton shape. Read once for migration, then removed. Never written. */
const LEGACY_KEY = 'sp-make-trip-request-v1'
const LEGACY_VERSION = 1
const LEGACY_BACKUP_KEY = 'sp-make-trip-request-v1.bak'

export type TripRequestStatus = 'new' | 'reviewing' | 'proposal_ready' | 'approved' | 'rejected' | 'cancelled'

export type TripRequestActor = 'customer' | 'staff' | 'system'

export type TripRequestActivity = {
  at: string
  by: TripRequestActor
  action: string
  note?: string
}

/**
 * Ownership is explicit and safe by default:
 * - `linked`: `customerId` points at a pending stub created on this browser;
 * - `unverified`: no ownership verified (guest email, or email matching a
 *   staff-managed customer the visitor has not signed in as).
 */
export type TripOwnership = 'linked' | 'unverified'

export type TripRequestContact = {
  name: string
  email: string
  phone: string
  dialCode: string
  nationality: string
}

export type TripRequest = {
  /** Stable browser-local identity (`SP-…`). Never a server reference. */
  localRef: string
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
  /** Historical snapshot taken at submit time. Never updated by profile edits. */
  contact: TripRequestContact
  notes: string
  /** Pending-stub id when honestly known. Absent means unverified guest. */
  customerId?: string
  ownership: TripOwnership
  status: TripRequestStatus
  createdAt: string
  updatedAt: string
  activity: TripRequestActivity[]
}

const TRIP_REQUEST_STATUSES: readonly TripRequestStatus[] = ['new', 'reviewing', 'proposal_ready', 'approved', 'rejected', 'cancelled']

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

/** Display strings are stored in English (event-request pattern); UI maps known actions to Arabic. */
function labelForTransition(from: TripRequestStatus, to: TripRequestStatus): string {
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

export function tripRequestStatusLabel(status: TripRequestStatus, ar: boolean): string {
  switch (status) {
    case 'new': return ar ? 'جديد' : 'New'
    case 'reviewing': return ar ? 'قيد المراجعة' : 'Reviewing'
    case 'proposal_ready': return ar ? 'العرض جاهز' : 'Proposal ready'
    case 'approved': return ar ? 'تمت الموافقة' : 'Approved'
    case 'rejected': return ar ? 'مرفوض' : 'Rejected'
    case 'cancelled': return ar ? 'ملغي' : 'Cancelled'
  }
}

export function tripActivityLabel(action: string, ar: boolean): string {
  if (!ar) return action
  switch (action) {
    case 'Request created': return 'تم إنشاء الطلب'
    case 'Request updated': return 'تم تحديث الطلب'
    case 'Review started': return 'بدأت المراجعة'
    case 'Proposal marked ready': return 'تم تحديد العرض كجاهز'
    case 'Request approved': return 'تمت الموافقة على الطلب'
    case 'Request rejected': return 'تم رفض الطلب'
    case 'Request cancelled': return 'تم إلغاء الطلب'
    case 'Reopened for review': return 'أعيد فتحه للمراجعة'
    case 'Migrated from previous single-request preview': return 'تم ترحيله من المعاينة الفردية السابقة'
    default: return action
  }
}

const REF_PATTERN = /^SP-[A-Z0-9]{6,12}$/
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

function sanitizeActivity(value: unknown): TripRequestActivity[] {
  if (!Array.isArray(value)) return []
  const out: TripRequestActivity[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const raw = entry as Partial<TripRequestActivity>
    if (typeof raw.at !== 'string' || !raw.at || typeof raw.action !== 'string' || !raw.action) continue
    const by: TripRequestActor = raw.by === 'staff' || raw.by === 'system' ? raw.by : 'customer'
    out.push({ at: raw.at.slice(0, 40), by, action: raw.action.slice(0, 160), note: typeof raw.note === 'string' && raw.note ? raw.note.slice(0, 300) : undefined })
  }
  return out.slice(0, 100)
}

function sanitizeTripRecord(value: unknown): TripRequest | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<TripRequest> & { contact?: unknown }
  if (typeof raw.localRef !== 'string' || !REF_PATTERN.test(raw.localRef.trim())) return null
  const draft = sanitizeTripDraft({
    destinationSlug: raw.destinationSlug,
    tourSlug: raw.tourSlug,
    customTitle: raw.customTitle,
    requestedAddOns: raw.requestedAddOns,
    timeMode: raw.timeMode,
    preferredFrom: raw.preferredFrom,
    preferredTo: raw.preferredTo,
    adults: raw.adults,
    children: raw.children,
    infants: raw.infants,
    budgetMin: raw.budgetMin,
    budgetMax: raw.budgetMax,
    currency: raw.currency,
    flightOffer: raw.flightOffer,
    nationality: (raw.contact as Partial<TripRequestContact> | undefined)?.nationality,
    dialCode: (raw.contact as Partial<TripRequestContact> | undefined)?.dialCode,
    notes: raw.notes,
    contact: raw.contact,
  })
  if (!draft) return null
  const status: TripRequestStatus = typeof raw.status === 'string' && (TRIP_REQUEST_STATUSES as readonly string[]).includes(raw.status)
    ? (raw.status as TripRequestStatus)
    : 'new'
  const createdAt = typeof raw.createdAt === 'string' && ISO_PATTERN.test(raw.createdAt) ? raw.createdAt : null
  const updatedAt = typeof raw.updatedAt === 'string' && ISO_PATTERN.test(raw.updatedAt) ? raw.updatedAt : null
  if (!createdAt || !updatedAt) return null
  const customerId = typeof raw.customerId === 'string' && /^TPC-[A-Z0-9]{6,12}$/.test(raw.customerId) ? raw.customerId : undefined
  return {
    localRef: raw.localRef.trim(),
    destinationSlug: draft.destinationSlug,
    tourSlug: draft.tourSlug,
    customTitle: draft.customTitle,
    requestedAddOns: draft.requestedAddOns,
    timeMode: draft.timeMode,
    preferredFrom: draft.preferredFrom,
    preferredTo: draft.preferredTo,
    adults: draft.adults,
    children: draft.children,
    infants: draft.infants,
    budgetMin: draft.budgetMin,
    budgetMax: draft.budgetMax,
    currency: draft.currency,
    flightOffer: draft.flightOffer,
    contact: {
      name: draft.contact.name,
      email: draft.contact.email,
      phone: draft.contact.phone,
      dialCode: draft.dialCode,
      nationality: draft.nationality,
    },
    notes: draft.notes,
    customerId,
    ownership: customerId && raw.ownership === 'linked' ? 'linked' : 'unverified',
    status,
    createdAt,
    updatedAt,
    activity: sanitizeActivity(raw.activity),
  }
}

let cache: TripRequest[] | null = null
const EMPTY_REQUESTS: TripRequest[] = []
const storeListeners = new Set<() => void>()

function emitStoreChange() {
  cache = null
  storeListeners.forEach((fn) => fn())
  try { window.dispatchEvent(new Event(TRIP_REQUESTS_CHANNEL)) } catch { /* noop */ }
}

function storeSubscribe(fn: () => void) {
  storeListeners.add(fn)
  return () => { storeListeners.delete(fn) }
}

function persistStore(list: TripRequest[]) {
  try { window.localStorage.setItem(TRIP_REQUESTS_KEY, JSON.stringify(list.slice(0, TRIP_REQUESTS_MAX))) } catch { /* storage can be unavailable */ }
  emitStoreChange()
}

/**
 * One-time legacy migration: a valid v1 singleton becomes one v2 record
 * with its reference preserved. Backfilled timestamps/activity are honestly
 * marked as migration metadata, never presented as original submit data.
 * Runs at most once: the v1 key is removed after a successful migration, and
 * malformed data is quarantined to a scoped backup key instead of crashing.
 */
function migrateLegacyOnce(): void {
  if (typeof window === 'undefined') return
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(LEGACY_KEY)
  } catch {
    return
  }
  if (!raw) return
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) throw new Error('malformed legacy preview')
    const shaped = parsed as { version?: unknown; draft?: unknown; localRef?: unknown }
    if (shaped.version !== LEGACY_VERSION) throw new Error('unknown legacy version')
    const draft = sanitizeTripDraft(shaped.draft)
    const localRef = typeof shaped.localRef === 'string' ? shaped.localRef.trim() : ''
    if (!draft || !REF_PATTERN.test(localRef)) throw new Error('malformed legacy preview')
    const now = new Date().toISOString()
    const record: TripRequest = {
      localRef,
      destinationSlug: draft.destinationSlug,
      tourSlug: draft.tourSlug,
      customTitle: draft.customTitle,
      requestedAddOns: draft.requestedAddOns,
      timeMode: draft.timeMode,
      preferredFrom: draft.preferredFrom,
      preferredTo: draft.preferredTo,
      adults: draft.adults,
      children: draft.children,
      infants: draft.infants,
      budgetMin: draft.budgetMin,
      budgetMax: draft.budgetMax,
      currency: draft.currency,
      flightOffer: draft.flightOffer,
      contact: { name: draft.contact.name, email: draft.contact.email, phone: draft.contact.phone, dialCode: draft.dialCode, nationality: draft.nationality },
      notes: draft.notes,
      customerId: undefined,
      ownership: 'unverified',
      status: 'new',
      createdAt: now,
      updatedAt: now,
      activity: [{ at: now, by: 'system', action: 'Migrated from previous single-request preview' }],
    }
    const current = readStoredRecords()
    if (!current.some((item) => item.localRef === record.localRef)) {
      persistStore([record, ...current])
    }
  } catch {
    // Quarantine malformed data under a scoped backup key; never crash the app.
    try {
      window.localStorage.setItem(LEGACY_BACKUP_KEY, raw)
    } catch { /* storage can be unavailable */ }
  }
  try {
    window.localStorage.removeItem(LEGACY_KEY)
  } catch { /* storage can be unavailable */ }
}

function readStoredRecords(): TripRequest[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(TRIP_REQUESTS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: TripRequest[] = []
    for (const entry of parsed) {
      const clean = sanitizeTripRecord(entry)
      if (clean && !out.some((item) => item.localRef === clean.localRef)) out.push(clean)
    }
    return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, TRIP_REQUESTS_MAX)
  } catch {
    return []
  }
}

function getStoreSnapshot(): TripRequest[] {
  if (cache === null) {
    // Migration runs lazily on first read so a saved v1 preview is never lost.
    try { migrateLegacyOnce() } catch { /* migration must never break reads */ }
    cache = readStoredRecords()
  }
  return cache
}

function mintLocalRef(taken: Set<string>): string {
  let ref = createLocalReference()
  while (taken.has(ref)) ref = createLocalReference()
  return ref
}

export function listTripRequests(): TripRequest[] {
  return [...getStoreSnapshot()]
}

export function getTripRequest(localRef: string): TripRequest | undefined {
  return getStoreSnapshot().find((item) => item.localRef === localRef)
}

export function createTripRequest(
  draft: MakeYourTripRequestDraft,
  meta?: { customerId?: string; ownership?: TripOwnership },
): TripRequest | null {
  const clean = sanitizeTripDraft(draft)
  // Defense in depth: the UI validates first, but the store never persists
  // an invalid draft (backend will revalidate again).
  if (!clean || hasTripErrors(validateTripRequest(clean))) return null
  const now = new Date().toISOString()
  const current = getStoreSnapshot()
  const customerId = typeof meta?.customerId === 'string' && /^TPC-[A-Z0-9]{6,12}$/.test(meta.customerId) ? meta.customerId : undefined
  const record: TripRequest = {
    localRef: mintLocalRef(new Set(current.map((item) => item.localRef))),
    destinationSlug: clean.destinationSlug,
    tourSlug: clean.tourSlug,
    customTitle: clean.customTitle,
    requestedAddOns: clean.requestedAddOns,
    timeMode: clean.timeMode,
    preferredFrom: clean.preferredFrom,
    preferredTo: clean.preferredTo,
    adults: clean.adults,
    children: clean.children,
    infants: clean.infants,
    budgetMin: clean.budgetMin,
    budgetMax: clean.budgetMax,
    currency: clean.currency,
    flightOffer: clean.flightOffer,
    contact: { name: clean.contact.name, email: clean.contact.email, phone: clean.contact.phone, dialCode: clean.dialCode, nationality: clean.nationality },
    notes: clean.notes,
    customerId,
    ownership: customerId && meta?.ownership === 'linked' ? 'linked' : 'unverified',
    status: 'new',
    createdAt: now,
    updatedAt: now,
    activity: [{ at: now, by: 'customer', action: 'Request created' }],
  }
  persistStore([record, ...current])
  return record
}

/**
 * Edit path: replaces travel + contact content of one record, preserving
 * identity, ownership, status, and history. Allowed only while the record is
 * new or under review; anything else returns null.
 */
export function updateTripRequest(localRef: string, draft: MakeYourTripRequestDraft, by: TripRequestActor = 'customer'): TripRequest | null {
  const current = getStoreSnapshot()
  const found = current.find((item) => item.localRef === localRef)
  if (!found || (found.status !== 'new' && found.status !== 'reviewing')) return null
  const clean = sanitizeTripDraft(draft)
  if (!clean || hasTripErrors(validateTripRequest(clean))) return null
  const now = new Date().toISOString()
  const next: TripRequest = {
    ...found,
    destinationSlug: clean.destinationSlug,
    tourSlug: clean.tourSlug,
    customTitle: clean.customTitle,
    requestedAddOns: clean.requestedAddOns,
    timeMode: clean.timeMode,
    preferredFrom: clean.preferredFrom,
    preferredTo: clean.preferredTo,
    adults: clean.adults,
    children: clean.children,
    infants: clean.infants,
    budgetMin: clean.budgetMin,
    budgetMax: clean.budgetMax,
    currency: clean.currency,
    flightOffer: clean.flightOffer,
    contact: { name: clean.contact.name, email: clean.contact.email, phone: clean.contact.phone, dialCode: clean.dialCode, nationality: clean.nationality },
    notes: clean.notes,
    updatedAt: now,
    activity: [...found.activity, { at: now, by, action: 'Request updated' }].slice(-100),
  }
  persistStore(current.map((item) => (item.localRef === localRef ? next : item)))
  return next
}

export function transitionTripRequest(localRef: string, to: TripRequestStatus, by: TripRequestActor, note?: string): TripRequest | null {
  const current = getStoreSnapshot()
  const found = current.find((item) => item.localRef === localRef)
  if (!found || !canTransitionTripRequest(found.status, to)) return null
  const now = new Date().toISOString()
  const next: TripRequest = {
    ...found,
    status: to,
    updatedAt: now,
    activity: [...found.activity, { at: now, by, action: labelForTransition(found.status, to), note: note?.slice(0, 300) }].slice(-100),
  }
  persistStore(current.map((item) => (item.localRef === localRef ? next : item)))
  return next
}

/** Customer cancel: valid only while semantically cancellable (new/reviewing). History is kept, never deleted. */
export function cancelTripRequest(localRef: string, by: TripRequestActor = 'customer'): TripRequest | null {
  return transitionTripRequest(localRef, 'cancelled', by)
}

export function useTripRequests(): TripRequest[] {
  const list = useSyncExternalStore(storeSubscribe, getStoreSnapshot, () => EMPTY_REQUESTS)
  useEffect(() => {
    const sync = () => { cache = null; storeListeners.forEach((fn) => fn()) }
    // Prime from storage on mount (SSR snapshot is []).
    sync()
    window.addEventListener(TRIP_REQUESTS_CHANNEL, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(TRIP_REQUESTS_CHANNEL, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return list
}

export function useTripRequest(localRef: string): TripRequest | undefined {
  const list = useTripRequests()
  return list.find((item) => item.localRef === localRef)
}
