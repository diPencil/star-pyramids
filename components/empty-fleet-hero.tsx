'use client'

import { useLocale } from './locale'
import { PageShowcaseHero } from './site'
import { originalShowcaseHero } from '@/lib/showcase-heroes'

/** Page presentation remains available independently of fleet records. */
export function EmptyFleetHero() {
  return <EmptyCatalogueHero id="cars" anchor="#fleet" />
}

export function EmptyOffersHero() {
  return <EmptyCatalogueHero id="offers" anchor="#current-offers" />
}

function EmptyCatalogueHero({ id, anchor }: { id: 'cars' | 'offers'; anchor: string }) {
  const { locale } = useLocale()
  const hero = originalShowcaseHero(id)
  const text = hero.text[locale === 'ar' ? 'en' : locale]
  return <PageShowcaseHero
    showFeatured={false}
    image="/egypt-hero.png"
    eyebrow={text.eyebrow} title={text.title} intro={text.intro}
    primaryLabel={text.primaryLabel} primaryHref={anchor}
    secondaryLabel="" secondaryHref="/contact"
    railLabel="" railTitle="" railHref="/contact" railMeta={[]}
    statsLabel={text.statsLabel} stats={[]}
  />
}
