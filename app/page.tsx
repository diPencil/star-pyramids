import type { Metadata } from 'next'
import { RebuiltHomePage } from '@/components/homepage'
import { generateOrganizationJsonLd, renderJsonLd } from '@/lib/structured-data'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'
import { readHeroState } from '@/lib/server/website-heroes'
import { publicHeroState } from '@/lib/website-heroes'
import type { PublicHomeHero } from '@/components/homepage-hero'
import { readPublishedPage } from '@/lib/server/page-sections'
import { getServerLocale } from '@/lib/server/locale'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/')
  const [pageContent, locale] = await Promise.all([readPublishedPage(), getServerLocale()])
  const seo = pageContent.content?.seo
  const seoText = seo?.text[locale]
  const title = seoText?.title || 'STAR PYRAMIDS | Discover Egypt'
  const description = seoText?.description || 'Discover ancient wonders, warm hospitality, and unforgettable journeys across Egypt. Book Nile cruises, Cairo day tours, multi-day trips, and shore excursions with STAR PYRAMIDS.'

  return {
    title,
    description,
    alternates: { canonical: siteUrl, languages: hreflang },
    openGraph: {
      title,
      description: seoText?.description || 'Discover ancient wonders, warm hospitality, and unforgettable journeys across Egypt.',
      ...(seo?.image ? { images: [seo.image] } : {}),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: seoText?.description || 'Discover ancient wonders, warm hospitality, and unforgettable journeys across Egypt.',
      ...(seo?.image ? { images: [seo.image] } : {}),
    },
  }
}

export default async function Page() {
  const orgJsonLd = generateOrganizationJsonLd()
  let hero: PublicHomeHero
  try { hero = publicHeroState(await readHeroState()) }
  catch { hero = { hidden: false, content: null, unavailable: true } }
  return (
    <>
      {renderJsonLd(orgJsonLd)}
      <RebuiltHomePage hero={hero} pageContent={await readPublishedPage()} />
    </>
  )
}
