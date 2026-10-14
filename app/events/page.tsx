import type { Metadata } from 'next'
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
import { ServerShowcaseHero } from '@/components/server-showcase-hero'
import { EventsPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/events')

  return {
    title: 'Egypt Events',
    description: 'Discover upcoming events in Egypt — festivals, cultural celebrations, and special occasions with STAR PYRAMIDS.',
    alternates: { canonical: `${siteUrl}/events`, languages: hreflang },
    ...(await pageContentMetadata('events')),
  }
}

export default function Page() { return <ServerShowcaseHero id="events"><EventsPage /></ServerShowcaseHero> }
