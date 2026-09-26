'use client'

import { useEffect, useState } from 'react'
import { readCarPreview, type CarRequestDraft, type CarRequestPreview } from '@/lib/car-request'

/**
 * Customer change-request (amendment) workflow — browser-local prototype.
 *
 * Business rule: the original CarRequestDraft in `sp-car-request-v1` is
 * IMMUTABLE. Customers propose changes; nothing overwrites the original.
 * Amendments live under their own versioned key `sp-car-request-amendments-v1`
 * and reference the original by its stable local ref (`SP-*`).
 *
 * Status semantics (all local/demo):
 * - draft: customer is preparing; discardable with confirmation.
 * - pending: saved locally for prototype review; blocks other pendings.
 * - approved: demo approval applied through `getCustomerEffectiveCarRequest`
 *   (computed view only — storage of the original is never rewritten).
 * - rejected: terminal demo state with a required reason; history preserved.
 *
 * "Pending" never implies a server received anything. Cross-role (customer ↔
 * admin) visibility in this prototype exists ONLY because both sides read the
 * same browser storage on the same device. The backend will replace the
 * adapter (`getCustomerEffectiveCarRequest`) and the transport later.
 */

export const CAR_AMENDMENTS_KEY = 'sp-car-request-amendments-v1'
const AMENDMENTS_VERSION = 1

const AMENDMENT_EVENT = 'sp-car-request-amendments'

function emitAmendmentsChange() {
  try {
    window.dispatchEvent(new Event(AMENDMENT_EVENT))
  } catch {
    // Readers still see storage directly.
  }
}

export type AmendmentStatus = 'draft' | 'pending' | 'approved' | 'rejected'

/** Customer-editable fields that can appear in a before/after diff. */
export const AMENDABLE_FIELDS = [
  'vehicle',
  'tripType',
  'pickup',
  'dropoff',
  'pickupDate',
  'returnDate',
  'passengers',
  'fullName',
  'email',
  'phone',
  'notes',
] as const

export type AmendableField = (typeof AMENDABLE_FIELDS)[number]

export type AmendmentActor = 'customer' | 'staff'

export type AmendmentHistoryEntry = {
  id: string
  kind: 'created' | 'submitted' | 'approved' | 'rejected' | 'discarded'
  /** Browser-local ISO timestamp. Displayed as local/demo metadata only. */
  at: string
  by: AmendmentActor
  note?: string
}

export type CarRequestAmendment = {
  /** Browser-local amendment ref (`AM-*`). Never a server reference. */
  amendmentRef: string
  /** Stable local ref (`SP-*`) of the immutable original request. */
  requestRef: string
  proposed: CarRequestDraft
  changedFields: AmendableField[]
  /** Optional customer note explaining the request. */
  note: string
  status: AmendmentStatus
  createdAt: string
  updatedAt: string
  decidedAt?: string
  decisionReason?: string
  history: AmendmentHistoryEntry[]
}

type AmendmentsStore = {
  version: 1
  amendments: CarRequestAmendment[]
}

const NOTE_MAX = 500

function makeAmendmentRef(taken: Set<string>): string {
  let ref = ''
  do {
    ref = `AM-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`
  } while (taken.has(ref))
  return ref
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}

function safeText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, max)
}

function isAmendableField(value: unknown): value is AmendableField {
  return typeof value === 'string' && (AMENDABLE_FIELDS as readonly string[]).includes(value)
}

function sanitizeHistory(value: unknown): AmendmentHistoryEntry[] {
  if (!Array.isArray(value)) return []
  const kinds = ['created', 'submitted', 'approved', 'rejected', 'discarded']
  return value
    .filter((entry): entry is AmendmentHistoryEntry => typeof entry === 'object' && entry !== null)
    .map((entry): AmendmentHistoryEntry | null => {
      const raw = entry as Partial<AmendmentHistoryEntry>
      if (typeof raw.id !== 'string' || !raw.id) return null
      if (!kinds.includes(raw.kind ?? '')) return null
      if (typeof raw.at !== 'string' || !raw.at) return null
      if (raw.by !== 'customer' && raw.by !== 'staff') return null
      return {
        id: raw.id.slice(0, 80),
        kind: raw.kind as AmendmentHistoryEntry['kind'],
        at: raw.at.slice(0, 40),
        by: raw.by,
        note: typeof raw.note === 'string' && raw.note ? raw.note.slice(0, 1000) : undefined,
      }
    })
    .filter((entry): entry is AmendmentHistoryEntry => entry !== null)
    .slice(0, 100)
}

