import type { Metadata } from 'next'
import { TourListing } from '@/components/site'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/egypt-tours/shore-excursions')

  return {
    title: 'Shore Excursions in Egypt',
    description: 'Book shore excursions with STAR PYRAMIDS. Port visits from Alexandria, Port Said, and Sokhna. Half-day and full-day tours to Cairo, Luxor, and Aswan for cruise ship passengers.',
    alternates: { canonical: `${siteUrl}/egypt-tours/shore-excursions`, languages: hreflang },
  }
}

export default function Page() {
  return <TourListing slug="shore-excursions" />
}