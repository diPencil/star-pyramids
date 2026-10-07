import { notFound } from 'next/navigation'
import { OfferDetailPage } from '@/components/extended-pages'
import { findOfferBySlug, listOfferSlugs } from '@/lib/server/offers'

export async function generateStaticParams() {
  const slugs = await listOfferSlugs()
  return slugs.map((slug) => ({ slug }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // DB-authoritative catalogue: unknown slugs are real 404s.
  if (!(await findOfferBySlug(slug))) notFound()
  return <OfferDetailPage slug={slug} />
}
