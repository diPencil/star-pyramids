import type { Metadata } from 'next'
import { CarsPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/rent-car')

  return {
    title: 'Rent a Car in Egypt',
    description: 'Rent a car in Egypt with STAR PYRAMIDS. Wide selection of vehicles, airport transfers, and chauffeur services at the best rates.',
    alternates: { canonical: `${siteUrl}/rent-car`, languages: hreflang },
  }
}

export default CarsPage
