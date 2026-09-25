'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Blog, Car, DealFeedItem, Destination, Event, Offer, Tour, TourDeal } from '@/data/types'
import { COMPANY_ADDRESS, COMPANY_EMAIL, COMPANY_MAP_URL, COMPANY_PHONE_DISPLAY } from '@/data/company'

export type OverrideCollection = 'offers' | 'events' | 'blogs' | 'cars' | 'destinations' | 'customers'

export type AdminCustomer = {
  slug: string
  firstName?: string
  lastName?: string
  name: string
  username: string
  email: string
  country: string
  dialCode: string
  phone: string
  avatar?: string
  active?: boolean
  createdAt: string
}

export type CustomerProfilePatch = {
  email?: string
  phone?: string
  country?: string
  avatar?: string
  notes?: string
}

export type AdminOverrides = {
  version: 1
  offers: Offer[]
  events: Event[]
  blogs: Blog[]
  cars: Car[]
  destinations: Destination[]
  customers: AdminCustomer[]
  customerProfiles: Record<string, CustomerProfilePatch>
  tourOverrides: Record<string, Tour>
  tourDeals: Record<string, TourDeal>
}

const KEY = 'sp-admin-overrides-v1'
export const CUSTOM_PREFIX = 'custom-'

const empty: AdminOverrides = { version: 1, offers: [], events: [], blogs: [], cars: [], destinations: [], customers: [], customerProfiles: {}, tourOverrides: {}, tourDeals: {} }

export function isCustomSlug(slug: string) {
  return slug.startsWith(CUSTOM_PREFIX)
}

