import type { Metadata } from 'next'
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
import { FAQPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'
import { readFaqHeroState } from '@/lib/server/faq-hero'
import { publicFaqHero, type PublicFaqHero } from '@/lib/faq-hero'
import { FaqHeroProvider } from '@/components/faq-hero-context'
import { originalEditorialHero } from '@/lib/editorial-hero-definitions'
import { readPublishedPage } from '@/lib/server/page-sections'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/faq')

  return {
    title: 'Frequently Asked Questions',
    description: 'Find answers to common questions about STAR PYRAMIDS Egypt tours, bookings, Nile cruises, and travel planning.',
    ...(await pageContentMetadata('faq')),
    alternates: { canonical: `${siteUrl}/faq`, languages: hreflang },
  }
}

export default async function Page() {
  let hero: PublicFaqHero
  try {
    const state = await readFaqHeroState()
    hero = state.mode === 'original' ? { hidden: false, content: originalEditorialHero('faq') } : publicFaqHero(state)
  }
  catch { hero = { hidden: false, content: null, unavailable: true } }
  return <FaqHeroProvider state={hero}><FAQPage pageContent={await readPublishedPage('faq')} /></FaqHeroProvider>
}
