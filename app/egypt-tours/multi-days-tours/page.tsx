import type { Metadata } from 'next'
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
import { ServerShowcaseHero } from '@/components/server-showcase-hero'
import { TourListing } from '@/components/site'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/egypt-tours/multi-days-tours')

  return {
    title: 'Multi-Day Egypt Tours',
    description: 'Book extended Egypt journeys with STAR PYRAMIDS. Multi-day trips covering Cairo, Luxor, Aswan, and Nile cruises from 3 to 15 days with expert guides.',
    alternates: { canonical: `${siteUrl}/egypt-tours/multi-days-tours`, languages: hreflang },
    ...(await pageContentMetadata('multi-day')),
  }
}

export default function Page() {
  return <ServerShowcaseHero id="multi-day"><TourListing slug="multi-days-tours" /></ServerShowcaseHero>
}
