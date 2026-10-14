import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SiteShell } from '@/components/site'
import { TourDetailPage } from '@/components/tour-detail'
import { DayTourDetailPage } from '@/components/day-tour-detail'
import { findTourBySlug, getRelatedDbTours, listTourRouteSlugs } from '@/lib/server/tours'
import { isTourPublished } from '@/lib/tour-publish'
import { generateTouristTripJsonLd, generateBreadcrumbJsonLd, renderJsonLd } from '@/lib/structured-data'
import { getSiteUrl } from '@/lib/seo'
import { dynamicSeo, recordStructuredDataEnabled } from '@/lib/dynamic-seo'
import { getServerLocale } from '@/lib/server/locale'
import { getTourDestinationSlug } from '@/data/tours'
import { getPublishedOneDayDestinations } from '@/lib/server/destinations'

export async function generateStaticParams() {
  try {
    const slugs = await listTourRouteSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tour = await findTourBySlug(slug)
  if (!tour || !isTourPublished(tour)) {
    return { title: 'Tour not found', description: 'This tour is no longer available.', robots: { index: false, follow: false } }
  }
  return dynamicSeo(tour, 'tour', '/egypt-tours')
}

export default async function TourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const tour = await findTourBySlug(slug)
  if (!tour || !isTourPublished(tour)) notFound()
  const related = await getRelatedDbTours(tour)

  const siteUrl = await getSiteUrl()
  const schemaEnabled = await recordStructuredDataEnabled('tour', tour.slug)
  const serverLocale = await getServerLocale()
  const tourJsonLd = generateTouristTripJsonLd(tour)
  const regionSlug = schemaEnabled && tour.category === 'one-day-tours' ? getTourDestinationSlug(tour) : undefined
  const region = regionSlug
    ? (await getPublishedOneDayDestinations().catch(() => [])).find((item) => item.slug === regionSlug)
    : undefined
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: siteUrl },
    { name: tour.category === 'one-day-tours' ? 'One Day Tours' : 'Egypt Tours', url: `${siteUrl}/egypt-tours/${tour.category}` },
    ...(region ? [{ name: region.title, url: `${siteUrl}/egypt-tours/one-day-tours/${region.slug}` }] : []),
    { name: tour.title, url: `${siteUrl}/egypt-tours/${tour.slug}` },
  ])

  return (
    <>
      {schemaEnabled && renderJsonLd(tourJsonLd)}
      {schemaEnabled && renderJsonLd(breadcrumbJsonLd)}
      <SiteShell initialLocale={serverLocale}>{tour.category === 'one-day-tours' ? <DayTourDetailPage tour={tour} related={related} /> : <TourDetailPage tour={tour} related={related} />}</SiteShell>
    </>
  )
}
