import type { Offer } from '@/data/types'
import { isOfferActive, offerHref } from './special-offers'
import { isTourPublished } from './tour-publish'
import { MAX_PROMO_BAR_ICONS, isPromoBarIconId } from './promo-bar-icons'

export const campaignPlacements = ['offers', 'home', 'top-bar', 'footer-promo', 'trips-sidebar', 'blog-sidebar'] as const
export type CampaignPlacement = typeof campaignPlacements[number]
/** Original marketing-campaign surfaces (predate the promotional bars). */
export const marketingPlacements: readonly CampaignPlacement[] = ['offers', 'home', 'trips-sidebar', 'blog-sidebar']
/** Promotional-bar surfaces, managed by the dedicated Promotional Bars workflow. */
export const promoBarPlacements: readonly CampaignPlacement[] = ['top-bar', 'footer-promo']
export type CampaignContent = {
  body: string
  terms: string
  ctaLabel: string
  ctaHref: string
  /** Optional linked tour for the CTA button (slug only — the URL is always resolved live). */
  ctaTourSlug: string
  /** Ordered promotional-bar icon identifiers (allowlisted, never raw markup). */
  icons: string[]
  priceLabel: string
  placements: CampaignPlacement[]
}

const TOUR_SLUG_PATTERN = /^[a-z0-9-]{1,80}$/

export function safeCampaignHref(value: string): boolean {
  if (!value || /[\\\s\u0000-\u001f\u007f]/.test(value)) return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}

/** Defaults retain legacy campaigns in the offers catalogue, without inventing sidebar ads. */
export function readCampaign(value: unknown): CampaignContent {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const text = (key: string) => typeof source[key] === 'string' ? source[key] as string : ''
  const tourSlug = text('ctaTourSlug')
  // Unknown or excess icon identifiers are dropped so legacy and
  // hand-edited records can never break public rendering.
  const icons = Array.isArray(source.icons)
    ? source.icons.filter((entry): entry is string => isPromoBarIconId(entry)).slice(0, MAX_PROMO_BAR_ICONS)
    : []
  return {
    body: text('body'), terms: text('terms'), ctaLabel: text('ctaLabel'),
    ctaHref: safeCampaignHref(text('ctaHref')) ? text('ctaHref') : '',
    ctaTourSlug: TOUR_SLUG_PATTERN.test(tourSlug) ? tourSlug : '',
    icons,
    priceLabel: text('priceLabel'),
    placements: Array.isArray(source.placements) ? campaignPlacements.filter(p => (source.placements as unknown[]).includes(p)) : ['offers'],
  }
}

export function validateCampaign(value: unknown): CampaignContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid campaign settings.')
  const source = value as Record<string, unknown>
  for (const [key, max] of Object.entries({ body: 20000, terms: 10000, ctaLabel: 120, ctaHref: 2000, priceLabel: 120 })) {
    if (typeof source[key] !== 'string' || (source[key] as string).length > max) throw new Error(`Invalid campaign ${key}.`)
  }
  if (source.ctaHref && !safeCampaignHref(source.ctaHref as string)) throw new Error('Use a website path or a valid HTTPS link for the campaign button.')
  // Legacy records predate the tour link and omit the key — only a present,
  // malformed value is rejected.
  const tourSlug = source.ctaTourSlug ?? ''
  if (typeof tourSlug !== 'string' || (tourSlug !== '' && !TOUR_SLUG_PATTERN.test(tourSlug))) throw new Error('Invalid campaign tour link.')
  // Legacy records predate icons the same way; only present values are checked.
  const icons = source.icons ?? []
  if (!Array.isArray(icons) || icons.length > MAX_PROMO_BAR_ICONS || icons.some((entry) => !isPromoBarIconId(entry))) throw new Error('Invalid campaign icons.')
  if (!Array.isArray(source.placements) || source.placements.some(p => !campaignPlacements.includes(p as CampaignPlacement))) throw new Error('Invalid campaign placements.')
  return readCampaign(source)
}

export function placedOffers(offers: readonly Offer[], placement: CampaignPlacement, now = Date.now()): Offer[] {
  return offers.filter(o => isOfferActive(o, now) && o.linkedTourPublished !== false && (o.tourSlug
    ? placement === 'offers' || placement === 'home'
    : readCampaign(o.campaign).placements.includes(placement)))
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.title.localeCompare(b.title))
}

/**
 * Recognizes promotional-bar records for the dedicated Promotional Bars
 * admin workflow: non-tour campaigns carrying at least one bar placement.
 * Pure marketing campaigns and tour-linked offers never match. Hybrids
 * (bar + catalogue placements) match so their bar controls stay editable
 * without losing their catalogue presence.
 */
export function isPromoBar(offer: { tourSlug?: string | null; campaign?: CampaignContent }): boolean {
  if (offer.tourSlug) return false
  return readCampaign(offer.campaign).placements.some((p) => (promoBarPlacements as readonly string[]).includes(p))
}

export type TopBarSlide = { slug: string; text: string; href: string; label: string; icons: string[] }

export type CtaTour = { slug: string; status?: string | null }

/**
 * Resolves the CTA tour link against live tour data. Returns the tour
 * detail URL (via the shared `offerHref` routing convention — never a
 * hardcoded pattern) only while the tour exists and is published; any
 * other case returns null so callers fall back to a safe destination
 * instead of generating a broken link.
 */
export function resolveTourCtaHref(ctaTourSlug: string, tours: readonly CtaTour[] | undefined): string | null {
  if (!ctaTourSlug) return null
  if (!tours) return offerHref({ slug: ctaTourSlug, tourSlug: ctaTourSlug })
  const tour = tours.find((entry) => entry.slug === ctaTourSlug)
  if (!tour || !isTourPublished(tour)) return null
  return offerHref({ slug: tour.slug, tourSlug: tour.slug })
}

/**
 * Shared CTA resolution for promotional content: a linked tour resolves to
 * its live detail URL while published, otherwise the saved custom URL, then
 * the offer page — so a dead tour or unsafe URL never yields a broken link.
 */
export function campaignCtaHref(
  item: { slug: string; tourSlug?: string | null; campaign?: CampaignContent },
  tours?: readonly CtaTour[],
): string {
  const campaign = readCampaign(item.campaign)
  if (campaign.ctaTourSlug) return resolveTourCtaHref(campaign.ctaTourSlug, tours) ?? offerHref(item)
  return safeCampaignHref(campaign.ctaHref) ? campaign.ctaHref : offerHref(item)
}

/**
 * Pure slide builder for the header promotional bar. Only published,
 * scheduled and ordered `top-bar` campaigns are returned (via
 * `placedOffers`). A linked tour resolves to its live detail URL while it
 * stays published — otherwise the offer page is used so a dead tour never
 * produces a broken link (a stale saved URL is skipped on purpose). Without
 * a linked tour the saved custom URL is used, then the offer page. An empty
 * CTA label falls back to the caller-provided default at render time.
 * Linked-tour offers never appear here — they keep their existing
 * `offers`/`home` behavior.
 */
export function toTopBarSlides(offers: readonly Offer[], tours?: readonly CtaTour[]): TopBarSlide[] {
  return placedOffers(offers, 'top-bar').map((item) => {
    const campaign = readCampaign(item.campaign)
    return {
      slug: item.slug,
      text: item.title,
      href: campaignCtaHref(item, tours),
      label: campaign.ctaLabel,
      icons: campaign.icons,
    }
  })
}
