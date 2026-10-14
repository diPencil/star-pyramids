import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { EventDetailPage } from '@/components/extended-pages'
import { findEventBySlug, listEventSlugs } from '@/lib/server/events'
import { dynamicSeo } from '@/lib/dynamic-seo'
import { RecordPageJsonLd } from '@/lib/structured-data'

export async function generateStaticParams() {
  const slugs = await listEventSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const event = await findEventBySlug(slug)
  if (!event || event.isPublished === false) {
    return { title: 'Event not found', description: 'This event is no longer available.', robots: { index: false, follow: false } }
  }
  return dynamicSeo(event, 'event', '/events')
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await findEventBySlug(slug)
  if (!event || event.isPublished === false) notFound()
  return <><RecordPageJsonLd kind="event" slug={event.slug} name={event.title} path={`/events/${event.slug}`} /><EventDetailPage slug={slug} /></>
}
