import type { Metadata } from 'next'
import { OffersPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/special-offers')

  return {
    title: 'Special Offers',
    description: 'Discover exclusive STAR PYRAMIDS special offers on Egypt tours, Nile cruises, and travel packages. Save on your next Egypt adventure.',
    alternates: { canonical: `${siteUrl}/special-offers`, languages: hreflang },
  }
}

export default OffersPage