/** Reuses the draft sanitizer contract: only well-formed drafts are stored. */
function sanitizeProposed(value: unknown): CarRequestDraft | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<CarRequestDraft>
  const contact = (typeof raw.contact === 'object' && raw.contact !== null ? raw.contact : {}) as Partial<CarRequestDraft['contact']>
  const tripType = raw.tripType === 'One Way' || raw.tripType === 'Round Trip' ? raw.tripType : ''
  const currency = raw.currency === 'EUR' || raw.currency === 'EGP' ? raw.currency : 'USD'
  const slug = typeof raw.vehicleSlug === 'string' ? raw.vehicleSlug.trim().slice(0, 80) : ''
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null
  const passengers = typeof raw.passengers === 'number' ? raw.passengers : Number(raw.passengers)
  if (!Number.isSafeInteger(passengers) || passengers < 1 || passengers > 50) return null
  return {
    vehicleSlug: slug,
    tripType,
    pickup: typeof raw.pickup === 'string' ? raw.pickup.slice(0, 160) : '',
    dropoff: typeof raw.dropoff === 'string' ? raw.dropoff.slice(0, 160) : '',
    preferredPickupDate: typeof raw.preferredPickupDate === 'string' ? raw.preferredPickupDate.slice(0, 10) : '',
    preferredReturnDate: tripType === 'Round Trip' && typeof raw.preferredReturnDate === 'string' ? raw.preferredReturnDate.slice(0, 10) : '',
    passengers,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 1000) : '',
    contact: {
      fullName: typeof contact.fullName === 'string' ? contact.fullName.slice(0, 80) : '',
      email: typeof contact.email === 'string' ? contact.email.slice(0, 120) : '',
      phone: typeof contact.phone === 'string' ? contact.phone.slice(0, 24) : '',
    },
    currency,
  }
}

function sanitizeAmendment(value: unknown): CarRequestAmendment | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<CarRequestAmendment>
  if (typeof raw.amendmentRef !== 'string' || !/^AM-[0-9A-Z]{1,16}$/.test(raw.amendmentRef)) return null
  if (typeof raw.requestRef !== 'string' || !raw.requestRef) return null
  const proposed = sanitizeProposed(raw.proposed)
  if (!proposed) return null
  const status: AmendmentStatus = raw.status === 'draft' || raw.status === 'pending' || raw.status === 'approved' || raw.status === 'rejected'
    ? raw.status
    : 'draft'
  const changedFields = Array.isArray(raw.changedFields)
    ? raw.changedFields.filter(isAmendableField)
    : []
  if (!changedFields.length) return null
  return {
    amendmentRef: raw.amendmentRef,
    requestRef: raw.requestRef.slice(0, 40),
    proposed,
    changedFields,
    note: safeText(raw.note, NOTE_MAX),
    status,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt.slice(0, 40) : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt.slice(0, 40) : '',
    decidedAt: typeof raw.decidedAt === 'string' && raw.decidedAt ? raw.decidedAt.slice(0, 40) : undefined,
    decisionReason: typeof raw.decisionReason === 'string' && raw.decisionReason ? raw.decisionReason.slice(0, 1000) : undefined,
    history: sanitizeHistory(raw.history),
  }
}

function emptyStore(): AmendmentsStore {
  return { version: 1, amendments: [] }
}

