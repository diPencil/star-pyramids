import type { Metadata } from 'next'
import { OneDayToursRegions } from '@/components/site'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/egypt-tours/one-day-tours')

  return {
    title: 'One-Day Tours in Egypt',
    description: 'Book half-day and full-day Cairo day tours, Luxor and Aswan excursions with STAR PYRAMIDS. Expert guides, instant confirmation, and unforgettable Egypt experiences.',
    alternates: { canonical: `${siteUrl}/egypt-tours/one-day-tours`, languages: hreflang },
  }
}

export default function Page() {
  return <OneDayToursRegions />
}