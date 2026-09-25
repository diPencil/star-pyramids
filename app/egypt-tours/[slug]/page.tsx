import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site'
import { TourDetailPage } from '@/components/tour-detail'
import { DayTourDetailPage } from '@/components/day-tour-detail'
import { findTour, tourRouteSlugs } from '@/data/tours'

export function generateStaticParams() {
  return tourRouteSlugs.map((slug) => ({ slug }))
}

export default async function TourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tour = findTour(slug)
  if (!tour) notFound()

  return <SiteShell>{tour.category === 'one-day-tours' ? <DayTourDetailPage tour={tour} /> : <TourDetailPage tour={tour} />}</SiteShell>
}
