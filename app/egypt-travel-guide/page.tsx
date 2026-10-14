import type { Metadata } from 'next'
import { readPublishedPage } from '@/lib/server/page-sections'
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'
import { InformationPage } from '@/components/information-page'
import { FaqHeroProvider } from '@/components/faq-hero-context'
import { readFaqHeroState } from '@/lib/server/faq-hero'
import { publicEditorialHero } from '@/lib/editorial-hero-definitions'
import type { PublicFaqHero } from '@/lib/faq-hero'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/egypt-travel-guide')

  return {
    title: 'Egypt Travel Guide',
    description: 'Your ultimate Egypt travel guide with STAR PYRAMIDS. Travel tips, destination information, packing advice, and cultural insights for your Egypt journey.',
    ...(await pageContentMetadata('guide')),
    alternates: { canonical: `${siteUrl}/egypt-travel-guide`, languages: hreflang },
  }
}

export default async function Page() {
  let hero: PublicFaqHero
  try { hero = publicEditorialHero('guide', await readFaqHeroState('guide')) }
  catch { hero = { hidden: false, content: null, unavailable: true } }
  return <FaqHeroProvider state={hero}><InformationPage id="guide" pageContent={await readPublishedPage('guide')} /></FaqHeroProvider>
}
