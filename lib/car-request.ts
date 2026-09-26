'use client'

import { useEffect, useState } from 'react'
import { createLocalReference } from '@/lib/booking'
import type { Currency } from '@/components/locale'

/**
 * Phase E car-request boundary (separate domain from trip requests).
 *
 * UI (`/rent-car/request`) builds a `CarRequestDraft`, validates it with the
 * deterministic helpers below, then hands it to the local prototype adapter
 * (`recordCarRequestPreview`) which stores a browser-local preview.
 *
 * Later this becomes: UI -> CarRequestDraft -> real backend service/API,
 * which will resolve the vehicle slug, revalidate everything, check fleet
 * availability, confirm the rate, and issue the official reference. The draft
 * carries only user-entered/requested values: no availability, assigned
 * vehicle, confirmed rate/total, booking or payment status, payment method,
 * or server reference. Those belong to the future backend.
 *
 * The local reference is labelled `Local ref` in the UI and will be replaced
 * by the backend later. A car request is NOT a cart item, booking, or payment.
 */

export const CAR_REQUEST_STORAGE_KEY = 'sp-car-request-v1'
const CAR_REQUEST_STORAGE_VERSION = 1

/**
 * Same-tab notification channel for preview writes/clears. Cross-tab updates
 * arrive through the native `storage` event. The storage key stays the single
 * source of truth — this event carries no payload.
 */
const CAR_REQUEST_EVENT = 'sp-car-request'

function emitCarRequestChange() {
  try {
    window.dispatchEvent(new Event(CAR_REQUEST_EVENT))
  } catch {
    // Non-browser or dispatch unavailable; readers still see storage directly.
  }
}

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

export type CarRequestPreview = {
  draft: CarRequestDraft
  /** Browser-local reference only. Never presented as a server reference. */
  localRef: string
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/

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

/** Deterministic frontend validation. The future backend validates again. */
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
 * Stored previews are UNTRUSTED browser input. Malformed records are dropped
 * (null) so stale data fails safely instead of crashing or substituting
 * unrelated values.
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

function sanitizeStoredPreview(value: unknown): CarRequestPreview | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as { version?: unknown; draft?: unknown; localRef?: unknown }
  if (raw.version !== CAR_REQUEST_STORAGE_VERSION) return null
  const draft = sanitizeCarDraft(raw.draft)
  const localRef = typeof raw.localRef === 'string' ? raw.localRef.trim() : ''
  if (!draft || !localRef) return null
  return { draft, localRef }
}

export function readCarPreview(): CarRequestPreview | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CAR_REQUEST_STORAGE_KEY)
    if (!raw) return null
    return sanitizeStoredPreview(JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * Local prototype adapter: the single car-request boundary.
 *
 * UI -> CarRequestDraft -> local browser preview (today).
 * UI -> CarRequestDraft -> real backend service/API (later).
 *
 * The local reference is the stable identity of ONE saved preview:
 * generated only for a genuinely new preview (first creation, or after the
 * previous preview was discarded). An `existingRef` is reused only when it
 * matches the currently stored preview, proving the same saved request is
 * being re-recorded (edit/resume/view). Refresh/reload only reads and
 * restores — it never generates.
 *
 * The result is truthful: browser-local only, labelled `Local ref`, never
 * presented as submitted, confirmed, reserved, priced, or emailed.
 */
export function recordCarRequestPreview(draft: CarRequestDraft, existingRef?: string | null): CarRequestPreview {
  const stored = readCarPreview()
  const carried = typeof existingRef === 'string' ? existingRef.trim() : ''
  let localRef: string
  if (carried !== '' && stored !== null && stored.localRef === carried) {
    localRef = carried
  } else {
    localRef = createLocalReference()
    if (stored && localRef === stored.localRef) localRef = createLocalReference()
  }
  const preview: CarRequestPreview = { draft, localRef }
  try {
    window.localStorage.setItem(
      CAR_REQUEST_STORAGE_KEY,
      JSON.stringify({ version: CAR_REQUEST_STORAGE_VERSION, draft, localRef }),
    )
  } catch {
    // Preview stays in memory only when storage is unavailable.
  }
  emitCarRequestChange()
  return preview
}

export function clearCarPreview() {
  try {
    window.localStorage.removeItem(CAR_REQUEST_STORAGE_KEY)
  } catch {
    // Storage can be unavailable; nothing to clear.
  }
  emitCarRequestChange()
}

/**
 * Reactive reader for the single browser-local preview. Re-renders on
 * prepare/edit/discard in this tab and on `storage` events from other tabs.
 * No polling; no duplicate key. Returns null when nothing is stored.
 */
export function useCarRequestPreview(): CarRequestPreview | null {
  const [preview, setPreview] = useState<CarRequestPreview | null>(null)
  useEffect(() => {
    const sync = () => setPreview(readCarPreview())
    sync()
    window.addEventListener(CAR_REQUEST_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CAR_REQUEST_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return preview
}
