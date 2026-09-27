'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Blog, Car, DealFeedItem, Destination, Event, MultiDayCategory, Offer, Tour, TourDeal } from '@/data/types'
import { COMPANY_ADDRESS, COMPANY_EMAIL, COMPANY_MAP_URL, COMPANY_PHONE_DISPLAY } from '@/data/company'

export type OverrideCollection = 'offers' | 'events' | 'blogs' | 'cars' | 'destinations' | 'multiDayCategories' | 'customers'

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
  multiDayCategories: MultiDayCategory[]
  customers: AdminCustomer[]
  customerProfiles: Record<string, CustomerProfilePatch>
  carOverrides: Record<string, Car>
  hiddenCars: string[]
  tourOverrides: Record<string, Tour>
  tourDeals: Record<string, TourDeal>
  /** Canonical event edits by slug (replace-by-slug, never mutates data/content.ts). */
  eventOverrides: Record<string, Event>
  /** Hidden event slugs (canonical or custom). Excluded from public discovery on this browser. */
  hiddenEvents: string[]
}

const KEY = 'sp-admin-overrides-v1'
export const CUSTOM_PREFIX = 'custom-'

const empty: AdminOverrides = { version: 1, offers: [], events: [], blogs: [], cars: [], destinations: [], multiDayCategories: [], customers: [], customerProfiles: {}, carOverrides: {}, hiddenCars: [], tourOverrides: {}, tourDeals: {}, eventOverrides: {}, hiddenEvents: [] }

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
      destinations: sanitizeDestinations(parsed.destinations),
      multiDayCategories: sanitizeMultiDayCategories(parsed.multiDayCategories),
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      customerProfiles: parsed.customerProfiles && typeof parsed.customerProfiles === 'object' ? parsed.customerProfiles : {},
      carOverrides: sanitizeCarOverrides(parsed.carOverrides),
      hiddenCars: Array.isArray(parsed.hiddenCars) ? parsed.hiddenCars.filter((slug): slug is string => typeof slug === 'string') : [],
      tourOverrides: parsed.tourOverrides && typeof parsed.tourOverrides === 'object' ? parsed.tourOverrides : {},
      tourDeals: parsed.tourDeals && typeof parsed.tourDeals === 'object' ? parsed.tourDeals : {},
      eventOverrides: sanitizeEventOverrides(parsed.eventOverrides),
      hiddenEvents: Array.isArray(parsed.hiddenEvents) ? parsed.hiddenEvents.filter((slug): slug is string => typeof slug === 'string') : [],
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

/**
 * Canonical vehicle edits must never mutate `data/content.ts`. They persist
 * as local admin overrides keyed by slug and merge over the canonical fleet
 * (see `useLiveCollection`). Custom vehicles edit in place via saveCustomItem.
 */
function sanitizeCarOverride(value: unknown): Car | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<Car>
  if (typeof raw.slug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(raw.slug)) return null
  if (typeof raw.title !== 'string' || !raw.title.trim()) return null
  const dailyPrice = typeof raw.dailyPrice === 'number' && Number.isFinite(raw.dailyPrice) ? raw.dailyPrice : 0
  return {
    title: raw.title.trim().slice(0, 120),
    slug: raw.slug,
    image: typeof raw.image === 'string' ? raw.image.slice(0, 2000) : '',
    seats: typeof raw.seats === 'string' ? raw.seats.trim().slice(0, 40) : '',
    transmission: typeof raw.transmission === 'string' ? raw.transmission.slice(0, 40) : 'Automatic',
    dailyPrice,
    copy: typeof raw.copy === 'string' ? raw.copy.slice(0, 2000) : raw.title.trim(),
  }
}

function sanitizeCarOverrides(value: unknown): Record<string, Car> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, Car> = {}
  for (const [slug, entry] of Object.entries(value as Record<string, unknown>)) {
    const clean = sanitizeCarOverride(entry)
    if (clean && clean.slug === slug) out[slug] = clean
  }
  return out
}

export function saveCarOverride(car: Car) {
  const clean = sanitizeCarOverride(car)
  if (!clean) return
  const data = readOverrides()
  writeOverrides({ ...data, carOverrides: { ...data.carOverrides, [clean.slug]: clean } })
}

export function removeCarOverride(slug: string) {
  const data = readOverrides()
  const carOverrides = { ...data.carOverrides }
  delete carOverrides[slug]
  writeOverrides({ ...data, carOverrides })
}

