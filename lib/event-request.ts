'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

export type EventRequestStatus = 'new' | 'reviewing' | 'approved' | 'rejected' | 'cancelled'

export type EventRequestActivity = {
  at: string
  by: 'customer' | 'admin'
  action: string
  note?: string
}

export type EventRequest = {
  localRef: string
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
  status: EventRequestStatus
  createdAt: string
  updatedAt: string
  activity: EventRequestActivity[]
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

const KEY = 'sp-event-requests-v1'
const CHANNEL = 'sp-event-requests'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

let cache: EventRequest[] | null = null
const listeners = new Set<() => void>()

function emit() {
  cache = null
  listeners.forEach((fn) => fn())
  try { window.dispatchEvent(new Event(CHANNEL)) } catch { /* noop */ }
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function sanitizeRequest(value: unknown): EventRequest | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Partial<EventRequest>
  if (typeof r.localRef !== 'string' || !/^EVR-[A-Z0-9]{6,12}$/.test(r.localRef)) return null
  if (typeof r.eventSlug !== 'string' || !r.eventSlug.trim()) return null
  if (typeof r.name !== 'string' || !r.name.trim()) return null
  if (typeof r.email !== 'string' || !EMAIL_PATTERN.test(r.email.trim())) return null
  if (typeof r.phone !== 'string' || !r.phone.trim()) return null
  const attendees = typeof r.attendees === 'number' && Number.isInteger(r.attendees) ? r.attendees : 0
  if (attendees < 1 || attendees > 50) return null
  const status: EventRequestStatus =
    r.status === 'reviewing' || r.status === 'approved' || r.status === 'rejected' || r.status === 'cancelled' ? r.status : 'new'
  if (typeof r.createdAt !== 'string' || typeof r.updatedAt !== 'string') return null
  return {
    localRef: r.localRef,
    eventSlug: r.eventSlug.trim().slice(0, 80),
    eventTitle: typeof r.eventTitle === 'string' ? r.eventTitle.slice(0, 160) : r.eventSlug,
    eventDate: typeof r.eventDate === 'string' ? r.eventDate.slice(0, 120) : '',
    eventLocation: typeof r.eventLocation === 'string' ? r.eventLocation.slice(0, 160) : '',
    name: r.name.trim().slice(0, 80),
    nationality: typeof r.nationality === 'string' ? r.nationality.slice(0, 8) : '',
    dialCode: typeof r.dialCode === 'string' ? r.dialCode.slice(0, 8) : '',
    phone: r.phone.trim().slice(0, 24),
    email: r.email.trim().slice(0, 120),
    attendees,
    note: typeof r.note === 'string' && r.note.trim() ? r.note.trim().slice(0, 1000) : undefined,
    status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    activity: Array.isArray(r.activity)
      ? r.activity.filter((a): a is EventRequestActivity => typeof a === 'object' && a !== null && typeof (a as EventRequestActivity).at === 'string' && typeof (a as EventRequestActivity).action === 'string').slice(0, 50)
      : [],
  }
}

export function readEventRequests(): EventRequest[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: EventRequest[] = []
    for (const entry of parsed) {
      const clean = sanitizeRequest(entry)
      if (clean) out.push(clean)
    }
    return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 200)
  } catch {
    return []
  }
}

function getSnapshot(): EventRequest[] {
  if (cache === null) cache = readEventRequests()
  return cache
}

function persist(list: EventRequest[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200))) } catch { /* storage unavailable */ }
  emit()
}

export function createEventRequestReference(): string {
  const time = Date.now().toString(36).toUpperCase().slice(-6).padStart(6, '0')
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let random = ''
  for (let i = 0; i < 4; i++) random += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `EVR-${time}${random}`
}

export type EventRequestErrors = {
  name?: 'required'
  email?: 'required' | 'invalid'
  phone?: 'required' | 'invalid'
  attendees?: 'required' | 'invalid'
  event?: 'invalid'
}