export function readAmendmentsStore(): AmendmentsStore {
  if (typeof window === 'undefined') return emptyStore()
  try {
    const raw = window.localStorage.getItem(CAR_AMENDMENTS_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<AmendmentsStore>
    if (parsed.version !== AMENDMENTS_VERSION || !Array.isArray(parsed.amendments)) return emptyStore()
    return {
      version: 1,
      amendments: parsed.amendments
        .map(sanitizeAmendment)
        .filter((entry): entry is CarRequestAmendment => entry !== null)
        .slice(0, 50),
    }
  } catch {
    return emptyStore()
  }
}

function writeAmendmentsStore(store: AmendmentsStore) {
  try {
    window.localStorage.setItem(CAR_AMENDMENTS_KEY, JSON.stringify(store))
  } catch {
    // Overlay stays in memory only when storage is unavailable.
  }
  emitAmendmentsChange()
}

export function listAmendments(store?: AmendmentsStore): CarRequestAmendment[] {
  return (store ?? readAmendmentsStore()).amendments
}

export function findAmendment(amendmentRef: string, store?: AmendmentsStore): CarRequestAmendment | null {
  return listAmendments(store).find((entry) => entry.amendmentRef === amendmentRef) ?? null
}

export function amendmentsForRequest(requestRef: string, store?: AmendmentsStore): CarRequestAmendment[] {
  return listAmendments(store).filter((entry) => entry.requestRef === requestRef)
}

export function pendingAmendmentFor(requestRef: string, store?: AmendmentsStore): CarRequestAmendment | null {
  return amendmentsForRequest(requestRef, store).find((entry) => entry.status === 'pending') ?? null
}

/** Before/after diff over customer-editable fields. Empty = nothing changed. */
export function diffCarDrafts(original: CarRequestDraft, proposed: CarRequestDraft): AmendableField[] {  const changed: AmendableField[] = []
  if (original.vehicleSlug !== proposed.vehicleSlug) changed.push('vehicle')
  if (original.tripType !== proposed.tripType) changed.push('tripType')
  if (original.pickup.trim() !== proposed.pickup.trim()) changed.push('pickup')
  if (original.dropoff.trim() !== proposed.dropoff.trim()) changed.push('dropoff')
  if (original.preferredPickupDate !== proposed.preferredPickupDate) changed.push('pickupDate')
  if ((original.preferredReturnDate || '') !== (proposed.preferredReturnDate || '')) changed.push('returnDate')
  if (original.passengers !== proposed.passengers) changed.push('passengers')
  if (original.contact.fullName.trim() !== proposed.contact.fullName.trim()) changed.push('fullName')
  if (original.contact.email.trim() !== proposed.contact.email.trim()) changed.push('email')
  if (original.contact.phone.trim() !== proposed.contact.phone.trim()) changed.push('phone')
  if (original.notes !== proposed.notes) changed.push('notes')
  return changed
}

export type SaveAmendmentInput = {
  requestRef: string
  proposed: CarRequestDraft
  changedFields: AmendableField[]
  note?: string
  status: 'draft' | 'pending'
  /** When set, updates that draft instead of creating a new amendment. */
  amendmentRef?: string
}

export type AmendmentError =
  | 'no-changes'
  | 'unknown-amendment'
  | 'not-editable'
  | 'pending-exists'
  | 'original-missing'
  | 'reason-required'

/**
 * Creates (or re-saves) a customer amendment. Never touches `sp-car-request-v1`.
 * Enforces: non-empty diff, single pending per request, drafts editable only.
 */
export function saveAmendment(input: SaveAmendmentInput): { amendment: CarRequestAmendment } | { error: AmendmentError } {
  if (!input.changedFields.length) return { error: 'no-changes' }
  const store = readAmendmentsStore()
  const now = new Date().toISOString()
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, NOTE_MAX) : ''

  if (input.amendmentRef) {
    const existing = store.amendments.find((entry) => entry.amendmentRef === input.amendmentRef)
    if (!existing) return { error: 'unknown-amendment' }
    if (existing.status !== 'draft') return { error: 'not-editable' }
    if (input.status === 'pending' && store.amendments.some((entry) => entry.requestRef === existing.requestRef && entry.status === 'pending')) {
      return { error: 'pending-exists' }
    }
    const updated: CarRequestAmendment = {
      ...existing,
      proposed: input.proposed,
      changedFields: input.changedFields,
      note,
      status: input.status,
      updatedAt: now,
      history: [
        ...existing.history,
        ...(input.status === 'pending'
          ? [{ id: makeId('ah'), kind: 'submitted' as const, at: now, by: 'customer' as const }]
          : []),
      ],
    }
    return {
      amendment: commitAmendment(updated),
    }
  }

  if (input.status === 'pending' && pendingAmendmentFor(input.requestRef, store)) {
    return { error: 'pending-exists' }
  }
  const taken = new Set(store.amendments.map((entry) => entry.amendmentRef))
  const amendment: CarRequestAmendment = {
    amendmentRef: makeAmendmentRef(taken),
    requestRef: input.requestRef,
    proposed: input.proposed,
    changedFields: input.changedFields,
    note,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    history: [
      { id: makeId('ah'), kind: 'created', at: now, by: 'customer' },
      ...(input.status === 'pending' ? [{ id: makeId('ah'), kind: 'submitted' as const, at: now, by: 'customer' as const }] : []),
    ],
  }
  return { amendment: commitAmendment(amendment) }
}