/**
 * Website visibility (not availability). Hidden vehicles stay in admin but are
 * excluded from public fleet/request surfaces on this browser via
 * `useLiveCollection`. Canonical vehicles are never deletable; hiding covers
 * the operational need.
 */
export function isCarHidden(slug: string): boolean {
  if (typeof window === 'undefined') return false
  return readOverrides().hiddenCars.includes(slug)
}

export function setCarHidden(slug: string, hidden: boolean) {
  const data = readOverrides()
  const hiddenCars = hidden
    ? (data.hiddenCars.includes(slug) ? data.hiddenCars : [...data.hiddenCars, slug])
    : data.hiddenCars.filter((entry) => entry !== slug)
  writeOverrides({ ...data, hiddenCars })
}

export function useHiddenCars(): string[] {
  const [hidden, setHidden] = useState<string[]>([])
  useEffect(() => {
    const sync = () => setHidden(readOverrides().hiddenCars)
    sync()
    window.addEventListener('sp-overrides', sync)
    return () => window.removeEventListener('sp-overrides', sync)
  }, [])
  return hidden
}

/**
 * Events prototype persistence (single effective architecture).
 * Canonical events stay in `data/content.ts`; admin edits persist as
 * `eventOverrides` keyed by slug (replace-by-slug at merge time), brand-new
 * events persist as `events` customs via saveCustomItem, and visibility
 * travels in `hiddenEvents`. Public landing/detail, admin list, and request
 * availability all consume `useLiveEvents`, so one write updates every
 * surface in the same browser. Malformed stored entries are dropped by the
 * shared Event sanitizer in `@/lib/events` (lazy-imported to avoid a
 * server-component cycle; admin-store stays the storage owner).
 */
function sanitizeEventOverrides(value: unknown): Record<string, Event> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, Event> = {}
  for (const [slug, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) continue
    const raw = entry as Partial<Event> & { slug?: unknown; title?: unknown }
    if (raw.slug !== slug || typeof raw.title !== 'string' || !raw.title.trim()) continue
    if (typeof (raw as { date?: unknown }).date !== 'string') continue
    out[slug] = entry as Event
  }
  return out
}

export function saveEventOverride(event: Event) {
  if (!event.slug || !event.title.trim()) return
  const data = readOverrides()
  writeOverrides({ ...data, eventOverrides: { ...data.eventOverrides, [event.slug]: event } })
}

export function removeEventOverride(slug: string) {
  const data = readOverrides()
  const eventOverrides = { ...data.eventOverrides }
  delete eventOverrides[slug]
  writeOverrides({ ...data, eventOverrides })
}

export function isEventHidden(slug: string): boolean {
  if (typeof window === 'undefined') return false
  return readOverrides().hiddenEvents.includes(slug)
}

export function setEventHidden(slug: string, hidden: boolean) {
  const data = readOverrides()
  const hiddenEvents = hidden
    ? (data.hiddenEvents.includes(slug) ? data.hiddenEvents : [...data.hiddenEvents, slug])
    : data.hiddenEvents.filter((entry) => entry !== slug)
  writeOverrides({ ...data, hiddenEvents })
}

export function useHiddenEvents(): string[] {
  const [hidden, setHidden] = useState<string[]>([])
  useEffect(() => {
    const sync = () => setHidden(readOverrides().hiddenEvents)
    sync()
    window.addEventListener('sp-overrides', sync)
    return () => window.removeEventListener('sp-overrides', sync)
  }, [])
  return hidden
}

/** Reactive event-override map (canonical edits). */
export function useEventOverrides(): Record<string, Event> {
  const [overrides, setOverrides] = useState<Record<string, Event>>({})
  useEffect(() => {
    const sync = () => setOverrides(readOverrides().eventOverrides)
    sync()
    window.addEventListener('sp-overrides', sync)
    return () => window.removeEventListener('sp-overrides', sync)
  }, [])
  return overrides
}

/**
 * Single effective Events feed for public + admin surfaces.
 * Merge: canonical base + customs (new slugs) + overrides (replace by slug),
 * hidden excluded unless requested, ordered by displayOrder. Client-only
 * (localStorage), hence the empty-first-paint then sync pattern shared with
 * other live collections.
 */
