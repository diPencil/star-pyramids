import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { OfferDetailPage } from '@/components/extended-pages'
import { findOfferBySlug, listOfferSlugs } from '@/lib/server/offers'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateStaticParams() {
  const slugs = await listOfferSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const offer = await findOfferBySlug(slug)
  if (!offer) {
    return { title: 'Offer not found', description: 'This offer is no longer available.', robots: { index: false, follow: false } }
  }
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries(`/special-offers/${offer.slug}`)
  const title = `${offer.title} | STAR PYRAMIDS`
  const description = offer.copy
    ? offer.copy.slice(0, 160)
    : `Book ${offer.title} with STAR PYRAMIDS. Special offer for Egypt tours.`
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/special-offers/${offer.slug}`, languages: hreflang },
    openGraph: {
      title,
      description,
      type: 'website',
      images: offer.image ? [{ url: offer.image }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const offer = await findOfferBySlug(slug)
  if (!offer) notFound()
  if (offer.tourSlug) redirect(`/egypt-tours/${offer.tourSlug}`)
  return <OfferDetailPage slug={slug} />
}