function commitAmendment(amendment: CarRequestAmendment): CarRequestAmendment {
  const store = readAmendmentsStore()
  const next = [amendment, ...store.amendments.filter((entry) => entry.amendmentRef !== amendment.amendmentRef)].slice(0, 50)
  writeAmendmentsStore({ version: 1, amendments: next })
  return amendment
}

/** Customer submit draft → pending. Guards the single-pending rule. */
export function submitAmendment(amendmentRef: string): { amendment: CarRequestAmendment } | { error: AmendmentError } {
  const store = readAmendmentsStore()
  const existing = store.amendments.find((entry) => entry.amendmentRef === amendmentRef)
  if (!existing) return { error: 'unknown-amendment' }
  if (existing.status !== 'draft') return { error: 'not-editable' }
  if (pendingAmendmentFor(existing.requestRef, store)) return { error: 'pending-exists' }
  const now = new Date().toISOString()
  return {
    amendment: commitAmendment({
      ...existing,
      status: 'pending',
      updatedAt: now,
      history: [...existing.history, { id: makeId('ah'), kind: 'submitted', at: now, by: 'customer' }],
    }),
  }
}

/** Discards a DRAFT only. Pending/approved/rejected history is never deleted here. */
export function discardAmendmentDraft(amendmentRef: string): { ok: true } | { error: AmendmentError } {
  const store = readAmendmentsStore()
  const existing = store.amendments.find((entry) => entry.amendmentRef === amendmentRef)
  if (!existing) return { error: 'unknown-amendment' }
  if (existing.status !== 'draft') return { error: 'not-editable' }
  writeAmendmentsStore({ version: 1, amendments: store.amendments.filter((entry) => entry.amendmentRef !== amendmentRef) })
  return { ok: true }
}

export type StaffDecision = { action: 'approve' | 'reject'; reason?: string }

/**
 * Staff (demo) decision on a pending amendment. Writes ONLY the amendments
 * key — never `sp-car-request-v1`, never admin ops. Approval takes effect
 * through `getCustomerEffectiveCarRequest`, the single isolated adapter the
 * backend will later replace.
 */
export function decideAmendment(amendmentRef: string, decision: StaffDecision): { amendment: CarRequestAmendment } | { error: AmendmentError } {
  const store = readAmendmentsStore()
  const existing = store.amendments.find((entry) => entry.amendmentRef === amendmentRef)
  if (!existing) return { error: 'unknown-amendment' }
  if (existing.status !== 'pending') return { error: 'not-editable' }
  const reason = typeof decision.reason === 'string' ? decision.reason.trim().slice(0, 1000) : ''
  if (decision.action === 'reject' && !reason) return { error: 'reason-required' }
  const now = new Date().toISOString()
  return {
    amendment: commitAmendment({
      ...existing,
      status: decision.action === 'approve' ? 'approved' : 'rejected',
      updatedAt: now,
      decidedAt: now,
      decisionReason: reason || undefined,
      history: [
        ...existing.history,
        { id: makeId('ah'), kind: decision.action === 'approve' ? 'approved' : 'rejected', at: now, by: 'staff', note: reason || undefined },
      ],
    }),
  }
}

export type EffectiveCustomerCarRequest = {
  preview: CarRequestPreview
  /** Original stored draft — never rewritten by amendments. */
  originalDraft: CarRequestDraft
  /** True when a demo-approved amendment overrides the view. */
  amended: boolean
  amendmentRef?: string
}

/**
 * Isolated prototype adapter: computes the customer-facing request view.
 * Original storage is read-only here; an approved amendment only overrides
 * the returned draft. The backend replaces this function — callers stay.
 */