export function validateEventRequestDraft(draft: EventRequestDraft): EventRequestErrors {
  const errors: EventRequestErrors = {}
  if (!draft.name.trim()) errors.name = 'required'
  if (!draft.email.trim()) errors.email = 'required'
  else if (draft.email.trim().length > 120 || !EMAIL_PATTERN.test(draft.email.trim())) errors.email = 'invalid'
  const digits = draft.phone.replace(/\D/g, '')
  if (!draft.phone.trim()) errors.phone = 'required'
  else if (digits.length < 7 || draft.phone.trim().length > 24) errors.phone = 'invalid'
  if (!Number.isInteger(draft.attendees) || draft.attendees < 1 || draft.attendees > 50) errors.attendees = 'invalid'
  if (!draft.eventSlug.trim()) errors.event = 'invalid'
  return errors
}

export function hasEventRequestErrors(errors: EventRequestErrors) {
  return Boolean(errors.name || errors.email || errors.phone || errors.attendees || errors.event)
}

export function createEventRequest(draft: EventRequestDraft): EventRequest {
  const now = new Date().toISOString()
  const item: EventRequest = {
    localRef: createEventRequestReference(),
    eventSlug: draft.eventSlug.trim(),
    eventTitle: draft.eventTitle.trim().slice(0, 160) || draft.eventSlug.trim(),
    eventDate: draft.eventDate.trim().slice(0, 120),
    eventLocation: draft.eventLocation.trim().slice(0, 160),
    name: draft.name.trim().slice(0, 80),
    nationality: draft.nationality.trim().slice(0, 8),
    dialCode: draft.dialCode.trim().slice(0, 8),
    phone: draft.phone.trim().slice(0, 24),
    email: draft.email.trim().slice(0, 120),
    attendees: Math.max(1, Math.min(50, Math.floor(draft.attendees))),
    note: draft.note?.trim() ? draft.note.trim().slice(0, 1000) : undefined,
    status: 'new',
    createdAt: now,
    updatedAt: now,
    activity: [{ at: now, by: 'customer', action: 'Request submitted locally' }],
  }
  const current = readEventRequests()
  persist([item, ...current.filter((r) => r.localRef !== item.localRef)])
  return item
}

const TRANSITIONS: Record<EventRequestStatus, EventRequestStatus[]> = {
  new: ['reviewing', 'cancelled'],
  reviewing: ['approved', 'rejected', 'cancelled'],
  approved: ['reviewing'],
  rejected: ['reviewing'],
  cancelled: [],
}

export function canTransitionEventRequest(from: EventRequestStatus, to: EventRequestStatus) {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function transitionEventRequest(localRef: string, to: EventRequestStatus, by: 'customer' | 'admin', note?: string): EventRequest | null {
  const current = readEventRequests()
  const found = current.find((r) => r.localRef === localRef)
  if (!found || !canTransitionEventRequest(found.status, to)) return null
  const now = new Date().toISOString()
  const next: EventRequest = {
    ...found,
    status: to,
    updatedAt: now,
    activity: [...found.activity, { at: now, by, action: `${found.status} → ${to}`, note: note?.slice(0, 300) }].slice(-50),
  }
  persist(current.map((r) => (r.localRef === localRef ? next : r)))
  return next
}

export function cancelEventRequest(localRef: string): EventRequest | null {
  return transitionEventRequest(localRef, 'cancelled', 'customer')
}

const EMPTY_REQUESTS: EventRequest[] = []

export function useEventRequests(): EventRequest[] {
  const list = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_REQUESTS)
  useEffect(() => {
    const sync = () => { cache = null; listeners.forEach((fn) => fn()) }
    // Prime from storage on mount (SSR snapshot is []).
    sync()
    window.addEventListener(CHANNEL, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANNEL, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return list
}

export function useEventRequest(localRef: string): EventRequest | undefined {
  const [item, setItem] = useState<EventRequest | undefined>(undefined)
  useEffect(() => {
    const sync = () => setItem(readEventRequests().find((r) => r.localRef === localRef))
    sync()
    window.addEventListener(CHANNEL, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANNEL, sync)
      window.removeEventListener('storage', sync)
    }
  }, [localRef])
  return item
}

export function requestsForEventSlug(list: readonly EventRequest[], slug: string) {
  return list.filter((r) => r.eventSlug === slug)
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
