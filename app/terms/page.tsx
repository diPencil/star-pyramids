import type { Metadata } from 'next'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/terms')

  return {
    title: 'Terms of Use',
    description: 'STAR PYRAMIDS terms of use. Conditions for booking Egypt tours, Nile cruises, and travel services with STAR PYRAMIDS.',
    alternates: { canonical: `${siteUrl}/terms`, languages: hreflang },
  }
}

export default function Page() {
  return <div className="terms-page"><h1>Terms of Use</h1><p>STAR PYRAMIDS terms of use. Conditions for booking Egypt tours, Nile cruises, and travel services with STAR PYRAMIDS.</p></div>
}