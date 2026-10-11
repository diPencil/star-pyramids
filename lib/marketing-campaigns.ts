import type { Offer } from '@/data/types'
import { isOfferActive } from './special-offers'

export const campaignPlacements = ['offers', 'home', 'trips-sidebar', 'blog-sidebar'] as const
export type CampaignPlacement = typeof campaignPlacements[number]
export type CampaignContent = {
  body: string
  terms: string
  ctaLabel: string
  ctaHref: string
  priceLabel: string
  placements: CampaignPlacement[]
}

export function safeCampaignHref(value: string): boolean {
  if (!value || /[\\\s\u0000-\u001f\u007f]/.test(value)) return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}

/** Defaults retain legacy campaigns in the offers catalogue, without inventing sidebar ads. */
export function readCampaign(value: unknown): CampaignContent {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const text = (key: string) => typeof source[key] === 'string' ? source[key] as string : ''
  return {
    body: text('body'), terms: text('terms'), ctaLabel: text('ctaLabel'),
    ctaHref: safeCampaignHref(text('ctaHref')) ? text('ctaHref') : '', priceLabel: text('priceLabel'),
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
  if (!Array.isArray(source.placements) || source.placements.some(p => !campaignPlacements.includes(p as CampaignPlacement))) throw new Error('Invalid campaign placements.')
  return readCampaign(source)
}

export function placedOffers(offers: readonly Offer[], placement: CampaignPlacement, now = Date.now()): Offer[] {
  return offers.filter(o => isOfferActive(o, now) && o.linkedTourPublished !== false && (o.tourSlug
    ? placement === 'offers' || placement === 'home'
    : readCampaign(o.campaign).placements.includes(placement)))
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.title.localeCompare(b.title))
}
