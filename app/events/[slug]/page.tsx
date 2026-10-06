import { notFound } from 'next/navigation'
import { EventDetailPage } from '@/components/extended-pages'
import { findEventBySlug, listEventSlugs } from '@/lib/server/events'

export async function generateStaticParams() {
  const slugs = await listEventSlugs()
  return slugs.map((slug) => ({ slug }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // DB-authoritative catalogue: unknown slugs are real 404s.
  if (!(await findEventBySlug(slug))) notFound()
  return <EventDetailPage slug={slug} />
}
