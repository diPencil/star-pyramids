'use client'

import type { Event } from '@/data/types'

const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/
const CUSTOM_PREFIX = 'custom-'
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^(\d{2}):(\d{2})$/

const text = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined
  const clean = value.trim()
  if (!clean) return undefined
  return clean.slice(0, max)
}

const requiredText = (value: unknown, max: number): string | null => {
  const clean = text(value, max)
  return clean ?? null
}

const textList = (value: unknown, max: number): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const out = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.slice(0, max))
  return out.length ? out : undefined
}

const isoDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value.trim())) return undefined
  const clean = value.trim()
  const [y, m, d] = clean.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined
  return clean
}

const clockTime = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value.trim())) return undefined
  const [h, m] = value.trim().split(':').map(Number)
  if (h > 23 || m > 59) return undefined
  return value.trim()
}

/** Centralized Event sanitizer. Malformed stored data fails safe (null = dropped). */
export function sanitizeEvent(value: unknown): Event | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<Event> & { gallery?: unknown }
  const slug = typeof raw.slug === 'string' ? raw.slug.trim() : ''
  if (!SLUG_PATTERN.test(slug)) return null
  const title = requiredText(raw.title, 140)
  if (!title) return null
  const date = requiredText(raw.date, 120)
  if (!date) return null
  const location = requiredText(raw.location, 160)
  if (!location) return null
  const copy = requiredText(raw.copy, 2000)
  if (!copy) return null
  const image = typeof raw.image === 'string' ? raw.image.trim().slice(0, 2000) : ''

  const highlights = Array.isArray(raw.highlights)
    ? raw.highlights
        .filter((h): h is Record<string, unknown> => typeof h === 'object' && h !== null)
        .map((h) => ({
          title: typeof h.title === 'string' ? h.title.trim().slice(0, 140) : '',
          titleAr: typeof h.titleAr === 'string' && h.titleAr.trim() ? h.titleAr.trim().slice(0, 140) : undefined,
          description: typeof h.description === 'string' ? h.description.trim().slice(0, 1000) : '',
          descriptionAr: typeof h.descriptionAr === 'string' && h.descriptionAr.trim() ? h.descriptionAr.trim().slice(0, 1000) : undefined,
        }))
        .filter((h) => h.title && h.description)
    : undefined

  const program = Array.isArray(raw.program)
    ? raw.program
        .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
        .map((p) => ({
          day: typeof p.day === 'string' ? p.day.trim().slice(0, 60) : '',
          title: typeof p.title === 'string' ? p.title.trim().slice(0, 160) : '',
          description: typeof p.description === 'string' ? p.description.trim().slice(0, 2000) : '',
        }))
        .filter((p) => p.day && p.title)
    : undefined

  const addOns = Array.isArray(raw.addOns)
    ? raw.addOns
        .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
        .map((a) => ({
          title: typeof a.title === 'string' ? a.title.trim().slice(0, 120) : '',
          price: typeof a.price === 'number' && Number.isFinite(a.price) && a.price >= 0 ? Math.round(a.price * 100) / 100 : undefined,
        }))
        .filter((a) => a.title)
    : undefined

  const pricingType = raw.pricingType === 'free' || raw.pricingType === 'paid' || raw.pricingType === 'request' ? raw.pricingType : undefined
  const price = typeof raw.price === 'number' && Number.isFinite(raw.price) && raw.price >= 0 ? Math.round(raw.price * 100) / 100 : undefined
  const capacity = typeof raw.capacity === 'number' && Number.isInteger(raw.capacity) && raw.capacity > 0 && raw.capacity <= 100000 ? raw.capacity : undefined
  const displayOrder = typeof raw.displayOrder === 'number' && Number.isFinite(raw.displayOrder) ? Math.max(-9999, Math.min(9999, Math.round(raw.displayOrder))) : undefined

  const gallery = Array.isArray(raw.gallery)
    ? raw.gallery.filter((g): g is string => typeof g === 'string' && g.trim().length > 0).map((g) => g.trim().slice(0, 2000)).slice(0, 12)
    : undefined

  return {
    title,
    titleAr: text(raw.titleAr, 140),
    slug,
    image,
    gallery: gallery?.length ? gallery : undefined,
    date,
    startDate: isoDate(raw.startDate),
    endDate: isoDate(raw.endDate),
    startTime: clockTime(raw.startTime),
    endTime: clockTime(raw.endTime),
    timezone: text(raw.timezone, 60),
    location,
    locationAr: text(raw.locationAr, 160),
    venueName: text(raw.venueName, 160),
    venueNameAr: text(raw.venueNameAr, 160),
    address: text(raw.address, 300),
    addressAr: text(raw.addressAr, 300),
    city: text(raw.city, 100),
    cityAr: text(raw.cityAr, 100),
    mapQuery: text(raw.mapQuery, 300),
    copy,
    copyAr: text(raw.copyAr, 2000),
    category: text(raw.category, 80),
    categoryAr: text(raw.categoryAr, 80),
    featured: typeof raw.featured === 'boolean' ? raw.featured : undefined,
    intro: text(raw.intro, 2000),
    introAr: text(raw.introAr, 2000),
    pricingType,
    price,
    currency: text(raw.currency, 8)?.toUpperCase(),
    capacity,
    bookingDeadline: isoDate(raw.bookingDeadline),
    organizerName: text(raw.organizerName, 140),
    organizerNameAr: text(raw.organizerNameAr, 140),
    organizerPhone: text(raw.organizerPhone, 40),
    organizerWhatsapp: text(raw.organizerWhatsapp, 40),
    organizerEmail: text(raw.organizerEmail, 120),
    isPublished: typeof raw.isPublished === 'boolean' ? raw.isPublished : undefined,
    displayOrder,
    highlights: highlights?.length ? highlights : undefined,
    program: program?.length ? program : undefined,
    included: textList(raw.included, 300),
    includedAr: textList((raw as { includedAr?: unknown }).includedAr, 300),
    excluded: textList(raw.excluded, 300),
    excludedAr: textList((raw as { excludedAr?: unknown }).excludedAr, 300),
    addOns: addOns?.length ? addOns : undefined,
  }
}

