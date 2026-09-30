'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { readOverrides } from '@/lib/admin-store'

/**
 * Browser-local pending-customer stubs for the Make Your Trip flow.
 *
 * This module is deliberately NOT part of the admin customer directory
 * (`AdminCustomer` in `@/lib/admin-store`), which models staff-managed CRM
 * records. A stub here represents one thing only: an email address seen on a
 * trip request that did not match a known local customer, kept so the same
 * browser can list, complete, and link that identity later.
 *
 * Honesty rules enforced by this module:
 * - no passwords are collected or stored, ever;
 * - `pending` never means verified; completion flips to `active-local`,
 *   which is still explicitly browser-local, never `verified`;
 * - one stub per lowercase email, case-insensitive dedupe;
 * - stubs never expose data belonging to anyone else.
 *
 * Future backend mapping: `customers` rows with `status = 'pending'` plus
 * `account_activation_tokens` when the auth service exists.
 */

export type PendingCustomerStatus = 'pending' | 'active-local'

export type PendingCustomer = {
  /** Stable local id (`tpc-…`). Never a server id. */
  id: string
  /** Lowercase normalized email. The only dedupe key. */
  email: string
  name: string
  phone: string
  dialCode: string
  nationality: string
  status: PendingCustomerStatus
  /** Always `trip-request` today; kept so future sources stay distinguishable. */
  source: 'trip-request'
  createdAt: string
  updatedAt: string
}

export type PendingCustomerInput = {
  email: string
  name?: string
  phone?: string
  dialCode?: string
  nationality?: string
}

const KEY = 'sp-trip-customers-v1'
const CHANNEL = 'sp-trip-customers'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

let cache: PendingCustomer[] | null = null
const EMPTY_CUSTOMERS: PendingCustomer[] = []
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

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function isValidEmail(value: string): boolean {
  return value.length <= 120 && EMAIL_PATTERN.test(value)
}

function makeCustomerId(taken: Set<string>): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let id = ''
  do {
    const time = Date.now().toString(36).toUpperCase().slice(-6).padStart(6, '0')
    let random = ''
    for (let i = 0; i < 4; i++) random += alphabet[Math.floor(Math.random() * alphabet.length)]
    id = `TPC-${time}${random}`
  } while (taken.has(id))
  return id
}

function sanitizeCustomer(value: unknown): PendingCustomer | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<PendingCustomer>
  if (typeof raw.id !== 'string' || !/^TPC-[A-Z0-9]{6,12}$/.test(raw.id)) return null
  const email = normalizeEmail(raw.email)
  if (!isValidEmail(email)) return null
  const status: PendingCustomerStatus = raw.status === 'active-local' ? 'active-local' : 'pending'
  if (typeof raw.createdAt !== 'string' || !raw.createdAt || typeof raw.updatedAt !== 'string' || !raw.updatedAt) return null
  return {
    id: raw.id,
    email,
    name: typeof raw.name === 'string' ? raw.name.trim().slice(0, 80) : '',
    phone: typeof raw.phone === 'string' ? raw.phone.trim().slice(0, 24) : '',
    dialCode: typeof raw.dialCode === 'string' ? raw.dialCode.trim().slice(0, 8) : '',
    nationality: typeof raw.nationality === 'string' ? raw.nationality.trim().slice(0, 40) : '',
    status,
    source: 'trip-request',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

function readStored(): PendingCustomer[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: PendingCustomer[] = []
    for (const entry of parsed) {
      const clean = sanitizeCustomer(entry)
      // Dedupe defensively: first record wins per email.
      if (clean && !out.some((item) => item.email === clean.email)) out.push(clean)
    }
    return out.slice(0, 200)
  } catch {
    return []
  }
}

function getSnapshot(): PendingCustomer[] {
  if (cache === null) cache = readStored()
  return cache
}

function persist(list: PendingCustomer[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200))) } catch { /* storage can be unavailable */ }
  emit()
}

export function listPendingCustomers(): PendingCustomer[] {
  return [...getSnapshot()]
}

