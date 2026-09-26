import { notFound } from 'next/navigation'
import { OfferDetailPage } from '@/components/extended-pages'
import { findOffer, offers } from '@/data/content'

export function generateStaticParams() {
  return offers.map((item) => ({ slug: item.slug }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // Admin-prototype items use the shared `custom-` prefix (see CUSTOM_PREFIX in lib/admin-store)
  // and resolve client-side via live overrides; only canonical misses are real 404s.
  if (!findOffer(slug) && !slug.startsWith('custom-')) notFound()
  return <OfferDetailPage slug={slug} />
}
