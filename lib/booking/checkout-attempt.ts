'use client'

import type { BookingCheckoutDraft } from './booking'

const STORAGE = 'sp-checkout-key'
const KEY = /^[A-Za-z0-9-]{8,64}$/
const FINGERPRINT = /^[a-f0-9]{64}$/
const attempts = new Map<string, string>()
const legacyClaims = new Map<string, string>()

function loadAttempts(): string | null {
  try {
    const stored = window.sessionStorage.getItem(STORAGE)
    if (!stored) return null
    if (KEY.test(stored)) return stored
    const parsed = JSON.parse(stored)
    // Read both the previous single-attempt object and the current pending set.
    const rows: unknown[] = Array.isArray(parsed.attempts) ? parsed.attempts : [parsed]
    for (const row of rows) {
      if (row && typeof row === 'object' && 'fingerprint' in row && 'key' in row && typeof row.fingerprint === 'string' && typeof row.key === 'string' && FINGERPRINT.test(row.fingerprint) && KEY.test(row.key)) attempts.set(row.fingerprint, row.key)
    }
  } catch { /* in-memory retries still work when browser storage is unavailable */ }
  return null
}

function persistAttempts() {
  try {
    if (!attempts.size) window.sessionStorage.removeItem(STORAGE)
    else window.sessionStorage.setItem(STORAGE, JSON.stringify({ attempts: [...attempts].map(([fingerprint, key]) => ({ fingerprint, key })) }))
  } catch { /* optional persistence; never discard unresolved in-memory attempts */ }
}

/** A changed intent gets its own key; returning to an unresolved intent reuses its original key. No raw PII is stored. */
export async function checkoutAttemptKey(draft: Omit<BookingCheckoutDraft, 'idempotencyKey'>): Promise<string> {
  const intent = {
    lines: draft.lines.map(line => ({ tourSlug: line.tourSlug, date: line.date, adults: line.adults, children: line.children, infants: line.infants, addons: [...new Set(line.addons)].sort() })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    contact: { name: draft.contact.name.trim(), email: draft.contact.email.trim().toLowerCase(), phone: draft.contact.phone.trim().replace(/[ ()-]/g, '') },
    notes: draft.notes?.trim() ?? '', currency: 'USD', acceptedTerms:draft.acceptedTerms===true,
  }
  const digest=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),byte=>byte.toString(16).padStart(2,'0')).join('')
  const fingerprint=await digest(intent)
  const {acceptedTerms:_,...oldIntent}=intent
  const oldFingerprint=await digest(oldIntent)
  const legacy = loadAttempts()
  const oldKey=attempts.get(oldFingerprint)
  if(oldKey&&!attempts.has(fingerprint)&&!legacyClaims.has(oldKey)){
    legacyClaims.set(oldKey,fingerprint);attempts.delete(oldFingerprint);attempts.set(fingerprint,oldKey);persistAttempts()
  }
  const existing = attempts.get(fingerprint)
  if (existing) return existing
  if (attempts.size >= 20) throw Error('Too many unfinished checkout attempts. Contact our team before retrying.')
  // Bind a legacy key only once, including when storage permits reads but denies writes.
  if (legacy && !legacyClaims.has(legacy)) legacyClaims.set(legacy, fingerprint)
  const key = legacy && legacyClaims.get(legacy) === fingerprint ? legacy : crypto.randomUUID()
  attempts.set(fingerprint, key)
  persistAttempts()
  return key
}

export function finishCheckoutAttempt(key: string) {
  loadAttempts()
  for (const [fingerprint, stored] of attempts) if (stored === key) attempts.delete(fingerprint)
  persistAttempts()
}