export function useLiveEvents(base: readonly Event[], options?: { includeHidden?: boolean }): Event[] {
  const customs = useLiveCollection('events', base)
  const overrides = useEventOverrides()
  const hidden = useHiddenEvents()
  const includeHidden = options?.includeHidden ?? false
  return useMemo(() => {
    const customOnly = customs.filter((entry) => !base.some((b) => b.slug === entry.slug))
    const baseSlugs = new Set(base.map((entry) => entry.slug))
    const merged: Event[] = [
      ...customOnly.filter((entry) => !baseSlugs.has(entry.slug)),
      ...base.map((entry) => overrides[entry.slug] ?? entry),
    ]
    for (const custom of customOnly) {
      if (baseSlugs.has(custom.slug)) {
        const idx = merged.findIndex((entry) => entry.slug === custom.slug)
        if (idx >= 0) merged[idx] = custom
      }
    }
    const ordered = [...merged].sort((a, b) => (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999))
    return includeHidden ? ordered : ordered.filter((entry) => !hidden.includes(entry.slug))
  }, [customs, base, overrides, hidden, includeHidden])
}

export function useLiveEvent(base: readonly Event[], slug: string, options?: { includeHidden?: boolean }): Event | undefined {
  const list = useLiveEvents(base, options)
  return list.find((entry) => entry.slug === slug)
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

/**
 * Pure fleet merge: canonical base + admin customs, canonical overrides
 * applied by slug, hidden slugs excluded unless requested. Exported for
 * focused verification; `useLiveCollection` is the reactive entry point.
 */
export function mergeCarFleet(
  base: readonly Car[],
  customs: readonly Car[],
  overrides: Record<string, Car>,
  hiddenCars: readonly string[],
  includeHidden: boolean,
): Car[] {
  const merged = customs.length ? [...customs, ...base] : [...base]
  const withOverrides = merged.map((car) =>
    car && typeof car.slug === 'string' && overrides[car.slug] ? { ...car, ...overrides[car.slug] } : car,
  )
  return includeHidden ? withOverrides : withOverrides.filter((car) => !hiddenCars.includes(car.slug))
}

/** Local canonical override for one vehicle slug, if any. */
export function useCarOverride(slug: string): Car | undefined {
  const [override, setOverride] = useState<Car | undefined>(undefined)
  useEffect(() => {
    const sync = () => setOverride(readOverrides().carOverrides[slug])
    sync()
    window.addEventListener('sp-overrides', sync)
    return () => window.removeEventListener('sp-overrides', sync)
  }, [slug])
  return override
}

export function useLiveCollection<T>(collection: OverrideCollection, base: readonly T[], options?: { includeHidden?: boolean }): T[] {
  const [customs, setCustoms] = useState<T[]>([])
  const [carMeta, setCarMeta] = useState(() => ({ overrides: empty.carOverrides, hidden: empty.hiddenCars }))
  useEffect(() => {
    const sync = () => {
      const data = readOverrides()
      setCustoms(data[collection] as T[])
      setCarMeta({ overrides: data.carOverrides, hidden: data.hiddenCars })
    }
    sync()
    window.addEventListener('sp-overrides', sync)
    return () => window.removeEventListener('sp-overrides', sync)
  }, [collection])
  const includeHidden = options?.includeHidden ?? false
  return useMemo(() => {
    if (collection !== 'cars') return customs.length ? [...customs, ...base] : [...base]
    return mergeCarFleet(base as unknown as Car[], customs as unknown as Car[], carMeta.overrides, carMeta.hidden, includeHidden) as unknown as T[]
  }, [customs, base, collection, includeHidden, carMeta])
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

/**
 * Catalogue prototype persistence: destinations and multi-day categories are
 * managed as admin customs. A custom record with the same slug REPLACES the
 * canonical record at merge time (never duplicated); brand-new slugs are
 * prepended. Visibility (`isPublished` / `active`) and ordering travel inside
 * the record, so no separate hidden lists are needed. Malformed stored entries
 * are dropped defensively. Backend path: destinations, multi_day_categories,
 * tour_multi_day_category tables; Tour.destinationSlug stays a plain FK.
 */
const cleanSlug = (value: unknown): string | null =>
  typeof value === 'string' && /^[a-z0-9-]{1,80}$/.test(value) ? value : null

const cleanText = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined

const cleanFlag = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

const cleanOrder = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

export function sanitizeDestination(value: unknown): Destination | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<Destination> & { detail?: unknown }
  const slug = cleanSlug(raw.slug)
  const title = cleanText(raw.title, 120)
  if (!slug || !title) return null
  if (typeof raw.detail !== 'object' || raw.detail === null) return null
  const detail = raw.detail as Destination['detail']
  if (!Array.isArray(detail.tourSlugs)) return null
  return {
    title,
    slug,
    image: typeof raw.image === 'string' ? raw.image.slice(0, 2000) : '',
    copy: typeof raw.copy === 'string' ? raw.copy.slice(0, 2000) : title,
    nameAr: cleanText(raw.nameAr, 120),
    copyAr: cleanText(raw.copyAr, 2000),
    showInOneDayTours: cleanFlag(raw.showInOneDayTours),
    showInDestinations: cleanFlag(raw.showInDestinations),
    isPublished: cleanFlag(raw.isPublished),
    displayOrder: cleanOrder(raw.displayOrder),
    detail: {
      ...detail,
      tourSlugs: detail.tourSlugs.filter((entry): entry is string => typeof entry === 'string'),
    },
  }
}

function sanitizeDestinations(value: unknown): Destination[] {
  if (!Array.isArray(value)) return []
  const out: Destination[] = []
  for (const entry of value) {
    const clean = sanitizeDestination(entry)
    if (clean) out.push(clean)
  }
  return out
}

export function sanitizeMultiDayCategory(value: unknown): MultiDayCategory | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<MultiDayCategory>
  const slug = cleanSlug(raw.slug)
  const name = cleanText(raw.name, 120)
  const nameAr = cleanText(raw.nameAr, 120)
  if (!slug || !name || !nameAr) return null
  return {
    slug,
    name,
    nameAr,
    copy: typeof raw.copy === 'string' ? raw.copy.slice(0, 2000) : name,
    copyAr: typeof raw.copyAr === 'string' ? raw.copyAr.slice(0, 2000) : nameAr,
    image: typeof raw.image === 'string' ? raw.image.slice(0, 2000) : '',
    order: cleanOrder(raw.order) ?? 999,
    active: typeof raw.active === 'boolean' ? raw.active : true,
  }
}

