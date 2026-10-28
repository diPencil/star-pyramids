import 'server-only'
import { db } from './db'
import { WEBSITE_REVIEW_SCOPE } from '@/lib/review-scope'

/** Reviews have a snapshot slug, not a Tour foreign key. Never expose hidden tour fields. */
export async function reviewTrips(slugs: string[]) {
  const keys = [...new Set(slugs.filter(slug => slug !== WEBSITE_REVIEW_SCOPE))]
  if (!keys.length) return new Map<string, { slug: string; title: string; href: string }>()
  const tours = await db.tour.findMany({ where: { slug: { in: keys }, status: 'published' }, select: { slug: true, title: true } })
  return new Map(tours.map(tour => [tour.slug, { slug: tour.slug, title: tour.title, href: `/egypt-tours/${encodeURIComponent(tour.slug)}` }]))
}
