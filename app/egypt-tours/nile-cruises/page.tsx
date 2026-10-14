import type { Metadata } from 'next'
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
import { ServerShowcaseHero } from '@/components/server-showcase-hero'
import { TourListing } from '@/components/site'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/egypt-tours/nile-cruises')

  return {
    title: 'Nile Cruises',
    description: 'Book Nile cruise experiences with STAR PYRAMIDS. Multi-day voyages from Luxor to Aswan, including 3-day, 4-day, 7-day, and 8-day cruise itineraries with guided shore excursions.',
    alternates: { canonical: `${siteUrl}/egypt-tours/nile-cruises`, languages: hreflang },
    ...(await pageContentMetadata('nile')),
  }
}

export default function Page() {
  return <ServerShowcaseHero id="nile"><TourListing slug="nile-cruises" /></ServerShowcaseHero>
}
