import { useEffect, useState } from 'react'
import { demoCarRequests, type AdminCarRequest, type AdminCarRequestStatus } from '@/components/admin/car-requests-data'

/**
 * Admin Car Request operations — LOCAL DEMO OVERLAY ONLY.
 *
 * Boundary rules (non-negotiable):
 * - This module NEVER imports `lib/car-request.ts`.
 * - This module NEVER reads or writes `sp-car-request-v1` (customer preview).
 * - Fixtures in `components/admin/car-requests-data.ts` are the immutable base.
 * - Only admin demo overlays (status, assignment, notes, activity, cancel
 *   reason) are stored here, under the versioned key `sp-car-request-ops-v1`.
 * - Every status value produced here is a demo workflow state. It does not
 *   reserve a vehicle, confirm availability, create a rental, notify the
 *   customer, or process payment. Dialog copy must say so.
 *
 * Malformed or stale storage fails safely back to fixture state.
 */

export const CAR_REQUEST_OPS_KEY = 'sp-car-request-ops-v1'
const OPS_VERSION = 1

export const CANCEL_REASON_IDS = [
  'withdrawn',
  'dates-changed',
  'vehicle-unavailable-demo',
  'duplicate',
  'other',
] as const

export type CancelReasonId = (typeof CANCEL_REASON_IDS)[number]

export type OpsAction = 'start-review' | 'confirm' | 'cancel' | 'reopen'

export type OpsActivityKind =
  | 'fixture-loaded'
  | 'review-started'
  | 'assigned-vehicle-changed'
  | 'note-added'
  | 'note-edited'
  | 'cancelled'
  | 'reopened'
  | 'confirmed'

export type OpsActivity = {
  id: string
  kind: OpsActivityKind
  /** Browser-local ISO timestamp for local events; fixture date label for seeds. */
  at: string
  /** True only for the fixture seed. Everything else is browser-local demo state. */
  fixture?: boolean
  note?: string
  /** Free-text detail (e.g. custom cancel note). Rendered verbatim. */
  detail?: string
}

export type OpsNote = {
  id: string
  text: string
  at: string
  updatedAt?: string
}

export type RequestOps = {
  status?: AdminCarRequestStatus
  assignedVehicleSlug?: string
  cancelReasonId?: CancelReasonId
  cancelNote?: string
  notes: OpsNote[]
  activity: OpsActivity[]
}

export type OpsStore = {
  version: 1
  requests: Record<string, RequestOps>
}

export type EffectiveCarRequest = AdminCarRequest & {
  status: AdminCarRequestStatus
  /** Admin demo selection. Defaults to the requested vehicle until changed. */
  assignedVehicleSlug: string
  assignmentTouched: boolean
  cancelReasonId?: CancelReasonId
  cancelNote?: string
  /** Staff-only overlay notes. Fixture enquiry text stays on `notes`. */
  internalNotes: OpsNote[]
  activity: OpsActivity[]
}

const VALID_STATUSES: readonly AdminCarRequestStatus[] = ['new', 'reviewing', 'confirmed', 'cancelled']

/** Display cap for overlay free text (notes, reasons). Enforced on write. */
export const OPS_TEXT_MAX = 2000

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}

function safeText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, max)
}

function sanitizeActivity(value: unknown): OpsActivity[] {
  if (!Array.isArray(value)) return []
  const kinds: readonly string[] = ['fixture-loaded', 'review-started', 'assigned-vehicle-changed', 'note-added', 'note-edited', 'cancelled', 'reopened', 'confirmed']
  return value
    .filter((entry): entry is OpsActivity => typeof entry === 'object' && entry !== null)
    .map((entry): OpsActivity | null => {
      const raw = entry as Partial<OpsActivity>
      if (!kinds.includes(raw.kind ?? '')) return null
      if (typeof raw.id !== 'string' || !raw.id || typeof raw.at !== 'string' || !raw.at) return null
      return {
        id: raw.id.slice(0, 80),
        kind: raw.kind as OpsActivityKind,
        at: raw.at.slice(0, 40),
        fixture: raw.fixture === true ? true : undefined,
        note: typeof raw.note === 'string' && raw.note ? safeText(raw.note, OPS_TEXT_MAX) : undefined,
        detail: typeof raw.detail === 'string' && raw.detail ? safeText(raw.detail, OPS_TEXT_MAX) : undefined,
      }
    })
    .filter((entry): entry is OpsActivity => entry !== null)
    .slice(0, 200)
}

