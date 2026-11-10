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
  const hreflang = await getHreflangEntries('/egypt-travel-guide')

  return {
    title: 'Egypt Travel Guide',
    description: 'Your ultimate Egypt travel guide with STAR PYRAMIDS. Travel tips, destination information, packing advice, and cultural insights for your Egypt journey.',
    alternates: { canonical: `${siteUrl}/egypt-travel-guide`, languages: hreflang },
    ...(await pageContentMetadata('guide')),
  }
}

export default async function Page() {
  let hero: PublicFaqHero
  try { hero = publicEditorialHero('guide', await readFaqHeroState('guide')) }
  catch { hero = { hidden: false, content: null, unavailable: true } }
  return <FaqHeroProvider state={hero}><InformationPage id="guide" pageContent={await readPublishedPage('guide')} /></FaqHeroProvider>
}
