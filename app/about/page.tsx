import type { Metadata } from 'next'
import { AboutPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/about')

  return {
    title: 'About Us',
    description: 'Learn about STAR PYRAMIDS — your trusted Egypt travel partner for unforgettable journeys, expert guides, and personalized service.',
    alternates: { canonical: `${siteUrl}/about`, languages: hreflang },
  }
}

export default AboutPage
