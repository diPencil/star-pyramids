'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { readInquiries, saveInquiry } from '@/lib/admin-store'
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

const DEMO_CUSTOMER = 'James Carter'
const DEMO_FAVORITES = ['cairo-and-giza-pyramids', 'luxor-east-west-bank', 'giftun-island-snorkeling-trip']

function ensureDemoSeed() {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(FAVORITES_KEY) === null) {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(DEMO_FAVORITES))
      favoritesCache = null
    }
    if (readInquiries().length === 0) {
      saveInquiry({
        channel: 'whatsapp',
        name: DEMO_CUSTOMER,
        contact: '',
        message: 'Hi! Is the Giza day tour suitable for kids?',
        tourSlug: 'cairo-and-giza-pyramids',
        tourTitle: 'Cairo & Giza Pyramids Day Tour',
      })
      saveInquiry({
        channel: 'email',
        name: DEMO_CUSTOMER,
        contact: 'james.carter@example.com',
        message: 'Could you confirm hotel pickup in Giza for October 2nd?',
        tourSlug: 'cairo-and-giza-pyramids',
        tourTitle: 'Cairo & Giza Pyramids Day Tour',
      })
    }
  } catch {
    // Demo seed is best-effort only.
  }
}

function emitAccountChange() {
  accountListeners.forEach((listener) => listener())
  window.dispatchEvent(new Event('sp-customer-account'))
}

function subscribe(listener: () => void) {
  accountListeners.add(listener)
  const syncExternalTab = () => {
    favoritesCache = null
    listener()
  }
  window.addEventListener('storage', syncExternalTab)
  return () => {
    accountListeners.delete(listener)
    window.removeEventListener('storage', syncExternalTab)
  }
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
  ensureDemoSeed()
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

export function toggleCustomerFavorite(slug: string) {
  const current = getFavoritesSnapshot()
  favoritesCache = current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current]
  try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesCache)) } catch { /* storage can be unavailable */ }
  emitAccountChange()
}

export function useCustomerFavorites() {
  const slugs = useSyncExternalStore(subscribe, getFavoritesSnapshot, () => EMPTY_FAVORITES)
  return { slugs, has: (slug: string) => slugs.includes(slug), toggle: toggleCustomerFavorite }
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
