import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { OfferDetailPage } from '@/components/extended-pages'
import { findOfferBySlug, listOfferSlugs } from '@/lib/server/offers/offers'
import { dynamicSeo } from '@/lib/seo/dynamic-seo'
import { RecordPageJsonLd } from '@/lib/seo/structured-data'
import { findTourBySlug } from '@/lib/server/catalogue/tours'
import { isTourPublished } from '@/lib/tours/tour-publish'

export async function generateStaticParams() {
  const slugs = await listOfferSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const offer = await findOfferBySlug(slug)
  if (!offer || offer.isPublished === false) {
    return { title: 'Offer not found', description: 'This offer is no longer available.', robots: { index: false, follow: false } }
  }
  if (offer.tourSlug) {
    const tour = await findTourBySlug(offer.tourSlug)
    if (!tour || !isTourPublished(tour)) {
      return { title: 'Tour not found', description: 'This tour is no longer available.', robots: { index: false, follow: false } }
    }
    return dynamicSeo(tour, 'tour', '/egypt-tours')
  }
  return dynamicSeo(offer, 'offer', '/special-offers')
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const offer = await findOfferBySlug(slug)
  if (!offer || offer.isPublished === false) notFound()
  if (offer.tourSlug) redirect(`/egypt-tours/${offer.tourSlug}`)
  return <><RecordPageJsonLd kind="offer" slug={offer.slug} name={offer.title} path={`/special-offers/${offer.slug}`} /><OfferDetailPage slug={slug} /></>
}
