'use client'

import { useEffect, useState } from 'react'
import type { EnabledLocale } from '@/lib/locale-config'

/**
 * Customer account browser state (Phase 2E).
 *
 * Bookings are database-backed (`/api/account/bookings/*`) — this module
 * no longer stores, seeds, or mutates booking records. What remains here
 * is genuine browser state: saved-trip favorites, the local profile
 * draft, and the cross-page message draft.
 */

export type CustomerProfile = {
  firstName: string
  lastName: string
  fullName: string
  username: string
  email: string
  avatar: string
  phone: string
  country: string
  dialCode: string
  preferredLanguage: EnabledLocale
  marketingEmails: boolean
  bookingUpdates: boolean
  tripReminders: boolean
  smsUpdates: boolean
  paymentUpdates: boolean
  messageReplies: boolean
  cartReminders: boolean
  savedTripUpdates: boolean
  securityAlerts: boolean
}

const FAVORITES_KEY = 'sp-customer-favorites-v1'
const PROFILE_KEY = 'sp-customer-profile-v1'
const accountListeners = new Set<() => void>()
const EMPTY_FAVORITES: string[] = []
let favoritesCache: string[] | null = null

export const defaultCustomerProfile: CustomerProfile = {
  firstName: 'James',
  lastName: 'Carter',
  fullName: 'James Carter',
  username: 'james_carter',
  email: 'james.carter@example.com',
  avatar: 'https://randomuser.me/api/portraits/men/22.jpg',
  phone: '555 013 2400',
  country: 'US',
  dialCode: '+1',
  preferredLanguage: 'en',
  marketingEmails: false,
  bookingUpdates: true,
  tripReminders: true,
  smsUpdates: false,
  paymentUpdates: true,
  messageReplies: true,
  cartReminders: true,
  savedTripUpdates: false,
  securityAlerts: true,
}

function emitAccountChange() {
  accountListeners.forEach((listener) => listener())
  window.dispatchEvent(new Event('sp-customer-account'))
}

export type MessageDraft = { reference: string; title: string }

const DRAFT_KEY = 'sp-message-draft-v1'

export function saveMessageDraft(draft: MessageDraft) {
  try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch { /* storage can be unavailable */ }
}

export function readMessageDraft(): MessageDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<MessageDraft>
    if (typeof parsed.reference !== 'string') return null
    return { reference: parsed.reference, title: typeof parsed.title === 'string' ? parsed.title : '' }
  } catch {
    return null
  }
}

export function clearMessageDraft() {
  try { window.sessionStorage.removeItem(DRAFT_KEY) } catch { /* storage can be unavailable */ }
}

function readFavorites(): string[] {
  if (typeof window === 'undefined') return EMPTY_FAVORITES
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((slug): slug is string => typeof slug === 'string').slice(0, 100) : EMPTY_FAVORITES
  } catch {
    return EMPTY_FAVORITES
  }
}

function getFavoritesSnapshot() {
  if (favoritesCache === null) favoritesCache = readFavorites()
  return favoritesCache
}

/**
 * Authenticated favorites state (Phase 2G).
 *
 * The database is authoritative for signed-in customers: the hook
 * first checks the DB-backed session (`/api/auth/me`) for the CUSTOMER
 * role and only then loads `/api/account/favorites`. Staff-only and
 * guest sessions never request the customer-only endpoint (which would
 * 401 for staff despite a 200 session) and fall back to the legacy
 * browser-local set — guest/staff hearts stay temporary and are never
 * written to the server. The local key is left untouched so existing
 * guest data is never deleted by development.
 */
let serverSlugsCache: string[] | null = null
let serverMode: boolean | null = null
let serverFetch: Promise<string[] | null> | null = null
let serverSettledAt = 0
/** Mounts within this window reuse the settled cache instead of
 *  refetching, so pages with many heart buttons and fast
 *  navigations issue at most one favorites request per window. */
const SERVER_CACHE_TTL_MS = 30 * 1000

