import type { Metadata } from 'next'
import { TripsPage } from '@/components/trips-page'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/trips')

  return {
    title: 'Egypt Trips | STAR PYRAMIDS',
    description: 'Explore one-day tours, multi-day journeys, Nile cruises, and shore excursions across Egypt.',
    alternates: { canonical: `${siteUrl}/trips`, languages: hreflang },
  }
}

export default function Page() {
  return <TripsPage />
}
