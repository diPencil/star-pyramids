import { getPublishedOneDayDestinations } from '@/lib/server/destinations'
import { OneDayDestinationPage } from '@/components/site'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { dynamicSeo } from '@/lib/dynamic-seo'
import { RecordPageJsonLd } from '@/lib/structured-data'

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }): Promise<Metadata> {
  const { region } = await params
  const destination = (await getPublishedOneDayDestinations()).find((item) => item.slug === region)
  if (!destination) {
    return { title: 'Destination not found', description: 'This destination is no longer available.', robots: { index: false, follow: false } }
  }
  return dynamicSeo(destination, 'destination', '/egypt-tours/one-day-tours')
}

export async function generateStaticParams() {
  // DB-authoritative static params; no pre-render when DB is unreachable.
  try {
    const items = await getPublishedOneDayDestinations()
    return items.map((item) => ({ region: item.slug }))
  } catch {
    return []
  }
}

export default async function Page({ params }: { params: Promise<{ region: string }> }) {
  const { region: regionSlug } = await params
  const destination = (await getPublishedOneDayDestinations()).find((item) => item.slug === regionSlug)
  if (!destination) notFound()
  return <><RecordPageJsonLd kind="destination" slug={destination.slug} name={destination.title} path={`/egypt-tours/one-day-tours/${destination.slug}`} collection /><OneDayDestinationPage slug={regionSlug} /></>
}