/**
 * Role gate for the customer-only favorites API.
 *
 * `/api/account/favorites` requires the CUSTOMER role (see
 * `app/api/account/favorites/route.ts`), so an authenticated staff-only
 * session (e.g. SUPER_ADMIN without CUSTOMER) gets a 401 even though
 * `/api/auth/me` is 200. Heart buttons mount on public pages, so an
 * unconditional favorites fetch turns every admin page view into a
 * spurious customer-only 401. Check the DB-backed session first and
 * skip the favorites request entirely for guests and staff-only
 * sessions — both stay on the temporary browser-local set.
 */
let authEligibleCache: boolean | null = null
let authEligibleSettledAt = 0
let authEligibleFetch: Promise<boolean> | null = null

function fetchFavoritesEligibility(): Promise<boolean> {
  if (authEligibleCache !== null && Date.now() - authEligibleSettledAt < SERVER_CACHE_TTL_MS) {
    return Promise.resolve(authEligibleCache)
  }
  if (!authEligibleFetch) {
    authEligibleFetch = fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return false
        try {
          const data = (await res.json()) as { user?: { roles?: unknown } }
          return Array.isArray(data?.user?.roles) && (data.user.roles as unknown[]).includes('CUSTOMER')
        } catch {
          return false
        }
      })
      .catch(() => false)
      .then((eligible) => {
        authEligibleCache = eligible
        authEligibleSettledAt = Date.now()
        return eligible
      })
      .finally(() => { authEligibleFetch = null })
  }
  return authEligibleFetch
}

function fetchServerFavorites(): Promise<string[] | null> {
  if (!serverFetch) {
    serverFetch = (async () => {
      const eligible = await fetchFavoritesEligibility()
      if (!eligible) return null
      try {
        const res = await fetch('/api/account/favorites', { credentials: 'same-origin' })
        if (!res.ok) return null
        const data = (await res.json()) as { favorites?: unknown }
        return Array.isArray(data.favorites) ? data.favorites.filter((slug): slug is string => typeof slug === 'string') : null
      } catch {
        return null
      }
    })()
      .finally(() => { serverFetch = null })
  }
  return serverFetch
}

/** Cross-tab changes always refetch, bypassing the settled cache. */
function refreshServerFavorites(): Promise<string[] | null> {
  serverFetch = null
  // Cross-tab writes may follow a login/logout, so re-check the session
  // role instead of reusing a possibly stale eligibility verdict.
  authEligibleCache = null
  return fetchServerFavorites()
}

async function mutateServerFavorite(slug: string, adding: boolean) {
  const res = await fetch('/api/account/favorites', {
    method: adding ? 'POST' : 'DELETE',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ slug }),
  })
  const data = (await res.json()) as { favorites?: unknown }
  if (!res.ok) throw new Error('Could not update saved trips.')
  if (!Array.isArray(data.favorites)) throw new Error('Could not update saved trips.')
  return data.favorites.filter((entry): entry is string => typeof entry === 'string')
}

export function toggleCustomerFavorite(slug: string) {
  if (serverMode === true) {
    const adding = !(serverSlugsCache ?? []).includes(slug)
    serverSlugsCache = adding ? [slug, ...(serverSlugsCache ?? [])] : (serverSlugsCache ?? []).filter((item) => item !== slug)
    emitAccountChange()
    mutateServerFavorite(slug, adding)
      .then((slugs) => { serverSlugsCache = slugs; serverSettledAt = Date.now(); emitAccountChange() })
      .catch(() => { serverSlugsCache = null; emitAccountChange() })
    return
  }
  const current = getFavoritesSnapshot()
  favoritesCache = current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current]
  try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesCache)) } catch { /* storage can be unavailable */ }
  emitAccountChange()
}

