import type { Metadata } from 'next'
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
import { ServerShowcaseHero } from '@/components/server-showcase-hero'
import { CarsPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/rent-car')

  return {
    title: 'Rent a Car in Egypt',
    description: 'Rent a car in Egypt with STAR PYRAMIDS. Wide selection of vehicles, airport transfers, and chauffeur services at the best rates.',
    ...(await pageContentMetadata('cars')),
    alternates: { canonical: `${siteUrl}/rent-car`, languages: hreflang },
  }
}

export default function Page() { return <ServerShowcaseHero id="cars"><CarsPage /></ServerShowcaseHero> }
