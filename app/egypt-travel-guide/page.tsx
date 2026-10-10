import type { Metadata } from 'next'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/egypt-travel-guide')

  return {
    title: 'Egypt Travel Guide',
    description: 'Your ultimate Egypt travel guide with STAR PYRAMIDS. Travel tips, destination information, packing advice, and cultural insights for your Egypt journey.',
    alternates: { canonical: `${siteUrl}/egypt-travel-guide`, languages: hreflang },
  }
}

export default function Page() {
  return <div className="egypt-travel-guide-page"><h1>Egypt Travel Guide</h1><p>Your ultimate Egypt travel guide with STAR PYRAMIDS. Travel tips, destination information, packing advice, and cultural insights for your Egypt journey.</p></div>
}