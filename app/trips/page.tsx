import type { Metadata } from 'next'
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
import { TripsPage } from '@/components/trips-page'
import { ServerShowcaseHero } from '@/components/server-showcase-hero'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/trips')

  return {
    title: { absolute: 'Egypt Trips | STAR PYRAMIDS' },
    description: 'Explore one-day tours, multi-day journeys, Nile cruises, and shore excursions across Egypt.',
    alternates: { canonical: `${siteUrl}/trips`, languages: hreflang },
    ...(await pageContentMetadata('trips')),
  }
}

export default function Page() {
  return <ServerShowcaseHero id="trips"><TripsPage /></ServerShowcaseHero>
}
