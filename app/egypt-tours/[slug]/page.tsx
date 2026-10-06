import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site'
import { TourDetailPage } from '@/components/tour-detail'
import { DayTourDetailPage } from '@/components/day-tour-detail'
import { findTourBySlug, getRelatedDbTours, listTourRouteSlugs } from '@/lib/server/tours'

export async function generateStaticParams() {
  // DB-authoritative static params (canonical slugs + aliases).
  // Falls back to no pre-render when the DB is unreachable at build time;
  // request-time rendering still resolves from the DB.
  try {
    const slugs = await listTourRouteSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export default async function TourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // DB-authoritative catalogue read with alias resolution (server-only, no fetch).
  const tour = await findTourBySlug(slug)
  if (!tour) notFound()
  const related = await getRelatedDbTours(tour)

  return <SiteShell>{tour.category === 'one-day-tours' ? <DayTourDetailPage tour={tour} related={related} /> : <TourDetailPage tour={tour} related={related} />}</SiteShell>
}
