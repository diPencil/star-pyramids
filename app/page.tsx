import type { Metadata } from 'next'
import { RebuiltHomePage } from '@/components/homepage'
import { generateOrganizationJsonLd, renderJsonLd } from '@/lib/structured-data'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/')

  return {
    title: 'STAR PYRAMIDS | Discover Egypt',
    description: 'Discover ancient wonders, warm hospitality, and unforgettable journeys across Egypt. Book Nile cruises, Cairo day tours, multi-day trips, and shore excursions with STAR PYRAMIDS.',
    alternates: { canonical: siteUrl, languages: hreflang },
    openGraph: {
      title: 'STAR PYRAMIDS | Discover Egypt',
      description: 'Discover ancient wonders, warm hospitality, and unforgettable journeys across Egypt.',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'STAR PYRAMIDS | Discover Egypt',
      description: 'Discover ancient wonders, warm hospitality, and unforgettable journeys across Egypt.',
    },
  }
}

export default function Page() {
  const orgJsonLd = generateOrganizationJsonLd()
  return (
    <>
      {renderJsonLd(orgJsonLd)}
      <RebuiltHomePage />
    </>
  )
}
