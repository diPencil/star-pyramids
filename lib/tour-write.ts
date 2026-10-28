import { readJsonText } from './json-text'
import type { Tour } from '@/data/types'

/** Explicit clears must survive JSON.stringify and Prisma's omitted-field semantics. */
export function tourWritePayload(tour: Tour, status: 'draft' | 'published') {
  return {
    ...tour, status,
    expectedUpdatedAt: (tour as Tour & { updatedAt?: string }).updatedAt,
    titleAr: tour.titleAr || null, groupSize: tour.groupSize || null,
    travelStyle: tour.travelStyle || null, cruiseType: tour.cruiseType || null,
    departurePort: tour.departurePort || null, deal: tour.deal ?? null,
    ...(tour.category === 'one-day-tours' ? { detail: null } : { dayDetail: null }),
  }
}
const categories = ['one-day-tours', 'multi-days-tours', 'nile-cruises', 'shore-excursions']
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
function money(value: unknown) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 99999999.99 }
/** Matches the existing Next image loader: uploaded/local assets or configured remote hosts. */
export function isTourImage(value: unknown): boolean {
  if (typeof value !== 'string' || !value || /[\\\s\u0000-\u001f]/.test(value)) return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && ['images.unsplash.com', 'upload.wikimedia.org'].includes(url.hostname)
  } catch { return false }
}
export function validateTourWrite(input: unknown, creating = false): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid tour data.')
  const data = input as Record<string, unknown>
  if (creating && ['title', 'slug', 'category', 'price'].some(key => data[key] === undefined)) throw Error('Enter title, slug, category and base price.')
  if (data.expectedUpdatedAt !== undefined && (typeof data.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(data.expectedUpdatedAt)))) throw Error('Invalid tour revision.')
  if (data.slug !== undefined && (typeof data.slug !== 'string' || !slugPattern.test(data.slug) || data.slug.length > 80)) throw Error('Enter a valid tour slug.')
  if (data.category !== undefined && !categories.includes(String(data.category))) throw Error('Choose a supported tour category.')
  if (data.status !== undefined && !['draft', 'published'].includes(String(data.status))) throw Error('Choose draft or published status.')
  if (data.price !== undefined && !money(data.price)) throw Error('Enter a valid non-negative USD base price.')
  const lengths = { title: 200, titleAr: 200, location: 120, duration: 80, image: 255, groupSize: 40, travelStyle: 40, departurePort: 80, cruiseType: 32, destinationSlug: 80 }
  const nullable = new Set(['titleAr', 'groupSize', 'travelStyle', 'departurePort', 'cruiseType', 'destinationSlug'])
  for (const [key, max] of Object.entries(lengths)) {
    const value = data[key]
    if (value === undefined || value === null && nullable.has(key)) continue
    if (typeof value !== 'string' || value.length > max || key === 'title' && !value.trim()) throw Error(`Check tour ${key}.`)
  }
  if (data.image !== undefined && data.image !== '' && !isTourImage(data.image)) throw Error('Use an uploaded/local image or a configured Unsplash/Wikimedia image URL.')
  if (data.gallery !== undefined && (!Array.isArray(data.gallery) || data.gallery.length > 12 || data.gallery.some(value => !isTourImage(value)))) throw Error('Check the gallery image URLs (maximum 12).')
  if (data.aliases !== undefined && (!Array.isArray(data.aliases) || data.aliases.length > 100 || data.aliases.some(value => typeof value !== 'string' || value.length > 80 || !slugPattern.test(value)) || new Set(data.aliases).size !== data.aliases.length)) throw Error('Check unique tour aliases.')
  for (const key of ['detail', 'dayDetail']) {
    if (data[key] == null) continue
    const detail = readJsonText(data[key])
    if (!detail || typeof detail !== 'object' || Array.isArray(detail)) throw Error('Invalid tour detail.')
    const rates = (detail as Record<string, unknown>).travelerPrices
    if (rates !== undefined) {
      if (!Array.isArray(rates) || rates.length > 60) throw Error('Check traveler pricing tiers.')
      const counts = new Set<number>()
      for (const rate of rates) {
        if (!rate || typeof rate !== 'object' || !Number.isInteger(rate.travelers) || rate.travelers < 1 || rate.travelers > 60 || counts.has(rate.travelers)) throw Error('Check unique traveler counts (1–60).')
        counts.add(rate.travelers)
        for (const field of ['price', 'adultPrice', 'childPrice', 'infantPrice']) if (rate[field] !== undefined && !money(rate[field])) throw Error('Check non-negative traveler prices.')
      }
    }
    const addons = (detail as Record<string, unknown>).addOns
    if (addons !== undefined && (!Array.isArray(addons) || addons.some(row => !row || typeof row.title !== 'string' || row.price !== undefined && !money(row.price)))) throw Error('Check tour add-on prices.')
  }
  if (data.deal != null) {
    const deal = readJsonText(data.deal) as { percent?: unknown; endsAt?: unknown } | null
    if (!deal || typeof deal.percent !== 'number' || !Number.isFinite(deal.percent) || deal.percent <= 0 || deal.percent >= 100 || typeof deal.endsAt !== 'string' || !Number.isFinite(Date.parse(deal.endsAt))) throw Error('Check the discount and expiry date.')
  }
}

/** A status-only publish cannot bypass the content requirements of the editor. */
export function validateTourPublication(input: Record<string, unknown>): void {
  validateTourWrite(input)
  for (const key of ['title', 'duration', 'image']) if (typeof input[key] !== 'string' || !String(input[key]).trim()) throw Error('Complete the title, duration and cover image before publishing.')
  if (!money(input.price)) throw Error('Enter a valid non-negative USD base price.')
  if (input.category === 'one-day-tours' && (typeof input.destinationSlug !== 'string' || !input.destinationSlug.trim())) throw Error('Select a destination before publishing the one-day tour.')
  const categorySlugs = readJsonText(input.categorySlugs)
  if (input.category === 'multi-days-tours' && (!Array.isArray(categorySlugs) || !categorySlugs.length || categorySlugs.some(slug => typeof slug !== 'string' || !slugPattern.test(slug)))) throw Error('Select at least one valid multi-day category before publishing.')
  if (input.category === 'nile-cruises' && !input.cruiseType) throw Error('Select a Nile cruise type before publishing.')
  if (input.category === 'shore-excursions' && (typeof input.departurePort !== 'string' || !input.departurePort.trim())) throw Error('Enter a departure port before publishing.')
}
