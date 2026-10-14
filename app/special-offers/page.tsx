import type { Metadata } from 'next'
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
import { ServerShowcaseHero } from '@/components/server-showcase-hero'
import { OffersPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/special-offers')

  return {
    title: 'Special Offers',
    description: 'Discover exclusive STAR PYRAMIDS special offers on Egypt tours, Nile cruises, and travel packages. Save on your next Egypt adventure.',
    alternates: { canonical: `${siteUrl}/special-offers`, languages: hreflang },
    ...(await pageContentMetadata('offers')),
  }
}

export default function Page() { return <ServerShowcaseHero id="offers"><OffersPage /></ServerShowcaseHero> }