function sanitizeNotes(value: unknown): OpsNote[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is OpsNote => typeof entry === 'object' && entry !== null)
    .map((entry): OpsNote | null => {
      const raw = entry as Partial<OpsNote>
      if (typeof raw.id !== 'string' || !raw.id || typeof raw.text !== 'string' || !raw.text.trim()) return null
      return {
        id: raw.id.slice(0, 80),
        text: safeText(raw.text.trim(), OPS_TEXT_MAX),
        at: typeof raw.at === 'string' ? raw.at.slice(0, 40) : '',
        updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt.slice(0, 40) : undefined,
      }
    })
    .filter((entry): entry is OpsNote => entry !== null)
    .slice(0, 200)
}

function sanitizeOps(value: unknown): RequestOps {
  const empty: RequestOps = { notes: [], activity: [] }
  if (typeof value !== 'object' || value === null) return empty
  const raw = value as Partial<RequestOps>
  const status = VALID_STATUSES.includes(raw.status as AdminCarRequestStatus) ? (raw.status as AdminCarRequestStatus) : undefined
  const assignedVehicleSlug = typeof raw.assignedVehicleSlug === 'string' && /^[a-z0-9-]{1,80}$/.test(raw.assignedVehicleSlug)
    ? raw.assignedVehicleSlug
    : undefined
  const cancelReasonId = (CANCEL_REASON_IDS as readonly string[]).includes(raw.cancelReasonId ?? '')
    ? (raw.cancelReasonId as CancelReasonId)
    : undefined
  return {
    ...(status ? { status } : {}),
    ...(assignedVehicleSlug ? { assignedVehicleSlug } : {}),
    ...(cancelReasonId ? { cancelReasonId } : {}),
    ...(typeof raw.cancelNote === 'string' && raw.cancelNote ? { cancelNote: safeText(raw.cancelNote, OPS_TEXT_MAX) } : {}),
    notes: sanitizeNotes(raw.notes),
    activity: sanitizeActivity(raw.activity),
  }
}

function emptyStore(): OpsStore {
  return { version: 1, requests: {} }
}