export function findPendingCustomerByEmail(email: string): PendingCustomer | undefined {
  const needle = normalizeEmail(email)
  if (!needle) return undefined
  return getSnapshot().find((item) => item.email === needle)
}

export function getPendingCustomer(id: string): PendingCustomer | undefined {
  return getSnapshot().find((item) => item.id === id)
}

/**
 * Return the stub for an email, creating a `pending` one when absent.
 * Never duplicates: one stub per lowercase email.
 */
export function ensurePendingCustomer(input: PendingCustomerInput): { customer: PendingCustomer; created: boolean } {
  const email = normalizeEmail(input.email)
  const existing = findPendingCustomerByEmail(email)
  if (existing) return { customer: existing, created: false }
  const now = new Date().toISOString()
  const customer: PendingCustomer = {
    id: makeCustomerId(new Set(getSnapshot().map((item) => item.id))),
    email,
    name: (input.name ?? '').trim().slice(0, 80),
    phone: (input.phone ?? '').trim().slice(0, 24),
    dialCode: (input.dialCode ?? '').trim().slice(0, 8),
    nationality: (input.nationality ?? '').trim().slice(0, 40),
    status: 'pending',
    source: 'trip-request',
    createdAt: now,
    updatedAt: now,
  }
  persist([customer, ...getSnapshot()])
  return { customer, created: true }
}

/**
 * Complete a pending stub with profile fields. Flips `pending` to
 * `active-local` (still explicitly browser-local, never verified).
 * Collects no password; see the completion UX for the backend note.
 */
export function completePendingCustomer(
  id: string,
  patch: Pick<PendingCustomer, 'name' | 'phone' | 'dialCode' | 'nationality'>,
): PendingCustomer | null {
  const current = getSnapshot()
  const found = current.find((item) => item.id === id)
  if (!found || found.status !== 'pending') return null
  const next: PendingCustomer = {
    ...found,
    name: patch.name.trim().slice(0, 80) || found.name,
    phone: patch.phone.trim().slice(0, 24),
    dialCode: patch.dialCode.trim().slice(0, 8),
    nationality: patch.nationality.trim().slice(0, 40),
    status: 'active-local',
    updatedAt: new Date().toISOString(),
  }
  persist(current.map((item) => (item.id === id ? next : item)))
  return next
}

export function useTripCustomers(): PendingCustomer[] {
  const list = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_CUSTOMERS)
  useEffect(() => {
    const sync = () => { cache = null; listeners.forEach((fn) => fn()) }
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

export type TripOwnershipResolution =
  | { ownership: 'linked'; customerId: string; stub: PendingCustomer; stubCreated: boolean; existingCustomer: false }
  | { ownership: 'unverified'; customerId?: undefined; stub: null; stubCreated: false; existingCustomer: boolean }

/**
 * Decide ownership for a submitted request email without ever authenticating.
 *
 * - Email matches a pending stub on this browser → link it (same-browser
 *   identity, honestly local).
 * - Email matches a staff-managed customer → `unverified`, no link, nothing
 *   exposed. Claiming waits for backend verification.
 * - Otherwise → create one `pending` stub and link it.
 */
export function resolveTripCustomer(
  email: string,
  contact: { name: string; phone: string; dialCode: string; nationality: string },
): TripOwnershipResolution {
  const needle = normalizeEmail(email)
  if (!needle || !isValidEmail(needle)) {
    return { ownership: 'unverified', stub: null, stubCreated: false, existingCustomer: false }
  }
  const stub = findPendingCustomerByEmail(needle)
  if (stub) {
    return { ownership: 'linked', customerId: stub.id, stub, stubCreated: false, existingCustomer: false }
  }
  let staffMatch = false
  try {
    staffMatch = readOverrides().customers.some((customer) => normalizeEmail(customer.email) === needle)
  } catch {
    staffMatch = false
  }
  if (staffMatch) {
    return { ownership: 'unverified', stub: null, stubCreated: false, existingCustomer: true }
  }
  const created = ensurePendingCustomer({ email: needle, ...contact })
  return { ownership: 'linked', customerId: created.customer.id, stub: created.customer, stubCreated: true, existingCustomer: false }
}
