import { notFound } from 'next/navigation'
import { EventDetailPage } from '@/components/extended-pages'
import { events, findEvent } from '@/data/content'

export function generateStaticParams() {
  return events.map((item) => ({ slug: item.slug }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // Admin-prototype items use the shared `custom-` prefix (see CUSTOM_PREFIX in lib/admin-store)
  // and resolve client-side via live overrides; only canonical misses are real 404s.
  if (!findEvent(slug) && !slug.startsWith('custom-')) notFound()
  return <EventDetailPage slug={slug} />
}
