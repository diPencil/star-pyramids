import { describe, expect, it } from 'vitest'
import { placedOffers, readCampaign, safeCampaignHref, validateCampaign } from '@/lib/marketing-campaigns'
import { campaignContent, OfferInputError } from '@/lib/server/special-offers'
import { localizeCatalogue, validateCatalogueTranslations } from '@/lib/catalogue-translations'
import { decodeTourJson, encodeTourJson } from '@/lib/tour-json'
import type { Offer } from '@/data/types'

const campaign = { ...readCampaign(undefined), body: 'Real description', terms: 'Actual terms', ctaHref: '/make-your-trip?src=campaign', placements: ['offers', 'home', 'trips-sidebar', 'blog-sidebar'] as const }
const offer = (extra: Partial<Offer> = {}): Offer => ({ slug: 'sample', title: 'Sample', badge: 'Family', copy: 'Description', image: '/cover.jpg', ...extra })

describe('Campaign publishing and content', () => {
  it('retains legacy listings without inventing homepage or sidebar ads', () => {
    expect(placedOffers([offer()], 'offers')).toHaveLength(1)
    expect(placedOffers([offer()], 'home')).toHaveLength(0)
    expect(placedOffers([offer()], 'blog-sidebar')).toHaveLength(0)
  })
  it('uses identical visibility, windows, tour publication and ordering for placements', () => {
    const content = validateCampaign(campaign)
    const rows = [offer({ slug: 'later', displayOrder: 5, campaign: content }), offer({ slug: 'first', displayOrder: 1, campaign: content }), offer({ slug: 'hidden', isPublished: false, campaign: content }), offer({ slug: 'scheduled', startsAt: '2099-01-01', campaign: content }), offer({ slug: 'expired', deadline: '2000-01-01', campaign: content }), offer({ slug: 'unpublished-tour', tourSlug: 'draft', linkedTourPublished: false })]
    expect(placedOffers(rows, 'home').map(o => o.slug)).toEqual(['first', 'later'])
    expect(placedOffers(rows, 'blog-sidebar').map(o => o.slug)).toEqual(['first', 'later'])
    expect(placedOffers([offer({ tourSlug: 'live' })], 'home')).toHaveLength(1)
    expect(placedOffers([offer({ tourSlug: 'live' })], 'trips-sidebar')).toHaveLength(0)
  })
  it.each(['javascript:alert(1)', '//evil.example', '/\\evil.example', 'https://user:pass@example.com', '/\n/evil.example', 'data:text/html,test', 'http://insecure.example'])('rejects unsafe CTA %s', href => {
    expect(safeCampaignHref(href)).toBe(false)
    expect(() => campaignContent({ campaign: { ...campaign, ctaHref: href } })).toThrow(OfferInputError)
  })
  it('saves valid settings without losing media or unknown legacy fields', () => {
    const existing = { gallery: ['/one.jpg'], photoCredits: [{ label: 'Owner', url: 'https://example.com' }], retained: { x: 1 } }
    expect(campaignContent({ campaign }, existing)).toEqual({ ...existing, campaign })
    expect(campaignContent({ isPublished: false }, { ...existing, campaign })).toEqual({ ...existing, campaign })
    expect(() => validateCampaign({ ...campaign, placements: ['invalid'] })).toThrow()
    expect(() => validateCampaign({ ...campaign, body: 'x'.repeat(20001) })).toThrow()
  })
  it('translates campaign copy without changing CTA destination or placements', () => {
    const translations = validateCatalogueTranslations('offer', { es: { 'campaign.body': 'Descripción', 'campaign.ctaLabel': 'Planificar' } })
    const result = localizeCatalogue(offer({ campaign: validateCampaign(campaign), translations }), 'offer', 'es')
    expect(result.campaign).toMatchObject({ body: 'Descripción', ctaLabel: 'Planificar', ctaHref: campaign.ctaHref, placements: campaign.placements })
    expect(() => validateCatalogueTranslations('offer', { es: { 'campaign.ctaHref': '//evil' } })).toThrow()
  })
})

describe('Tour details used by linked offer booking', () => {
  it('round trips traveller pricing, translations and media through LONGTEXT', () => {
    const row = { slug: 'example', detail: { travelerPricing: { adult: 123.45 }, translations: { es: { title: 'Viaje' } } }, aliases: ['alias'], gallery: ['/one.jpg'], dayDetail: null }
    const encoded = encodeTourJson(row)
    expect(typeof encoded.detail).toBe('string')
    expect(decodeTourJson(encoded)).toEqual(row)
    expect(encodeTourJson({ detail: undefined })).toEqual({ detail: undefined })
  })
})
