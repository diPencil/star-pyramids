import type { Metadata } from 'next'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/accessible-travel')

  return {
    title: 'Accessible Travel Egypt',
    description: 'STAR PYRAMIDS accessible Egypt tours. Wheelchair-friendly day trips, Nile cruises, and shore excursions for travelers with mobility needs.',
    alternates: { canonical: `${siteUrl}/accessible-travel`, languages: hreflang },
  }
}

export default function Page() {
  return <div className="accessible-travel-page"><h1>Accessible Travel in Egypt</h1><p>Wheelchair-friendly day trips, Nile cruises, and shore excursions for travelers with mobility needs.</p></div>
}