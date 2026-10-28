import { getPublishedDestinations } from '@/lib/server/destinations'
import type { Metadata } from 'next'
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
import { DestinationsPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'
import { readFaqHeroState } from '@/lib/server/faq-hero'
import { publicFaqHero, type PublicFaqHero } from '@/lib/faq-hero'
import { FaqHeroProvider } from '@/components/faq-hero-context'
import { originalEditorialHero } from '@/lib/editorial-hero-definitions'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/destinations')

  return {
    title: 'Egypt Destinations',
    description: 'Explore Egypt destinations — Cairo, Luxor, Aswan, Hurghada, Sharm El Sheikh, and more. Discover tours, travel tips, and local insights.',
    alternates: { canonical: `${siteUrl}/destinations`, languages: hreflang },
    ...(await pageContentMetadata('destinations')),
  }
}

export default async function Page() {
  let hero: PublicFaqHero
  try {
    const state = await readFaqHeroState('destinations')
    hero = state.mode === 'original' ? { hidden: false, content: originalEditorialHero('destinations') } : publicFaqHero(state)
  }
  catch { hero = { hidden: false, content: null, unavailable: true } }
  const destinations = await getPublishedDestinations().catch(() => null)
  return <FaqHeroProvider state={hero}><DestinationsPage initialDestinations={destinations ?? undefined} loadError={destinations === null} /></FaqHeroProvider>
}