export function getCustomerEffectiveCarRequest(store?: AmendmentsStore): EffectiveCustomerCarRequest | null {
  const preview = readCarPreview()
  if (!preview) return null
  const approved = listAmendments(store)
    .filter((entry) => entry.requestRef === preview.localRef && entry.status === 'approved')
    .sort((a, b) => (b.decidedAt ?? b.updatedAt).localeCompare(a.decidedAt ?? a.updatedAt))[0]
  if (!approved) return { preview, originalDraft: preview.draft, amended: false }
  return {
    preview: { draft: approved.proposed, localRef: preview.localRef },
    originalDraft: preview.draft,
    amended: true,
    amendmentRef: approved.amendmentRef,
  }
}

/** Reactive amendments list (same-tab events + cross-tab storage events). */
export function useAmendments(): CarRequestAmendment[] {
  const [items, setItems] = useState<CarRequestAmendment[]>([])
  useEffect(() => {
    const sync = () => setItems(listAmendments())
    sync()
    window.addEventListener(AMENDMENT_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(AMENDMENT_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return items
}

/**
 * Reactive customer-effective request: original preview plus the latest
 * demo-approved override, if any. Null when no local preview exists.
 */
export function useCustomerEffectiveCarRequest(): EffectiveCustomerCarRequest | null {
  const [store, setStore] = useState<AmendmentsStore>(() => emptyStore())
  useEffect(() => {
    const sync = () => setStore(readAmendmentsStore())
    sync()
    window.addEventListener(AMENDMENT_EVENT, sync)
    window.addEventListener('storage', sync)
    window.addEventListener('sp-car-request', sync)
    return () => {
      window.removeEventListener(AMENDMENT_EVENT, sync)
      window.removeEventListener('storage', sync)
      window.removeEventListener('sp-car-request', sync)
    }
  }, [])
  if (typeof window === 'undefined') return null
  return getCustomerEffectiveCarRequest(store)
}

/** Shared bilingual labels (customer + admin reuse; no JSX so lib stays UI-free). */
export const AMENDMENT_STATUS_COPY: Record<AmendmentStatus, { en: string; ar: string }> = {
  draft: { en: 'Draft', ar: 'مسودة' },
  pending: { en: 'Pending review', ar: 'قيد المراجعة' },
  approved: { en: 'Approved', ar: 'تمت الموافقة' },
  rejected: { en: 'Rejected', ar: 'مرفوض' },
}

export const AMENDABLE_FIELD_COPY: Record<AmendableField, { en: string; ar: string }> = {
  vehicle: { en: 'Preferred vehicle', ar: 'السيارة المفضلة' },
  tripType: { en: 'Trip type', ar: 'نوع الرحلة' },
  pickup: { en: 'Pickup', ar: 'نقطة الانطلاق' },
  dropoff: { en: 'Drop-off', ar: 'الوجهة' },
  pickupDate: { en: 'Pick-up date', ar: 'تاريخ الانطلاق' },
  returnDate: { en: 'Return date', ar: 'تاريخ العودة' },
  passengers: { en: 'Passengers', ar: 'المسافرون' },
  fullName: { en: 'Full name', ar: 'الاسم الكامل' },
  email: { en: 'Email', ar: 'البريد الإلكتروني' },
  phone: { en: 'Phone', ar: 'رقم الهاتف' },
  notes: { en: 'Additional notes', ar: 'ملاحظات إضافية' },
}

/** Raw draft value for a diff field (vehicle stays a slug; UI resolves titles). */
export function amendmentFieldValue(field: AmendableField, draft: CarRequestDraft): string {
  switch (field) {
    case 'vehicle': return draft.vehicleSlug
    case 'tripType': return draft.tripType === '' ? '—' : draft.tripType
    case 'pickup': return draft.pickup
    case 'dropoff': return draft.dropoff
    case 'pickupDate': return draft.preferredPickupDate || '—'
    case 'returnDate': return draft.preferredReturnDate || '—'
    case 'passengers': return String(draft.passengers)
    case 'fullName': return draft.contact.fullName
    case 'email': return draft.contact.email
    case 'phone': return draft.contact.phone
    case 'notes': return draft.notes || '—'
  }
}