function sanitizeMultiDayCategories(value: unknown): MultiDayCategory[] {
  if (!Array.isArray(value)) return []
  const out: MultiDayCategory[] = []
  for (const entry of value) {
    const clean = sanitizeMultiDayCategory(entry)
    if (clean) out.push(clean)
  }
  return out
}

/**
 * Pure catalogue merge: canonical base + admin customs, customs win by slug,
 * genuinely new slugs prepended. Exported for focused verification; the
 * `useLive*` hooks below are the reactive entry points.
 */
export function mergeCatalogueBySlug<T extends { slug: string }>(base: readonly T[], customs: readonly T[]): T[] {
  if (!customs.length) return [...base]
  const customBySlug = new Map(customs.map((entry) => [entry.slug, entry]))
  const baseSlugs = new Set(base.map((entry) => entry.slug))
  return [
    ...customs.filter((entry) => !baseSlugs.has(entry.slug)),
    ...base.map((entry) => customBySlug.get(entry.slug) ?? entry),
  ]
}

export function mergeDestinations(base: readonly Destination[], customs: readonly Destination[]): Destination[] {
  return mergeCatalogueBySlug(base, customs)
}

export function mergeMultiDayCategories(base: readonly MultiDayCategory[], customs: readonly MultiDayCategory[]): MultiDayCategory[] {
  return mergeCatalogueBySlug(base, customs)
}

function useLiveCatalogue<T extends { slug: string }>(collection: 'destinations' | 'multiDayCategories', base: readonly T[], merge: (base: readonly T[], customs: readonly T[]) => T[]): T[] {
  const [customs, setCustoms] = useState<T[]>([])
  useEffect(() => {
    const sync = () => {
      const data = readOverrides()
      setCustoms(data[collection] as unknown as T[])
    }
    sync()
    window.addEventListener('sp-overrides', sync)
    return () => window.removeEventListener('sp-overrides', sync)
  }, [collection])
  return useMemo(() => merge(base, customs), [base, customs, merge])
}

export function useLiveDestinations(base: readonly Destination[]): Destination[] {
  return useLiveCatalogue('destinations', base, mergeDestinations)
}

export function useLiveMultiDayCategories(base: readonly MultiDayCategory[]): MultiDayCategory[] {
  return useLiveCatalogue('multiDayCategories', base, mergeMultiDayCategories)
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