export function readOpsStore(): OpsStore {
  if (typeof window === 'undefined') return emptyStore()
  try {
    const raw = window.localStorage.getItem(CAR_REQUEST_OPS_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<OpsStore>
    if (parsed.version !== OPS_VERSION || typeof parsed.requests !== 'object' || parsed.requests === null) return emptyStore()
    const requests: Record<string, RequestOps> = {}
    for (const [ref, ops] of Object.entries(parsed.requests)) {
      if (/^DEMO-CR-[0-9A-Z-]{1,16}$/.test(ref)) requests[ref] = sanitizeOps(ops)
    }
    return { version: 1, requests }
  } catch {
    return emptyStore()
  }
}

function writeOpsStore(store: OpsStore) {
  try {
    window.localStorage.setItem(CAR_REQUEST_OPS_KEY, JSON.stringify(store))
    window.dispatchEvent(new Event('sp-car-request-ops'))
  } catch {
    // Overlay stays in memory only when storage is unavailable.
  }
}

function seedActivity(fixture: AdminCarRequest): OpsActivity {
  return {
    id: `${fixture.ref}-fixture`,
    kind: 'fixture-loaded',
    at: fixture.receivedOn,
    fixture: true,
  }
}

/** Merge fixture base with the local demo overlay. Fixtures always win as the base. */
export function getEffectiveRequest(ref: string, store: OpsStore): EffectiveCarRequest | null {
  const fixture = demoCarRequests.find((row) => row.ref === ref)
  if (!fixture) return null
  const ops = store.requests[ref] ? sanitizeOps(store.requests[ref]) : sanitizeOps(undefined)
  return {
    ...fixture,
    status: ops.status ?? fixture.status,
    assignedVehicleSlug: ops.assignedVehicleSlug ?? fixture.vehicleSlug,
    assignmentTouched: ops.assignedVehicleSlug !== undefined,
    ...(ops.cancelReasonId ? { cancelReasonId: ops.cancelReasonId } : {}),
    ...(ops.cancelNote ? { cancelNote: ops.cancelNote } : {}),
    internalNotes: ops.notes,
    activity: [seedActivity(fixture), ...ops.activity],
  }
}

export function getEffectiveRequests(store: OpsStore): EffectiveCarRequest[] {
  return demoCarRequests
    .map((row) => getEffectiveRequest(row.ref, store))
    .filter((row): row is EffectiveCarRequest => row !== null)
}

export function allowedActions(status: AdminCarRequestStatus): OpsAction[] {
  if (status === 'new') return ['start-review', 'cancel']
  if (status === 'reviewing') return ['confirm', 'cancel']
  if (status === 'cancelled') return ['reopen']
  return []
}

export type TransitionError =
  | 'unknown-request'
  | 'not-allowed'
  | 'terminal'
  | 'assignment-required'
  | 'reason-required'

export type TransitionInput = {
  reasonId?: string
  reasonNote?: string
}

/**
 * Single guarded transition implementation shared by the list quick action
 * and the detail action bar. Never duplicated in page components.
 */
export function applyTransition(
  store: OpsStore,
  ref: string,
  action: OpsAction,
  input?: TransitionInput,
): { store: OpsStore } | { error: TransitionError } {
  const current = getEffectiveRequest(ref, store)
  if (!current) return { error: 'unknown-request' }
  if (!allowedActions(current.status).includes(action)) {
    return { error: current.status === 'confirmed' ? 'terminal' : 'not-allowed' }
  }

  const ops: RequestOps = {
    ...(current.status !== getFixtureStatus(ref) ? { status: current.status } : {}),
    ...(current.assignmentTouched ? { assignedVehicleSlug: current.assignedVehicleSlug } : {}),
    ...(current.cancelReasonId ? { cancelReasonId: current.cancelReasonId } : {}),
    ...(current.cancelNote ? { cancelNote: current.cancelNote } : {}),
    notes: current.internalNotes,
    activity: current.activity.filter((entry) => !entry.fixture),
  }

  const push = (kind: OpsActivityKind, note?: string, detail?: string) => {
    ops.activity = [...ops.activity, { id: makeId('act'), kind, at: new Date().toISOString(), ...(note ? { note } : {}), ...(detail ? { detail } : {}) }]
  }

  if (action === 'start-review') {
    ops.status = 'reviewing'
    push('review-started')
  } else if (action === 'confirm') {
    if (!current.assignedVehicleSlug) return { error: 'assignment-required' }
    ops.status = 'confirmed'
    // A confirmed request keeps its cancel fields cleared.
    delete ops.cancelReasonId
    delete ops.cancelNote
    push('confirmed')
  } else if (action === 'cancel') {
    const reasonId = (CANCEL_REASON_IDS as readonly string[]).includes(input?.reasonId ?? '')
      ? (input?.reasonId as CancelReasonId)
      : undefined
    if (!reasonId) return { error: 'reason-required' }
    const reasonNote = typeof input?.reasonNote === 'string' ? input.reasonNote.trim().slice(0, OPS_TEXT_MAX) : ''
    if (reasonId === 'other' && !reasonNote) return { error: 'reason-required' }
    ops.status = 'cancelled'
    ops.cancelReasonId = reasonId
    if (reasonNote) ops.cancelNote = reasonNote
    else delete ops.cancelNote
    push('cancelled', reasonId, reasonNote || undefined)
  } else {
    ops.status = 'reviewing'
    // Reopen clears the *current* cancel reason; historical activity keeps it.
    delete ops.cancelReasonId
    delete ops.cancelNote
    push('reopened')
  }

  return { store: { version: 1, requests: { ...store.requests, [ref]: ops } } }
}

function getFixtureStatus(ref: string): AdminCarRequestStatus | undefined {
  return demoCarRequests.find((row) => row.ref === ref)?.status
}

export function setAssignment(
  store: OpsStore,
  ref: string,
  vehicleSlug: string,
): { store: OpsStore } | { error: TransitionError } {
  const current = getEffectiveRequest(ref, store)
  if (!current) return { error: 'unknown-request' }
  if (current.status === 'confirmed') return { error: 'terminal' }
  if (!/^[a-z0-9-]{1,80}$/.test(vehicleSlug)) return { error: 'not-allowed' }
  if (current.assignedVehicleSlug === vehicleSlug && current.assignmentTouched) return { store }
  const vehicleName = vehicleSlug
  const ops: RequestOps = {
    ...(current.status !== getFixtureStatus(ref) ? { status: current.status } : {}),
    assignedVehicleSlug: vehicleSlug,
    ...(current.cancelReasonId ? { cancelReasonId: current.cancelReasonId } : {}),
    ...(current.cancelNote ? { cancelNote: current.cancelNote } : {}),
    notes: current.internalNotes,
    activity: [...current.activity.filter((entry) => !entry.fixture), { id: makeId('act'), kind: 'assigned-vehicle-changed', at: new Date().toISOString(), note: vehicleName }],
  }
  return { store: { version: 1, requests: { ...store.requests, [ref]: ops } } }
}

export function addInternalNote(
  store: OpsStore,
  ref: string,
  text: string,
): { store: OpsStore } | { error: TransitionError } {
  const current = getEffectiveRequest(ref, store)
  if (!current) return { error: 'unknown-request' }
  const clean = text.trim().slice(0, OPS_TEXT_MAX)
  if (!clean) return { error: 'not-allowed' }
  const note: OpsNote = { id: makeId('note'), text: clean, at: new Date().toISOString() }
  const ops: RequestOps = {
    ...(current.status !== getFixtureStatus(ref) ? { status: current.status } : {}),
    ...(current.assignmentTouched ? { assignedVehicleSlug: current.assignedVehicleSlug } : {}),
    ...(current.cancelReasonId ? { cancelReasonId: current.cancelReasonId } : {}),
    ...(current.cancelNote ? { cancelNote: current.cancelNote } : {}),
    notes: [...current.internalNotes, note],
    activity: [...current.activity.filter((entry) => !entry.fixture), { id: makeId('act'), kind: 'note-added', at: note.at, note: clean.slice(0, 160) }],
  }
  return { store: { version: 1, requests: { ...store.requests, [ref]: ops } } }
}

export function editInternalNote(
  store: OpsStore,
  ref: string,
  noteId: string,
  text: string,
): { store: OpsStore } | { error: TransitionError } {
  const current = getEffectiveRequest(ref, store)
  if (!current) return { error: 'unknown-request' }
  const clean = text.trim().slice(0, OPS_TEXT_MAX)
  if (!clean || !current.internalNotes.some((note) => note.id === noteId)) return { error: 'not-allowed' }
  const editedAt = new Date().toISOString()
  const ops: RequestOps = {
    ...(current.status !== getFixtureStatus(ref) ? { status: current.status } : {}),
    ...(current.assignmentTouched ? { assignedVehicleSlug: current.assignedVehicleSlug } : {}),
    ...(current.cancelReasonId ? { cancelReasonId: current.cancelReasonId } : {}),
    ...(current.cancelNote ? { cancelNote: current.cancelNote } : {}),
    notes: current.internalNotes.map((note) => (note.id === noteId ? { ...note, text: clean, updatedAt: editedAt } : note)),
    activity: [...current.activity.filter((entry) => !entry.fixture), { id: makeId('act'), kind: 'note-edited', at: editedAt, note: clean.slice(0, 160) }],
  }
  return { store: { version: 1, requests: { ...store.requests, [ref]: ops } } }
}

export function resetRequestOps(store: OpsStore, ref: string): OpsStore {
  const requests = { ...store.requests }
  delete requests[ref]
  return { version: 1, requests }
}

export function resetAllOps(): OpsStore {
  return emptyStore()
}

export function commitStore(store: OpsStore) {
  writeOpsStore(store)
}

/** Read latest, apply one guarded transition, persist. Shared by list + detail. */
export function commitTransition(
  ref: string,
  action: OpsAction,
  input?: TransitionInput,
): { ok: true } | { error: TransitionError } {
  const result = applyTransition(readOpsStore(), ref, action, input)
  if ('error' in result) return result
  commitStore(result.store)
  return { ok: true }
}

/** Read latest, persist one assignment change. Detail only. */
export function commitAssignment(
  ref: string,
  vehicleSlug: string,
): { ok: true } | { error: TransitionError } {
  const result = setAssignment(readOpsStore(), ref, vehicleSlug)
  if ('error' in result) return result
  commitStore(result.store)
  return { ok: true }
}

/** Read latest, persist one internal note. Detail only. */
export function commitNote(
  ref: string,
  text: string,
  noteId?: string,
): { ok: true } | { error: TransitionError } {
  const store = readOpsStore()
  const result = noteId ? editInternalNote(store, ref, noteId, text) : addInternalNote(store, ref, text)
  if ('error' in result) return result
  commitStore(result.store)
  return { ok: true }
}

/** Reactive overlay store. Components derive merged fixture+overlay views from it. */
export function useCarRequestOps(): OpsStore {
  const [store, setStore] = useState<OpsStore>(() => emptyStore())
  useEffect(() => {
    const sync = () => setStore(readOpsStore())
    sync()
    window.addEventListener('sp-car-request-ops', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('sp-car-request-ops', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return store
}
