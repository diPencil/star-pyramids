import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { DestinationDetailPage } from '@/components/extended-pages'
import { findDestinationBySlug, listDestinationSlugs } from '@/lib/server/destinations'
import { dynamicSeo } from '@/lib/dynamic-seo'
import { RecordPageJsonLd } from '@/lib/structured-data'

export async function generateStaticParams() {
  try {
    const slugs = await listDestinationSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const destination = await findDestinationBySlug(slug).catch(() => null)
  if (!destination || destination.isPublished === false) {
    return { title: 'Destination not found', description: 'This destination is no longer available.', robots: { index: false, follow: false } }
  }
  return dynamicSeo(destination, 'destination', '/destinations')
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const destination = await findDestinationBySlug(slug).catch(() => null)
  if (!destination || destination.isPublished === false) notFound()
  return <><RecordPageJsonLd kind="destination" slug={destination.slug} name={destination.title} path={`/destinations/${destination.slug}`} /><DestinationDetailPage slug={slug} /></>
}
