import type { Metadata } from 'next'
import { readPublishedPage } from '@/lib/server/cms/page-sections'
import { pageContentMetadata } from '@/lib/server/cms/page-content-metadata'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo/seo'
import { InformationPage } from '@/components/content/information-page'
import { FaqHeroProvider } from '@/components/cms/heroes/faq-hero-context'
import { readFaqHeroState } from '@/lib/server/cms/heroes/faq-hero'
import { publicEditorialHero } from '@/lib/cms/heroes/editorial-hero-definitions'
import type { PublicFaqHero } from '@/lib/cms/heroes/faq-hero'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/accessible-travel')

  return {
    title: 'Accessible Travel Egypt',
    description: 'STAR PYRAMIDS accessible Egypt tours. Wheelchair-friendly day trips, Nile cruises, and shore excursions for travelers with mobility needs.',
    alternates: { canonical: `${siteUrl}/accessible-travel`, languages: hreflang },
    ...(await pageContentMetadata('accessible')),
  }
}

export default async function Page() {
  let hero: PublicFaqHero
  try { hero = publicEditorialHero('accessible', await readFaqHeroState('accessible')) }
  catch { hero = { hidden: false, content: null, unavailable: true } }
  return <FaqHeroProvider state={hero}><InformationPage id="accessible" pageContent={await readPublishedPage('accessible')} /></FaqHeroProvider>
}
