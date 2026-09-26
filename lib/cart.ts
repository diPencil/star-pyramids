import { useSyncExternalStore } from 'react'

/**
 * ONE authoritative frontend cart contract.
 *
 * A cart line stores only the stable configured booking request:
 * canonical tour slug, display snapshot, preferred date, traveler counts,
 * selected add-on titles, and the frontend USD/base estimate snapshot.
 *
 * Persisted cart data is UNTRUSTED browser input: every stored line is
 * sanitized on read (never crashes, never resolves to another tour).
 * Canonical revalidation (stale slugs, authoritative estimates) lives in
 * `@/lib/booking` so tour detail, cart, and checkout share one engine.
 */
export type CartItem = {
  key: string
  tourSlug: string
  title: string
  image: string
  /** Preferred/requested date (YYYY-MM-DD) or '' for an open date. No availability is implied. */
  date: string
  adults: number
  children: number
  infants: number
  addons: readonly string[]
  addonTotal: number
  adultUnit: number
  childUnit: number
  infantUnit: number
  /**
   * Frontend estimate in USD base units, formatted at display time with the
   * active currency. The backend remains authoritative for final pricing.
   */
  total: number
}

// Backend integration point: the cart persists in this browser only.
// Checkout builds a BookingRequestDraft (@/lib/booking) from these lines;
// the future backend service will receive that draft, revalidate it, and
// return the authoritative booking. No API calls exist yet.
const KEY = 'sp-cart'
const MAX_LINES = 20
const listeners = new Set<() => void>()
const EMPTY_CART: CartItem[] = []

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function sanitizeDate(value: unknown): string {
  if (typeof value !== 'string' || value === '') return ''
  const match = DATE_PATTERN.exec(value)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  const valid =
    year >= 2000 && year <= 2100 &&
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return valid ? value : ''
}

function sanitizeCount(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function sanitizeMoney(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function sanitizeAddons(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 20)
}

/**
 * Defensive normalization for one stored line. Returns null only when the
 * line cannot be tied to any tour request (missing/empty slug or title).
 * Traveler counts and money are coerced into safe ranges; the line is never
 * reinterpreted as a different booking. Stale slugs (removed tours) are kept
 * so the UI can flag them instead of substituting another tour.
 */
export function sanitizeCartItem(value: unknown): CartItem | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<CartItem>
  const tourSlug = typeof raw.tourSlug === 'string' ? raw.tourSlug.trim() : ''
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (!tourSlug || !title) return null
  const adults = sanitizeCount(raw.adults, 1, 50, 1)
  const children = sanitizeCount(raw.children, 0, 50, 0)
  const infants = sanitizeCount(raw.infants, 0, 50, 0)
  const candidate: Omit<CartItem, 'key'> = {
    tourSlug,
    title,
    image: typeof raw.image === 'string' ? raw.image : '',
    date: sanitizeDate(raw.date),
    adults,
    children,
    infants,
    addons: sanitizeAddons(raw.addons),
    addonTotal: sanitizeMoney(raw.addonTotal),
    adultUnit: sanitizeMoney(raw.adultUnit),
    childUnit: sanitizeMoney(raw.childUnit),
    infantUnit: sanitizeMoney(raw.infantUnit),
    total: sanitizeMoney(raw.total),
  }
  return { ...candidate, key: cartKey(candidate) }
}

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const items: CartItem[] = []
    for (const entry of parsed) {
      const item = sanitizeCartItem(entry)
      if (item && !items.some((kept) => kept.key === item.key)) items.push(item)
      if (items.length >= MAX_LINES) break
    }
    return items
  } catch { return [] }
}

let cache: CartItem[] | null = null

function getSnapshot(): CartItem[] {
  if (cache === null) cache = readCart()
  return cache
}

function getServerSnapshot(): CartItem[] {
  return EMPTY_CART
}

function update(next: CartItem[]) {
  cache = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      cache = null
      notify()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(notify)
    window.removeEventListener('storage', onStorage)
  }
}

export function cartKey(item: Omit<CartItem, 'key'>): string {
  return [item.tourSlug, item.date || 'open', item.adults, item.children, item.infants, item.addons.join('+')].join('|')
}

/**
 * Deterministic duplicate behavior: adding the identical configuration
 * (same slug, date, travelers, add-ons) merges into one line, so rapid or
 * double clicks can never create accidental duplicates. A meaningfully
 * different configuration (date, travelers, or add-ons) stays a separate
 * line. The key identifies the local configuration line only.
 */
export function addToCart(item: Omit<CartItem, 'key'>): string {
  const sanitized = sanitizeCartItem(item)
  if (!sanitized) throw new Error('addToCart requires a tour slug, title, and valid traveler counts')
  const key = sanitized.key
  update([...getSnapshot().filter((entry) => entry.key !== key), { ...sanitized, key }])
  return key
}

export function removeFromCart(key: string) {
  update(getSnapshot().filter((entry) => entry.key !== key))
}

export function clearCart() {
  update([])
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return {
    items,
    lines: items.length,
    travelers: items.reduce((n, i) => n + i.adults + i.children + i.infants, 0),
    subtotal: items.reduce((n, i) => n + i.total, 0),
  }
}
