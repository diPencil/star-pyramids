import type { Metadata } from 'next'
import { DestinationsPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/destinations')

  return {
    title: 'Egypt Destinations',
    description: 'Explore Egypt destinations — Cairo, Luxor, Aswan, Hurghada, Sharm El Sheikh, and more. Discover tours, travel tips, and local insights.',
    alternates: { canonical: `${siteUrl}/destinations`, languages: hreflang },
  }
}

export default DestinationsPage
