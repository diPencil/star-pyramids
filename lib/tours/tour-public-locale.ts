import type { Tour, TourDetail, DayTourDetail } from '@/data/types'
import type { Locale } from '../i18n/locale-config'
import type { Translatable } from './tour-translations'
import { resolveNarrative, type RichOwner, type RichField } from './tour-rich-text'

/** Display-only overlays. Never feed these values back to persistence or pricing. */
export function tourDisplayText(row: Translatable | undefined, key: string, canonical: string, locale: Locale): string {
  if (locale !== 'es' && locale !== 'it') return canonical
  const value = row?.translations?.[locale]?.[key]
  return typeof value === 'string' && value.trim() ? value : canonical
}

const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean)

function textFields<T extends Translatable>(row: T, keys: readonly string[], locale: Locale): T {
  const copy: Record<string, unknown> = { ...row }
  for (const key of keys) {
    const value = (row as Record<string, unknown>)[key]
    if (typeof value === 'string') copy[key] = tourDisplayText(row, key, value, locale)
  }
  return copy as T
}

function narrativeFields<T extends RichOwner>(row: T, keys: readonly RichField[], locale: Locale): T {
  const copy = { ...row, contentFormats: { ...row.contentFormats } }
  for (const field of keys) {
    const canonical = (row as Record<string, unknown>)[field]
    if (typeof canonical !== 'string') continue
    const resolved = resolveNarrative(row, field, canonical, locale)
    ;(copy as Record<string, unknown>)[field] = resolved.value
    if (row.contentFormats?.[field]) copy.contentFormats[field] = { ...row.contentFormats[field], en: resolved.format }
  }
  // Preserve absence on legacy objects (important for clean editor snapshots).
  if (!row.contentFormats) delete (copy as RichOwner).contentFormats
  return copy
}

function detailText<T extends TourDetail | DayTourDetail>(detail: T, locale: Locale): T {
  const copy = narrativeFields(detail, ['itineraryNote'], locale)
  for (const key of ['overview', 'included', 'excluded'] as const) {
    const value = detail[key]
    if (value && key === 'overview') {
      const resolved = resolveNarrative(detail, key, value.join('\n'), locale)
      copy.overview = resolved.format === 'html-v1' ? resolved.value ? [resolved.value] : [] : lines(resolved.value)
      if (detail.contentFormats?.overview) copy.contentFormats = { ...copy.contentFormats, overview: { ...detail.contentFormats.overview, en: resolved.format } }
    } else if (value) copy[key] = lines(tourDisplayText(detail, key, value.join('\n'), locale))
  }
  copy.addOns = detail.addOns?.map(row => textFields(row, ['title'], locale))
  copy.priceRows = detail.priceRows?.map(row => ({
    ...textFields(row, ['category', 'note', 'prefix'], locale),
    tiers: row.tiers?.map(tier => textFields(tier, ['label', 'suffix'], locale)),
  }))
  return copy
}

/** Stored basic translations live on the active detail object, as in editorData. */
export function localizePublicTour(source: Tour, locale: Locale): Tour {
  if (locale !== 'es' && locale !== 'it') return source
  const owner = source.category === 'one-day-tours' ? source.dayDetail : source.detail
  const tour = { ...source }
  for (const key of ['title', 'location', 'duration', 'summary', 'groupSize', 'travelStyle', 'departurePort'] as const) {
    if (typeof source[key] === 'string') tour[key] = tourDisplayText(owner, key, source[key], locale)
  }
  if (source.detail) tour.detail = {
    ...detailText(source.detail, locale),
    highlights: source.detail.highlights?.map(row => ({ ...textFields(row, ['title'], locale), items: lines(tourDisplayText(row, 'items', row.items.join('\n'), locale)) })),
    itinerary: source.detail.itinerary?.map(row => narrativeFields(textFields(row, ['day', 'title', 'meals'], locale), ['description'], locale)),
  }
  if (source.dayDetail) {
    const detail = source.dayDetail
    const highlightGroups = detail.highlightGroups?.map(row => ({ ...textFields(row, ['title'], locale), items: lines(tourDisplayText(row, 'items', row.items.join('\n'), locale)) }))
    tour.dayDetail = {
      ...detailText(detail, locale), highlightGroups,
      highlights: highlightGroups?.length ? highlightGroups.flatMap(row => row.items) : detail.highlights,
      stops: detail.stops?.map(row => narrativeFields(textFields(row, ['day', 'title', 'meals'], locale), ['description'], locale)),
      gallery: detail.gallery?.map((row, index) => ({ ...row, alt: tourDisplayText(source.galleryCaptions?.[index], 'alt', row.alt, locale) })),
    }
  }
  tour.galleryCaptions = source.galleryCaptions?.map(row => ({ ...row, en: tourDisplayText(row, 'alt', row.en, locale) }))
  tour.journeyVideos = source.journeyVideos?.map(row => textFields(row, ['title'], locale))
  return tour
}
