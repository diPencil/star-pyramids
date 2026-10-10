import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { EventDetailPage } from '@/components/extended-pages'
import { findEventBySlug, listEventSlugs } from '@/lib/server/events'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateStaticParams() {
  const slugs = await listEventSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const event = await findEventBySlug(slug)
  if (!event) {
    return { title: 'Event not found', description: 'This event is no longer available.', robots: { index: false, follow: false } }
  }
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries(`/events/${event.slug}`)
  const title = `${event.title} | STAR PYRAMIDS`
  const description = event.copy
    ? event.copy.slice(0, 160)
    : `Join ${event.title} with STAR PYRAMIDS. ${event.date ?? ''} in ${event.location ?? 'Egypt'}.`
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/events/${event.slug}`, languages: hreflang },
    openGraph: {
      title,
      description,
      type: 'article',
      images: event.image ? [{ url: event.image }] : [],
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
  if (!(await findEventBySlug(slug))) notFound()
  return <EventDetailPage slug={slug} />
}
