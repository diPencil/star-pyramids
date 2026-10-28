import type { Destination, Tour } from '@/data/types'
import { isTourPublished } from './tour-publish'

/** Listing visibility never detaches a published destination from its tours. */
export function listedDestinations(rows: readonly Destination[]): Destination[] {
  return rows.filter((row) => row.isPublished !== false && row.showInDestinations !== false)
}

/** Explicit editorial order first, then current database associations. Canonical slugs deduplicate aliases. */
export function destinationTours(destination: Destination, rows: readonly Tour[]): Tour[] {
  if (destination.isPublished === false) return []
  const published = rows.filter(isTourPublished)
  const selected = destination.detail.tourSlugs.flatMap((slug) => {
    const tour = published.find((row) => row.slug === slug) ?? published.find((row) => row.aliases?.includes(slug))
    return tour ? [tour] : []
  })
  const result = [...selected, ...published.filter((tour) => tour.destinationSlug === destination.slug)]
  return [...new Map(result.map((tour) => [tour.slug, tour])).values()]
}
