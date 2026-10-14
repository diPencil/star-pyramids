import type { Metadata } from 'next'
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
import { ServerShowcaseHero } from '@/components/server-showcase-hero'
import { AboutPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/about')

  return {
    title: 'About Us',
    description: 'Learn about STAR PYRAMIDS — your trusted Egypt travel partner for unforgettable journeys, expert guides, and personalized service.',
    ...(await pageContentMetadata('about')),
    alternates: { canonical: `${siteUrl}/about`, languages: hreflang },
  }
}

export default function Page() { return <ServerShowcaseHero id="about"><AboutPage /></ServerShowcaseHero> }
