import { notFound } from 'next/navigation'
import { DestinationDetailPage } from '@/components/extended-pages'
import { destinations, findDestination } from '@/data/content'

export function generateStaticParams() {
  return destinations.map((item) => ({ slug: item.slug }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // Admin-prototype items use the shared `custom-` prefix (see CUSTOM_PREFIX in lib/admin-store)
  // and resolve client-side via live overrides; only canonical misses are real 404s.
  if (!findDestination(slug) && !slug.startsWith('custom-')) notFound()
  return <DestinationDetailPage slug={slug} />
}