export function slugify(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${CUSTOM_PREFIX}${base || `item-${Date.now().toString(36)}`}`
}

export function readOverrides(): AdminOverrides {
  if (typeof window === 'undefined') return empty
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<AdminOverrides>
    return {
      version: 1,
      offers: Array.isArray(parsed.offers) ? parsed.offers : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      blogs: Array.isArray(parsed.blogs) ? parsed.blogs : [],
      cars: Array.isArray(parsed.cars) ? parsed.cars : [],
      destinations: Array.isArray(parsed.destinations) ? parsed.destinations : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      customerProfiles: parsed.customerProfiles && typeof parsed.customerProfiles === 'object' ? parsed.customerProfiles : {},
      tourOverrides: parsed.tourOverrides && typeof parsed.tourOverrides === 'object' ? parsed.tourOverrides : {},
      tourDeals: parsed.tourDeals && typeof parsed.tourDeals === 'object' ? parsed.tourDeals : {},
    }
  } catch {
    return empty
  }
}

function writeOverrides(data: AdminOverrides) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data))
    window.dispatchEvent(new Event('sp-overrides'))
  } catch {
    // Storage full or unavailable; admin keeps working in memory only.
  }
}

export function saveCustomItem<T extends { slug: string }>(collection: OverrideCollection, item: T) {
  const data = readOverrides()
  const list = data[collection] as unknown as T[]
  const next = [item, ...list.filter((entry) => entry.slug !== item.slug)]
  writeOverrides({ ...data, [collection]: next })
}

export function removeCustomItem(collection: OverrideCollection, slug: string) {
  const data = readOverrides()
  const list = (data[collection] as { slug: string }[]).filter((entry) => entry.slug !== slug)
  writeOverrides({ ...data, [collection]: list })
}

export function setCustomerActive(slug: string, active: boolean) {
  const data = readOverrides()
  writeOverrides({ ...data, customers: data.customers.map((c) => (c.slug === slug ? { ...c, active } : c)) })
}

export function isCustomerActive(customer: AdminCustomer) {
  return customer.active !== false
}

export function saveCustomerProfile(name: string, patch: CustomerProfilePatch) {
  const data = readOverrides()
  writeOverrides({ ...data, customerProfiles: { ...data.customerProfiles, [name]: { ...data.customerProfiles[name], ...patch } } })
}

export function useCustomerProfile(name: string): CustomerProfilePatch {
  const [patch, setPatch] = useState<CustomerProfilePatch>({})
  useEffect(() => {
    const sync = () => setPatch(readOverrides().customerProfiles[name] ?? {})
    sync()
    window.addEventListener('sp-overrides', sync)
    return () => window.removeEventListener('sp-overrides', sync)
  }, [name])
  return patch
}

export type ImpersonatedCustomer = {
  name: string
  email?: string
  avatar?: string
  at: string
}

const IMPERSONATE_KEY = 'sp-impersonate-customer'

export function readImpersonation(): ImpersonatedCustomer | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(IMPERSONATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ImpersonatedCustomer
    if (!parsed || typeof parsed.name !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function startImpersonation(customer: { name: string; email?: string; avatar?: string }) {
  try {
    window.localStorage.setItem(IMPERSONATE_KEY, JSON.stringify({ ...customer, at: new Date().toISOString() }))
    window.dispatchEvent(new Event('sp-impersonate'))
  } catch {
    // Impersonation unavailable without storage access.
  }
  window.open('/account', '_blank', 'noopener')
}

export function stopImpersonation() {
  try {
    window.localStorage.removeItem(IMPERSONATE_KEY)
    window.dispatchEvent(new Event('sp-impersonate'))
  } catch {
    // Nothing stored to clear.
  }
}

export type InquiryChannel = 'whatsapp' | 'email'

export type Inquiry = {
  id: string
  channel: InquiryChannel
  name: string
  contact: string
  message: string
  tourSlug: string
  tourTitle: string
  at: string
}

const INQUIRY_KEY = 'sp-inquiries-v1'

export function readInquiries(): Inquiry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(INQUIRY_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is Inquiry =>
        typeof entry === 'object' && entry !== null &&
        typeof (entry as Inquiry).id === 'string' &&
        typeof (entry as Inquiry).message === 'string'
    )
  } catch {
    return []
  }
}

export function saveInquiry(input: Omit<Inquiry, 'id' | 'at'>): Inquiry {
  const item: Inquiry = { ...input, id: `inq-${Date.now().toString(36)}`, at: new Date().toISOString() }
  try {
    window.localStorage.setItem(INQUIRY_KEY, JSON.stringify([item, ...readInquiries()]))
    window.dispatchEvent(new Event('sp-inquiries'))
  } catch {
    // Inquiry kept for this session only.
  }
  return item
}

export function useInquiries(): Inquiry[] {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  useEffect(() => {
    const sync = () => setInquiries(readInquiries())
    sync()
    window.addEventListener('sp-inquiries', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('sp-inquiries', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return inquiries
}

export function saveTourDeal(slug: string, deal: TourDeal) {
  const data = readOverrides()
  writeOverrides({ ...data, tourDeals: { ...data.tourDeals, [slug]: deal } })
}

export function removeTourDeal(slug: string) {
  const data = readOverrides()
  const tourDeals = { ...data.tourDeals }
  delete tourDeals[slug]
  writeOverrides({ ...data, tourDeals })
}

export function saveTourOverride(tour: Tour) {
  const data = readOverrides()
  writeOverrides({ ...data, tourOverrides: { ...data.tourOverrides, [tour.slug]: tour } })
}

export function useTourOverride(slug: string, fallback: Tour): Tour {
  const [tour, setTour] = useState(fallback)
  useEffect(() => {
    const sync = () => setTour(readOverrides().tourOverrides[slug] ?? fallback)
    sync()
    window.addEventListener('sp-overrides', sync)
    return () => window.removeEventListener('sp-overrides', sync)
  }, [fallback, slug])
  return tour
}

export function useLiveCollection<T>(collection: OverrideCollection, base: readonly T[]): T[] {
  const [customs, setCustoms] = useState<T[]>([])
  useEffect(() => {
    const sync = () => setCustoms(readOverrides()[collection] as T[])
    sync()
    window.addEventListener('sp-overrides', sync)
    return () => window.removeEventListener('sp-overrides', sync)
  }, [collection])
  return customs.length ? [...customs, ...base] : (base as T[])
}

export function useLiveFind<T extends { slug: string }>(
  collection: OverrideCollection,
  base: readonly T[],
  slug: string
): T | undefined {
  const list = useLiveCollection(collection, base)
  return list.find((entry) => entry.slug === slug)
}

export function useTourDeal(slug: string, fallback?: TourDeal): TourDeal | undefined {
  const [override, setOverride] = useState<TourDeal | undefined>(undefined)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setOverride(readOverrides().tourDeals[slug])
    setReady(true)
  }, [slug])
  return ready ? override ?? fallback : fallback
}

export function useDealFeed(): DealFeedItem[] {
  const [feed, setFeed] = useState<DealFeedItem[]>([])
  useEffect(() => {
    const deals = readOverrides().tourDeals
    setFeed(Object.entries(deals).map(([slug, item]) => ({ slug, percent: item.percent, endsAt: item.endsAt })))
  }, [])
  return feed
}

export function useLiveTours(base: readonly Tour[]): Tour[] {
  const feed = useDealFeed()
  const [overrides, setOverrides] = useState<Record<string, Tour>>({})
  useEffect(() => {
    const sync = () => setOverrides(readOverrides().tourOverrides)
    sync()
    window.addEventListener('sp-overrides', sync)
    return () => window.removeEventListener('sp-overrides', sync)
  }, [])
  return useMemo(() => {
    const merged = base.map((tour) => overrides[tour.slug] ?? tour)
    if (!feed.length) return merged
    return merged.map((tour) => {
      const item = feed.find((entry) => entry.slug === tour.slug)
      if (!item || !(item.percent > 0 && item.percent < 100) || Number.isNaN(new Date(item.endsAt).getTime())) return tour
      return { ...tour, deal: { percent: item.percent, endsAt: item.endsAt } }
    })
  }, [base, feed, overrides])
}

export type AdminProfile = {
  name: string
  username: string
  email: string
  country: string
  dialCode: string
  phone: string
  avatar: string
}

const PROFILE_KEY = 'sp-admin-profile-v1'

export const defaultAdminProfile: AdminProfile = {
  name: 'Super Admin',
  username: 'admin',
  email: 'admin@starpyramids.com',
  country: 'Egypt',
  dialCode: '+20',
  phone: '+20 1288222962',
  avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
}

export function readAdminProfile(): AdminProfile {
  if (typeof window === 'undefined') return defaultAdminProfile
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    if (!raw) return defaultAdminProfile
    const parsed = JSON.parse(raw) as Partial<AdminProfile>
    return { ...defaultAdminProfile, ...parsed }
  } catch {
    return defaultAdminProfile
  }
}

export function saveAdminProfile(patch: Partial<AdminProfile>) {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...readAdminProfile(), ...patch }))
    window.dispatchEvent(new Event('sp-profile'))
  } catch {
    // Profile kept in memory only for this session.
  }
}

export function readImageFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.size > 1_500_000) {
      resolve(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

export type BrandSettings = {
  companyName: string
  logo: string
  favicon: string
  aboutEn: string
  aboutAr: string
  phone: string
  whatsapp: string
  email: string
  address: string
  mapUrl: string
  copyrightEn: string
  copyrightAr: string
}

const BRAND_KEY = 'sp-brand-settings-v1'

export const defaultBrandSettings: BrandSettings = {
  companyName: 'Star Pyramids Tours',
  logo: '/logo.png',
  favicon: '/favicon.png',
  aboutEn: 'We would be happy to help you discover Egypt.',
  aboutAr: 'سعداء بمساعدتك في اكتشاف مصر.',
  phone: COMPANY_PHONE_DISPLAY,
  whatsapp: COMPANY_PHONE_DISPLAY,
  email: COMPANY_EMAIL,
  address: COMPANY_ADDRESS,
  mapUrl: COMPANY_MAP_URL,
  copyrightEn: 'All rights reserved to STAR PYRAMIDS company, Egypt ©2026',
  copyrightAr: 'جميع الحقوق محفوظة لشركة ستار بيراميدز، مصر ©2026',
}

export function readBrandSettings(): BrandSettings {
  if (typeof window === 'undefined') return defaultBrandSettings
  try {
    const raw = window.localStorage.getItem(BRAND_KEY)
    if (!raw) return defaultBrandSettings
    const parsed = JSON.parse(raw) as Partial<BrandSettings>
    return { ...defaultBrandSettings, ...parsed }
  } catch {
    return defaultBrandSettings
  }
}

export function saveBrandSettings(patch: Partial<BrandSettings>) {
  try {
    window.localStorage.setItem(BRAND_KEY, JSON.stringify({ ...readBrandSettings(), ...patch }))
    window.dispatchEvent(new Event('sp-brand'))
  } catch {
    // Brand kept in memory only for this session.
  }
}

export function useBrandSettings(): BrandSettings {
  const [brand, setBrand] = useState<BrandSettings>(defaultBrandSettings)
  useEffect(() => {
    const sync = () => setBrand(readBrandSettings())
    sync()
    window.addEventListener('sp-brand', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('sp-brand', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return brand
}

export type SocialNetwork = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'x' | 'linkedin' | 'whatsapp' | 'telegram' | 'pinterest'

export type SocialLink = {
  id: string
  network: SocialNetwork
  url: string
  header: boolean
  footer: boolean
}

export const SOCIAL_NETWORKS: { id: SocialNetwork; label: string }[] = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'x', label: 'X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'pinterest', label: 'Pinterest' },
]

const SOCIAL_KEY = 'sp-social-links-v1'

export const defaultSocialLinks: SocialLink[] = [
  { id: 'soc-facebook', network: 'facebook', url: 'https://www.facebook.com/', header: true, footer: true },
  { id: 'soc-instagram', network: 'instagram', url: 'https://www.instagram.com/', header: true, footer: true },
  { id: 'soc-tiktok', network: 'tiktok', url: 'https://www.tiktok.com/', header: true, footer: true },
  { id: 'soc-youtube', network: 'youtube', url: 'https://www.youtube.com/', header: false, footer: true },
]

export function readSocialLinks(): SocialLink[] {
  if (typeof window === 'undefined') return defaultSocialLinks
  try {
    const raw = window.localStorage.getItem(SOCIAL_KEY)
    if (!raw) return defaultSocialLinks
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return defaultSocialLinks
    const valid = parsed.filter(
      (entry): entry is SocialLink =>
        typeof entry === 'object' && entry !== null &&
        typeof (entry as SocialLink).id === 'string' &&
        typeof (entry as SocialLink).url === 'string'
    )
    return valid.length ? valid : defaultSocialLinks
  } catch {
    return defaultSocialLinks
  }
}

export function saveSocialLinks(links: SocialLink[]) {
  try {
    window.localStorage.setItem(SOCIAL_KEY, JSON.stringify(links))
    window.dispatchEvent(new Event('sp-social'))
  } catch {
    // Social links kept in memory only for this session.
  }
}

export function useSocialLinks(): SocialLink[] {
  const [links, setLinks] = useState<SocialLink[]>(defaultSocialLinks)
  useEffect(() => {
    const sync = () => setLinks(readSocialLinks())
    sync()
    window.addEventListener('sp-social', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('sp-social', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return links
}
