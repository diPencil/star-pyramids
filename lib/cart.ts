import { useSyncExternalStore } from 'react'

export type CartItem = {
  key: string
  tourSlug: string
  title: string
  image: string
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

// Backend integration point: the cart currently persists in this browser
// only. Checkout will POST /api/bookings with { items, contact, payment }.
const KEY = 'sp-cart'
const listeners = new Set<() => void>()
const EMPTY_CART: CartItem[] = []

const isValidItem = (v: unknown): v is CartItem =>
  typeof v === 'object' && v !== null &&
  typeof (v as CartItem).tourSlug === 'string' &&
  typeof (v as CartItem).title === 'string' &&
  Number.isFinite((v as CartItem).total)

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isValidItem).slice(0, 20) : []
  } catch { return [] }
}

let cache: CartItem[] | null = null

function getSnapshot(): CartItem[] {
  if (cache === null) cache = readCart()
  return cache
}

function update(next: CartItem[]) {
  cache = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => { listeners.delete(notify) }
}

export function cartKey(item: Omit<CartItem, 'key'>): string {
  return [item.tourSlug, item.date || 'open', item.adults, item.children, item.infants, item.addons.join('+')].join('|')
}

export function addToCart(item: Omit<CartItem, 'key'>): string {
  const key = cartKey(item)
  update([...getSnapshot().filter((entry) => entry.key !== key), { ...item, key }])
  return key
}

export function removeFromCart(key: string) {
  update(getSnapshot().filter((entry) => entry.key !== key))
}

export function clearCart() {
  update([])
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_CART)
  return {
    items,
    lines: items.length,
    travelers: items.reduce((n, i) => n + i.adults + i.children + i.infants, 0),
    subtotal: items.reduce((n, i) => n + i.total, 0),
  }
}
