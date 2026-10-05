import { findEvent } from '@/data/content'

/**
 * Event-request contract (Phase 2D: real backend).
 *
 * UI (`/events/[slug]`, `/account/event-requests`, `/admin/event-requests`)
 * builds an `EventRequestDraft`, validates it with the deterministic helpers
 * below, then talks to the server API (`POST /api/event-requests`,
 * `/api/account/event-requests/*`, `/api/admin/event-requests/*`), which
 * revalidates everything, links ownership from the server session, and
 * issues the official reference (`SP-ER-…`).
 *
 * This module is intentionally neutral (no `'use client'`, no React, no
 * storage): the client UI and `lib/server/event-requests.ts` share the
 * lifecycle, labels, and validation-shape helpers. The browser never stores
 * event requests; MySQL is the only store.
 *
 * An event request is a preliminary attendance request pending staff
 * review — never a confirmed ticket, booking, or payment. Customers cannot
 * edit submitted requests; they may only cancel while new/reviewing.
 */

export const EVENT_TITLE_MAX = 160
export const EVENT_DATE_MAX = 120
export const EVENT_LOCATION_MAX = 160
export const EVENT_NOTE_MAX = 1000
export const EVENT_NAME_MAX = 80
export const EVENT_EMAIL_MAX = 120
export const EVENT_PHONE_MAX = 32
export const EVENT_ATTENDEES_MAX = 50

export type EventRequestStatus = 'new' | 'reviewing' | 'approved' | 'rejected' | 'cancelled'

export type EventRequestActor = 'customer' | 'staff' | 'system'

export type EventRequestActivity = {
  at: string
  by: EventRequestActor
  action: string
  note?: string
  /** Staff-only marker. Never set on customer-facing rows. */
  internal?: boolean
}

export type EventRequestContactView = {
  name: string
  email: string
  phone: string
}

export type EventRequestDraft = {
  eventSlug: string
  eventTitle: string
  eventDate: string
  eventLocation: string
  name: string
  nationality: string
  dialCode: string
  phone: string
  email: string
  attendees: number
  note?: string
}

/**
 * Server-issued request view (MySQL-backed). `reference` is the official
 * public reference (`SP-ER-…`); database IDs are never exposed. The contact
 * block is the historical snapshot taken at submit time. `nationality` is
 * the 2-letter country code, `dialCode` the phone prefix (e.g. `+20`).
 */
export type EventRequest = {
  reference: string
  eventSlug: string
  eventTitle: string
  eventDate: string
  eventLocation: string
  attendees: number
  contact: EventRequestContactView
  nationality: string
  dialCode: string
  notes: string
  status: EventRequestStatus
  createdAt: string
  updatedAt: string
  activity: EventRequestActivity[]
}

/** Linked registered account info (staff views only, never customer-facing). */
export type EventRequestAccount = {
  email: string
  name: string
} | null

export type StaffEventRequest = EventRequest & {
  account: EventRequestAccount
}

export const EVENT_REQUEST_STATUSES: readonly EventRequestStatus[] = ['new', 'reviewing', 'approved', 'rejected', 'cancelled']

/** Customer-side cancel is allowed only while new or under review. No customer edit exists. */
export const CUSTOMER_EVENT_CANCELLABLE_STATUSES: readonly EventRequestStatus[] = ['new', 'reviewing']

const EVENT_TRANSITIONS: Record<EventRequestStatus, EventRequestStatus[]> = {
  new: ['reviewing', 'cancelled'],
  reviewing: ['approved', 'rejected', 'cancelled'],
  approved: ['reviewing'],
  rejected: ['reviewing'],
  cancelled: [],
}

export function canTransitionEventRequest(from: EventRequestStatus, to: EventRequestStatus): boolean {
  return EVENT_TRANSITIONS[from]?.includes(to) ?? false
}