export function useCustomerFavorites() {
  const [slugs, setSlugs] = useState<string[]>(() => (serverMode === true && serverSlugsCache ? [...serverSlugsCache] : serverMode === false ? getFavoritesSnapshot() : []))
  const [loading, setLoading] = useState(serverMode === null)
  useEffect(() => {
    let cancelled = false
    // Reuse a freshly settled cache so pages with many heart buttons
    // and fast navigations do not refetch on every mount.
    if (serverMode === true && serverSlugsCache && Date.now() - serverSettledAt < SERVER_CACHE_TTL_MS) {
      setSlugs([...serverSlugsCache])
      setLoading(false)
    } else {
      fetchServerFavorites().then((rows) => {
        if (cancelled) return
        if (rows === null) {
          // Guest (or unreachable API): browser-local set stays in
          // charge and remains temporary by design.
          serverMode = false
          serverSlugsCache = null
          setSlugs(getFavoritesSnapshot())
        } else {
          serverMode = true
          serverSlugsCache = rows
          serverSettledAt = Date.now()
          setSlugs([...rows])
        }
        setLoading(false)
      }).catch(() => {
        // Any unexpected failure (e.g. unparsable response) must
        // still settle loading — fall back to the guest-local set
        // instead of hanging on the loading state.
        if (cancelled) return
        serverMode = false
        serverSlugsCache = null
        setSlugs(getFavoritesSnapshot())
        setLoading(false)
      })
    }
    const sync = (event?: Event) => {
      if (cancelled) return
      if (serverMode === true) {
        // Same-tab mutations already updated the shared cache
        // optimistically. A cross-tab write to the favorites key
        // refetches; unrelated storage keys are ignored to avoid
        // refetch churn.
        if (event instanceof StorageEvent) {
          if (event.key !== null && event.key !== FAVORITES_KEY) return
          refreshServerFavorites().then((rows) => {
            if (!cancelled && rows !== null) {
              serverSlugsCache = rows
              serverSettledAt = Date.now()
              setSlugs([...rows])
            }
          }).catch(() => { /* best-effort cross-tab sync keeps the current set */ })
        } else if (serverSlugsCache) {
          setSlugs([...serverSlugsCache])
        }
      } else {
        favoritesCache = null
        setSlugs(getFavoritesSnapshot())
      }
    }
    const storageSync = (event: StorageEvent) => sync(event)
    accountListeners.add(sync)
    window.addEventListener('storage', storageSync)
    return () => {
      accountListeners.delete(sync)
      window.removeEventListener('storage', storageSync)
    }
  }, [])
  return { slugs, has: (slug: string) => slugs.includes(slug), toggle: toggleCustomerFavorite, loading }
}

export function readCustomerProfile(): CustomerProfile {
  if (typeof window === 'undefined') return defaultCustomerProfile
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFILE_KEY) || '{}') as Partial<CustomerProfile>
    const oldParts = (parsed.fullName || '').trim().split(/\s+/).filter(Boolean)
    const firstName = parsed.firstName || oldParts[0] || defaultCustomerProfile.firstName
    const lastName = parsed.lastName || oldParts.slice(1).join(' ') || defaultCustomerProfile.lastName
    const dialCode = parsed.dialCode || defaultCustomerProfile.dialCode
    const storedPhone = parsed.phone || defaultCustomerProfile.phone
    const phone = storedPhone.startsWith(dialCode) ? storedPhone.slice(dialCode.length).trimStart() : storedPhone
    return { ...defaultCustomerProfile, ...parsed, firstName, lastName, fullName: `${firstName} ${lastName}`.trim(), dialCode, phone, securityAlerts: true }
  } catch {
    return defaultCustomerProfile
  }
}

export function saveCustomerProfile(profile: CustomerProfile) {
  const normalized = { ...profile, fullName: `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim(), securityAlerts: true }
  try { window.localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized)) } catch { /* storage can be unavailable */ }
  emitAccountChange()
}

export function useCustomerProfile() {
  const [profile, setProfile] = useState<CustomerProfile>(defaultCustomerProfile)
  useEffect(() => {
    const sync = () => setProfile(readCustomerProfile())
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('sp-customer-account', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('sp-customer-account', sync)
    }
  }, [])
  return profile
}
