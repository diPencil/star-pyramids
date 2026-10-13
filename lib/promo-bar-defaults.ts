import type { Locale } from './locale-config'

/**
 * The three original public advertisements, now managed as promotional-bar
 * records. This module is the single source of truth for their exact
 * original copy/CTA/context so the one-time backfill, the admin form and the
 * public renderer all stay consistent. The announcements are no longer
 * rendered from here — they are stored in the database.
 */

export const TOP_BAR_PACKAGES_SLUG = 'promo-bar-free-tour-experience'
export const TOP_BAR_SAVINGS_SLUG = 'promo-bar-limited-time-savings'
export const FOOTER_ACCESS_SLUG = 'promo-bar-accessibility-notice'

export const DEFAULT_ACCESS_ICON = 'Accessibility'

export const PROMO_BAR_BACKFILL_DONE_KEY = 'site.promoBarBackfillDone'

export type PromoBarSlot = 'top' | 'footer'

export type PromoBarSeed = {
  slug: string
  title: string
  copy: string
  badge: string
  ctaLabel: string
  ctaHref: string
  icons: string[]
  placements: string[]
  displayOrder: number
}

const packageOffer: Record<Locale, { title: string; cta: string }> = {
  en: { title: 'Book any package tour and enjoy a FREE tour experience included along with it.', cta: 'View Packages' },
  ar: { title: 'احجز أي برنامج سياحي واستمتع بتجربة مجانية مشمولة معه.', cta: 'شاهد الباقات' },
  es: { title: 'Reserva cualquier paquete y disfruta de una experiencia gratuita incluida.', cta: 'Ver paquetes' },
  it: { title: 'Prenota un pacchetto viaggio e goditi un’esperienza gratuita inclusa.', cta: 'Vedi i pacchetti' },
}

const savingsOffer: Record<Locale, { title: string; cta: string }> = {
  en: { title: 'Limited-time savings on top-rated Egypt tours. Grab your deal before it ends!', cta: 'View Offers' },
  ar: { title: 'وفّر لفترة محدودة على أفضل جولات مصر. احجز قبل انتهاء العرض!', cta: 'شاهد العروض' },
  es: { title: 'Ahorra por tiempo limitado en los mejores circuitos de Egipto. ¡Aprovecha antes de que termine!', cta: 'Ver ofertas' },
  it: { title: 'Risparmia per un periodo limitato sui migliori tour in Egitto. Approfittane prima che finisca!', cta: 'Vedi le offerte' },
}

const accessNotice: Record<Locale, { title: string; cta: string }> = {
  en: { title: '5% discount on all our tour packages for guests requiring accessibility assistance.', cta: 'Read More' },
  ar: { title: 'خصم 5% على كل باقات الرحلات لضيوفنا من ذوي الاحتياجات الخاصة.', cta: 'اقرأ المزيد' },
  es: { title: '5% de descuento en todos nuestros paquetes para huéspedes que necesiten asistencia de accesibilidad.', cta: 'Leer más' },
  it: { title: 'Sconto del 5% su tutti i nostri pacchetti per gli ospiti che necessitano di assistenza per l’accessibilità.', cta: 'Leggi di più' },
}

/** Non-English overlay for the three records, using the existing offer translations table. */
export function promoBarSeedTranslations(kind: 'packages' | 'savings' | 'access'): Record<string, Record<string, string>> {
  const source = kind === 'packages' ? packageOffer : kind === 'savings' ? savingsOffer : accessNotice
  // Catalogue translations accept the enabled public languages only; the
  // Arabic copy is persisted verbatim in the record and shown for `ar`
  // through the storefront defaults fallback chain.
  const locales: Locale[] = ['es', 'it']
  const result: Record<string, Record<string, string>> = {}
  for (const locale of locales) {
    result[locale] = {
      title: source[locale].title,
      'campaign.ctaLabel': source[locale].cta,
    }
  }
  return result
}

/** The exact three records, keyed by their stable slugs. */
export const PROMO_BAR_SEEDS: readonly PromoBarSeed[] = [
  {
    slug: TOP_BAR_PACKAGES_SLUG,
    title: packageOffer.en.title,
    copy: packageOffer.en.title,
    badge: 'Promo',
    ctaLabel: packageOffer.en.cta,
    ctaHref: '/special-offers',
    icons: ['Ticket', 'BadgePercent'],
    placements: ['top-bar'],
    displayOrder: 1,
  },
  {
    slug: TOP_BAR_SAVINGS_SLUG,
    title: savingsOffer.en.title,
    copy: savingsOffer.en.title,
    badge: 'Promo',
    ctaLabel: savingsOffer.en.cta,
    ctaHref: '/special-offers',
    icons: ['BadgePercent', 'Star'],
    placements: ['top-bar'],
    displayOrder: 2,
  },
  {
    slug: FOOTER_ACCESS_SLUG,
    title: accessNotice.en.title,
    copy: accessNotice.en.title,
    badge: 'Promo',
    ctaLabel: accessNotice.en.cta,
    ctaHref: '/accessible-travel',
    icons: ['Accessibility'],
    placements: ['footer-promo'],
    displayOrder: 1,
  },
]

export function findPromoBarSeed(slug: string): PromoBarSeed | undefined {
  return PROMO_BAR_SEEDS.find((seed) => seed.slug === slug)
}
