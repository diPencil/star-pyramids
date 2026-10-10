import type { Metadata } from 'next'
import { TourListing } from '@/components/site'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/egypt-tours/multi-days-tours')

  return {
    title: 'Multi-Day Egypt Tours',
    description: 'Book extended Egypt journeys with STAR PYRAMIDS. Multi-day trips covering Cairo, Luxor, Aswan, and Nile cruises from 3 to 15 days with expert guides.',
    alternates: { canonical: `${siteUrl}/egypt-tours/multi-days-tours`, languages: hreflang },
  }
}

export default function Page() {
  return <TourListing slug="multi-days-tours" />
}