/** Display strings are stored in English; UI maps known actions to Arabic. */
export function labelForEventTransition(from: EventRequestStatus, to: EventRequestStatus): string {
  if (to === 'reviewing' && (from === 'approved' || from === 'rejected' || from === 'cancelled')) return 'Reopened for review'
  switch (to) {
    case 'reviewing': return 'Review started'
    case 'approved': return 'Request approved'
    case 'rejected': return 'Request rejected'
    case 'cancelled': return 'Request cancelled'
    default: return 'Status updated'
  }
}

export function eventRequestStatusLabel(status: EventRequestStatus, ar: boolean): string {
  switch (status) {
    case 'new': return ar ? 'جديد' : 'New'
    case 'reviewing': return ar ? 'قيد المراجعة' : 'Reviewing'
    case 'approved': return ar ? 'مقبول مبدئيًا' : 'Approved'
    case 'rejected': return ar ? 'مرفوض' : 'Rejected'
    case 'cancelled': return ar ? 'ملغي' : 'Cancelled'
  }
}

export function eventActivityLabel(action: string, ar: boolean): string {
  if (!ar) return action
  switch (action) {
    case 'Request created': return 'تم إنشاء الطلب'
    case 'Review started': return 'بدأت المراجعة'
    case 'Request approved': return 'تم قبول الطلب'
    case 'Request rejected': return 'تم رفض الطلب'
    case 'Request cancelled': return 'تم إلغاء الطلب'
    case 'Reopened for review': return 'أعيد فتحه للمراجعة'
    case 'Internal note added': return 'أضيفت ملاحظة داخلية'
    default: return action
  }
}

/**
 * Official + legacy-tolerant reference shape for route params and links.
 * The backend issues `SP-ER-XXXXXX`; older browser-local `EVR-…` refs are
 * still routable so they fail honestly (not found) instead of crashing.
 */
const EVENT_REF_PATTERN = /^(SP-ER-[A-Z0-9]{6}|EVR-[A-Z0-9]{6,12})$/
export const OFFICIAL_EVENT_REF_PATTERN = /^SP-ER-[A-Z0-9]{6}$/

export function isEventReference(value: string): boolean {
  return EVENT_REF_PATTERN.test(value.trim())
}

/**
 * Canonical event display title for a request. Source of truth is the
 * static catalogue; an unknown or removed slug falls back to the stored
 * snapshot verbatim — never a fabricated title.
 */
export function eventDisplayTitle(slug: string, fallback: string): string {
  return findEvent(slug)?.title ?? fallback
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/

export type EventRequestErrors = {
  name?: 'required'
  email?: 'required' | 'invalid'
  phone?: 'required' | 'invalid'
  attendees?: 'required' | 'invalid'
  event?: 'invalid'
}

/** Deterministic frontend validation. The backend validates everything again. */
export function validateEventRequestDraft(draft: EventRequestDraft): EventRequestErrors {
  const errors: EventRequestErrors = {}
  if (!draft.name.trim()) errors.name = 'required'
  if (!draft.email.trim()) errors.email = 'required'
  else if (draft.email.trim().length > EVENT_EMAIL_MAX || !EMAIL_PATTERN.test(draft.email.trim())) errors.email = 'invalid'
  const digits = draft.phone.replace(/\D/g, '')
  if (!draft.phone.trim()) errors.phone = 'required'
  else if (digits.length < 7 || draft.phone.trim().length > EVENT_PHONE_MAX) errors.phone = 'invalid'
  if (!Number.isInteger(draft.attendees) || draft.attendees < 1 || draft.attendees > EVENT_ATTENDEES_MAX) errors.attendees = 'invalid'
  if (!draft.eventSlug.trim() || !SLUG_PATTERN.test(draft.eventSlug.trim())) errors.event = 'invalid'
  return errors
}

export function hasEventRequestErrors(errors: EventRequestErrors): boolean {
  return Boolean(errors.name || errors.email || errors.phone || errors.attendees || errors.event)
}

export function requestsForEventSlug(list: readonly { eventSlug: string }[], slug: string): number {
  return list.filter((r) => r.eventSlug === slug).length
}