export function sanitizeEventList(value: unknown): Event[] {
  if (!Array.isArray(value)) return []
  const out: Event[] = []
  for (const entry of value) {
    const clean = sanitizeEvent(entry)
    if (clean) out.push(clean)
  }
  return out
}

export function isCustomEventSlug(slug: string) {
  return slug.startsWith(CUSTOM_PREFIX)
}

const LEGACY_MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

/** Legacy free-text fallback. Returns nulls when unparseable. Never guessed. */
export function parseLegacyEventRange(date: string): { start: Date | null; end: Date | null } {
  if (!date.trim()) return { start: null, end: null }
  const clean = date.replace(/(\d+)(st|nd|rd|th)/g, '$1')
  const tailYear = (clean.match(/(\d{4})\s*$/) || [])[1]
  const parts = [...clean.matchAll(/([A-Za-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/g)]
    .map((m) => ({ month: LEGACY_MONTHS[m[1].toLowerCase()], day: Number(m[2]), year: m[3] ? Number(m[3]) : null }))
    .filter((p) => p.month !== undefined)
  if (!parts.length) return { start: null, end: null }
  const fallbackYear = tailYear ? Number(tailYear) : new Date().getFullYear()
  const start = new Date(parts[0].year ?? fallbackYear, parts[0].month, parts[0].day)
  if (Number.isNaN(start.getTime())) return { start: null, end: null }
  if (parts.length > 1) {
    const end = new Date(parts[1].year ?? fallbackYear, parts[1].month, parts[1].day)
    return { start, end: Number.isNaN(end.getTime()) ? start : end }
  }
  const secondDay = (clean.match(/[–—-]\s*(\d{1,2})/) || [])[1]
  if (!secondDay) return { start, end: start }
  const end = new Date(parts[0].year ?? fallbackYear, parts[0].month, Number(secondDay))
  return { start, end: Number.isNaN(end.getTime()) ? start : end }
}

export type EffectiveEventRange = { start: Date | null; end: Date | null; structured: boolean }

/** Structured ISO dates win; legacy free text is fallback only. */
export function resolveEventRange(event: Pick<Event, 'startDate' | 'endDate' | 'date'>): EffectiveEventRange {
  const start = event.startDate ? new Date(`${event.startDate}T00:00:00`) : null
  const end = event.endDate ? new Date(`${event.endDate}T00:00:00`) : start
  if (start && !Number.isNaN(start.getTime())) {
    const validEnd = end && !Number.isNaN(end.getTime()) ? end : start
    return { start, end: validEnd, structured: true }
  }
  const legacy = parseLegacyEventRange(event.date)
  return { ...legacy, structured: false }
}

export type EventStatus = 'upcoming' | 'ongoing' | 'past' | 'unknown'

/**
 * Status from resolved range. Invalid/unparseable dates return 'unknown' and
 * must NEVER be counted as upcoming (audit fix).
 */
export function getEventStatus(event: Pick<Event, 'startDate' | 'endDate' | 'date'>, now = Date.now()): EventStatus {
  const { start, end } = resolveEventRange(event)
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'unknown'
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  const s = new Date(start); s.setHours(0, 0, 0, 0)
  const e = new Date(end); e.setHours(0, 0, 0, 0)
  if (day < s) return 'upcoming'
  if (day > e) return 'past'
  return s.getTime() === e.getTime() ? 'upcoming' : 'ongoing'
}

export function isEventPublished(event: Event) {
  return event.isPublished !== false
}

/** Canonical baseline + customs (new slugs prepended) + overrides (replace by slug). Hidden excluded unless requested. */
export function mergeEvents(
  base: readonly Event[],
  customs: readonly Event[],
  overrides: Record<string, Event>,
  hidden: readonly string[],
  includeHidden = false,
): Event[] {
  const cleanCustoms = sanitizeEventList(customs)
  const cleanOverrides: Record<string, Event> = {}
  for (const [slug, entry] of Object.entries(overrides)) {
    const clean = sanitizeEvent(entry)
    if (clean && clean.slug === slug) cleanOverrides[slug] = clean
  }
  const baseSlugs = new Set(base.map((e) => e.slug))
  const merged: Event[] = [
    ...cleanCustoms.filter((e) => !baseSlugs.has(e.slug)),
    ...base.map((e) => cleanOverrides[e.slug] ?? e),
  ]
  // A custom slug that collides with a canonical slug edits in place (same semantics as catalogue).
  for (const custom of cleanCustoms) {
    if (baseSlugs.has(custom.slug)) {
      const idx = merged.findIndex((e) => e.slug === custom.slug)
      if (idx >= 0) merged[idx] = { ...merged[idx], ...custom, slug: merged[idx].slug }
    }
  }
  const ordered = [...merged].sort((a, b) => (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999))
  return includeHidden ? ordered : ordered.filter((e) => !hidden.includes(e.slug))
}

export function getEffectiveEvents(base: readonly Event[], customs: readonly Event[], overrides: Record<string, Event>, hidden: readonly string[], includeHidden = false) {
  return mergeEvents(base, customs, overrides, hidden, includeHidden)
}

export function getPublishedEvents(list: readonly Event[]) {
  return list.filter(isEventPublished)
}

export function getEventBySlug(list: readonly Event[], slug: string) {
  return list.find((e) => e.slug === slug)
}

export function getUpcomingEvents(list: readonly Event[], now = Date.now()) {
  return list.filter((e) => getEventStatus(e, now) === 'upcoming' || getEventStatus(e, now) === 'ongoing')
}

export function getPastEvents(list: readonly Event[], now = Date.now()) {
  return list.filter((e) => getEventStatus(e, now) === 'past')
}

export function eventCity(event: Pick<Event, 'city' | 'location'>): string {
  return event.city?.trim() || event.location.split(/[,&]| to /).map((s) => s.trim()).filter(Boolean)[0] || event.location
}

export function eventMapQuery(event: Pick<Event, 'mapQuery' | 'venueName' | 'city' | 'location'>): string {
  if (event.mapQuery?.trim()) return event.mapQuery.trim()
  const parts = [event.venueName?.trim(), event.city?.trim()].filter(Boolean)
  if (parts.length) return `${parts.join(', ')} Egypt`
  const firstCity = event.location.split(/[,&]| to /).map((s) => s.trim()).filter(Boolean)[0]
  return `${firstCity || event.location} Egypt`
}

export function eventPriceLabel(event: Pick<Event, 'pricingType' | 'price' | 'currency'>, ar: boolean): string {
  if (event.pricingType === 'free') return ar ? 'مجاني' : 'Free'
  if (event.pricingType === 'paid' && typeof event.price === 'number') {
    const cur = event.currency || 'USD'
    try {
      return `${ar ? 'من' : 'From'} ${new Intl.NumberFormat(ar ? 'ar-EG' : 'en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(event.price)}`
    } catch {
      return `${ar ? 'من' : 'From'} ${event.price} ${cur}`
    }
  }
  return ar ? 'السعر عند الطلب' : 'Request price'
}

export function eventStatusLabel(status: EventStatus, ar: boolean): string | null {
  if (status === 'upcoming') return ar ? 'قادم' : 'Upcoming'
  if (status === 'ongoing') return ar ? 'يُقام الآن' : 'Ongoing'
  if (status === 'past') return ar ? 'انتهى' : 'Past'
  return null
}

/** Deterministic related: published only, exclude current, same category/city first, then soonest. */
export function getRelatedEvents(current: Event, list: readonly Event[], limit = 2): Event[] {
  const pool = list.filter((e) => e.slug !== current.slug && isEventPublished(e))
  const score = (e: Event) => (e.category && e.category === current.category ? 0 : 1) * 10 + (eventCity(e) === eventCity(current) ? 0 : 5)
  return [...pool]
    .map((e) => ({ e, s: score(e), t: resolveEventRange(e).start?.getTime() ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.s - b.s || a.t - b.t)
    .slice(0, limit)
    .map((r) => r.e)
}

export function hasDuplicateSlugs(list: readonly { slug: string }[]): boolean {
  return new Set(list.map((e) => e.slug)).size !== list.length
}
