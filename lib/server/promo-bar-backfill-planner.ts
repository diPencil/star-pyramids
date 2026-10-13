import 'server-only'

import { validateCampaign } from '../marketing-campaigns'
import { validateCatalogueTranslations } from '../catalogue-translations'
import { PROMO_BAR_SEEDS, promoBarSeedTranslations, type PromoBarSeed } from '../promo-bar-defaults'

export type PromoBarSeedKind = 'packages' | 'savings' | 'access'

export function promoBarSeedKind(slug: string): PromoBarSeedKind {
  if (slug === 'promo-bar-free-tour-experience') return 'packages'
  if (slug === 'promo-bar-limited-time-savings') return 'savings'
  return 'access'
}

/**
 * Deterministic plan for the one-time initialization of the three original
 * advertisements. Pure: no database access, so it is unit-testable.
 */
export function planPromoBarBackfill(input: {
  existingSlugs: readonly string[]
  completed: boolean
}): { toCreate: PromoBarSeed[]; skipped: { slug: string; reason: 'exists' | 'completed' }[]; alreadyInitialized: boolean } {
  const existing = new Set(input.existingSlugs)
  const skipped: { slug: string; reason: 'exists' | 'completed' }[] = []
  const toCreate: PromoBarSeed[] = []
  for (const seed of PROMO_BAR_SEEDS) {
    // Completion only suppresses CREATEs — it never touches existing rows,
    // so admin edits and intentional deletions are always preserved.
    if (input.completed) skipped.push({ slug: seed.slug, reason: 'completed' })
    else if (existing.has(seed.slug)) skipped.push({ slug: seed.slug, reason: 'exists' })
    else toCreate.push(seed)
  }
  return { toCreate, skipped, alreadyInitialized: input.completed }
}

/** Content payload for one record — identical for planning and execution. */
export function promoBarSeedPayload(seed: PromoBarSeed, accessOverride?: { visible: boolean; note: string; ctaLabel: string; ctaHref: string } | null) {
  // A previously customized accessibility notice keeps its stored copy/CTA
  // instead of the original defaults; an untouched notice uses the defaults.
  const customized = accessOverride && (accessOverride.note || accessOverride.ctaLabel || accessOverride.ctaHref) && accessOverride.visible
  const ctaLabel = customized && accessOverride.ctaLabel ? accessOverride.ctaLabel : seed.ctaLabel
  const ctaHref = customized && accessOverride.ctaHref ? accessOverride.ctaHref : seed.ctaHref
  const title = customized && accessOverride.note ? accessOverride.note : seed.title
  const copy = customized && accessOverride.note ? accessOverride.note : seed.copy
  const campaign = validateCampaign({
    body: '',
    terms: '',
    ctaLabel,
    ctaHref,
    ctaTourSlug: '',
    icons: seed.icons,
    priceLabel: '',
    placements: seed.placements as ('top-bar' | 'footer-promo')[],
  })
  const translations = validateCatalogueTranslations('offer', promoBarSeedTranslations(promoBarSeedKind(seed.slug)))
  return {
    slug: seed.slug,
    title,
    badge: seed.badge,
    copy,
    image: '',
    duration: null,
    rating: null,
    price: null,
    originalPrice: null,
    isPublished: true,
    displayOrder: seed.displayOrder,
    campaign,
    translations,
  }
}
