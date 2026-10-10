import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SiteShell } from '@/components/site'
import { TourDetailPage } from '@/components/tour-detail'
import { DayTourDetailPage } from '@/components/day-tour-detail'
import { findTourBySlug, getRelatedDbTours, listTourRouteSlugs } from '@/lib/server/tours'
import { isTourPublished } from '@/lib/tour-publish'
import { generateTouristTripJsonLd, generateBreadcrumbJsonLd, renderJsonLd } from '@/lib/structured-data'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'
import { getServerLocale } from '@/lib/server/locale'

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
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries(`/egypt-tours/${tour.slug}`)
  const title = `${tour.title} | STAR PYRAMIDS`
  const description = tour.summary?.trim()
    ? tour.summary.slice(0, 160)
    : `Book ${tour.title} with STAR PYRAMIDS. ${tour.duration} ${tour.category.replace(/-/g, ' ')} in ${tour.location}, Egypt. Expert guides, private tours, and unforgettable experiences.`
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/egypt-tours/${tour.slug}`, languages: hreflang },
    openGraph: {
      title,
      description,
      type: 'website',
      images: tour.image ? [{ url: tour.image }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function TourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const tour = await findTourBySlug(slug)
  if (!tour || !isTourPublished(tour)) notFound()
  const related = await getRelatedDbTours(tour)

  const siteUrl = await getSiteUrl()
  const serverLocale = await getServerLocale()
  const tourJsonLd = generateTouristTripJsonLd(tour)
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: siteUrl },
    { name: 'Egypt Tours', url: `${siteUrl}/egypt-tours` },
    { name: tour.title, url: `${siteUrl}/egypt-tours/${tour.slug}` },
  ])

  return (
    <>
      {renderJsonLd(tourJsonLd)}
      {renderJsonLd(breadcrumbJsonLd)}
      <SiteShell initialLocale={serverLocale}>{tour.category === 'one-day-tours' ? <DayTourDetailPage tour={tour} related={related} /> : <TourDetailPage tour={tour} related={related} />}</SiteShell>
    </>
  )
}
