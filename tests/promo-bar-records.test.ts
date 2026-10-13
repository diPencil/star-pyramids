import { describe, expect, it } from 'vitest'
import {
  campaignCtaHref,
  campaignPlacements,
  isPromoBar,
  marketingPlacements,
  placedOffers,
  promoBarPlacements,
  readCampaign,
  resolveTourCtaHref,
  safeCampaignHref,
  toTopBarSlides,
  validateCampaign,
} from '@/lib/marketing-campaigns'
import { planPromoBarBackfill, promoBarSeedPayload } from '@/lib/server/promo-bar-backfill-planner'
import { DEFAULT_ACCESS_ICON, PROMO_BAR_SEEDS, findPromoBarSeed, promoBarSeedTranslations } from '@/lib/promo-bar-defaults'
import { MAX_PROMO_BAR_ICONS, PROMO_BAR_ICONS } from '@/lib/promo-bar-icons'
import type { Offer } from '@/data/types'

const allSlugs = PROMO_BAR_SEEDS.map((seed) => seed.slug)

const seedOffer = (slug: string, override: Partial<Offer> = {}): Offer => {
  const payload = promoBarSeedPayload(findPromoBarSeed(slug)!)
  return {
    slug: payload.slug,
    title: payload.title,
    badge: payload.badge,
    copy: payload.copy,
    image: payload.image,
    isPublished: payload.isPublished,
    displayOrder: payload.displayOrder,
    campaign: payload.campaign,
    ...override,
  }
}

describe('Original advertisements initialization', () => {
  it('defines exactly three original advertisements with their original copy', () => {
    expect(allSlugs).toHaveLength(3)
    const packages = findPromoBarSeed('promo-bar-free-tour-experience')
    const savings = findPromoBarSeed('promo-bar-limited-time-savings')
    const access = findPromoBarSeed('promo-bar-accessibility-notice')
    expect(packages?.title).toBe('Book any package tour and enjoy a FREE tour experience included along with it.')
    expect(packages?.ctaLabel).toBe('View Packages')
    expect(packages?.ctaHref).toBe('/special-offers')
    expect(packages?.icons).toEqual(['Ticket', 'BadgePercent'])
    expect(packages?.placements).toEqual(['top-bar'])
    expect(packages?.displayOrder).toBe(1)
    expect(savings?.title).toBe('Limited-time savings on top-rated Egypt tours. Grab your deal before it ends!')
    expect(savings?.ctaLabel).toBe('View Offers')
    expect(savings?.ctaHref).toBe('/special-offers')
    expect(savings?.icons).toEqual(['BadgePercent', 'Star'])
    expect(savings?.displayOrder).toBe(2)
    expect(access?.title).toBe('5% discount on all our tour packages for guests requiring accessibility assistance.')
    expect(access?.ctaLabel).toBe('Read More')
    expect(access?.ctaHref).toBe('/accessible-travel')
    expect(access?.icons).toEqual(['Accessibility'])
    expect(access?.placements).toEqual(['footer-promo'])
    expect(access?.displayOrder).toBe(1)
  })

  it('carries the original translations for the supported public languages', () => {
    const packages = promoBarSeedTranslations('packages')
    expect(packages.es.title).toBe('Reserva cualquier paquete y disfruta de una experiencia gratuita incluida.')
    expect(packages.it.title).toBe('Prenota un pacchetto viaggio e goditi un’esperienza gratuita inclusa.')
    expect(packages.es['campaign.ctaLabel']).toBe('Ver paquetes')
    const savings = promoBarSeedTranslations('savings')
    expect(savings.it['campaign.ctaLabel']).toBe('Vedi le offerte')
    const access = promoBarSeedTranslations('access')
    expect(access.it['campaign.ctaLabel']).toBe('Leggi di più')
  })

  it('plans all three inserts on a fresh database', () => {
    const plan = planPromoBarBackfill({ existingSlugs: [], completed: false })
    expect(plan.toCreate.map((seed) => seed.slug)).toEqual(allSlugs)
    expect(plan.alreadyInitialized).toBe(false)
  })

  it('is idempotent and never duplicates an existing record', () => {
    const done = planPromoBarBackfill({ existingSlugs: allSlugs, completed: true })
    expect(done.toCreate).toHaveLength(0)
    expect(done.alreadyInitialized).toBe(true)
    // One existing, two missing during the first run: only the missing two.
    const partial = planPromoBarBackfill({ existingSlugs: [allSlugs[0]], completed: false })
    expect(partial.toCreate.map((seed) => seed.slug)).toEqual(allSlugs.slice(1))
  })

  it('never recreates a record an administrator deleted', () => {
    const plan = planPromoBarBackfill({ existingSlugs: [allSlugs[1]], completed: true })
    expect(plan.toCreate).toHaveLength(0)
    expect(plan.skipped.every((entry) => entry.reason === 'completed')).toBe(true)
  })

  it('leaves existing records untouched (no overwrite in the plan)', () => {
    const plan = planPromoBarBackfill({ existingSlugs: allSlugs, completed: false })
    expect(plan.toCreate).toEqual([])
    expect(plan.skipped.map((entry) => entry.slug)).toEqual(allSlugs)
    expect(plan.skipped.every((entry) => entry.reason === 'exists')).toBe(true)
  })

  it('produces valid payloads that keep placement, CTA and icons', () => {
    for (const seed of PROMO_BAR_SEEDS) {
      const payload = promoBarSeedPayload(seed)
      expect(payload.isPublished).toBe(true)
      expect(payload.campaign.placements).toEqual(seed.placements)
      expect(payload.campaign.ctaHref).toBe(seed.ctaHref)
      expect(payload.campaign.ctaLabel).toBe(seed.ctaLabel)
      expect(payload.campaign.icons).toEqual(seed.icons)
      expect(payload.translations.es?.title).toBeTruthy()
      expect(payload.translations.it?.title).toBeTruthy()
      expect(payload.translations.ar).toBeUndefined()
    }
  })

  it('keeps a previously customized accessibility notice when initializing', () => {
    const seed = findPromoBarSeed('promo-bar-accessibility-notice')!
    const payload = promoBarSeedPayload(seed, {
      visible: true,
      note: 'Custom accessibility notice.',
      ctaLabel: 'Learn more',
      ctaHref: '/contact',
    })
    expect(payload.title).toBe('Custom accessibility notice.')
    expect(payload.campaign.ctaLabel).toBe('Learn more')
    expect(payload.campaign.ctaHref).toBe('/contact')
    expect(payload.campaign.icons).toEqual(['Accessibility'])
    expect(payload.campaign.placements).toEqual(['footer-promo'])
  })

  it('falls back to the original defaults when nothing was customized', () => {
    const seed = findPromoBarSeed('promo-bar-accessibility-notice')!
    const payload = promoBarSeedPayload(seed, null)
    expect(payload.title).toBe(seed.title)
  })

  it('makes the seeded records eligible for their placement', () => {
    const barOffers: Offer[] = PROMO_BAR_SEEDS.map((seed) => seedOffer(seed.slug))
    expect(toTopBarSlides(barOffers, [{ slug: 'x' }]).map((slide) => slide.slug)).toEqual([
      'promo-bar-free-tour-experience',
      'promo-bar-limited-time-savings',
    ])
    expect(toTopBarSlides(barOffers)[0].icons).toEqual(['Ticket', 'BadgePercent'])
    expect(toTopBarSlides(barOffers)[1].icons).toEqual(['BadgePercent', 'Star'])
    expect(toTopBarSlides(barOffers)[0].href).toBe('/special-offers')
    expect(toTopBarSlides(barOffers)[0].label).toBe('View Packages')
    expect(placedOffers(barOffers, 'footer-promo').map((offer) => offer.slug)).toEqual([
      'promo-bar-accessibility-notice',
    ])
    expect(isPromoBar(barOffers[0])).toBe(true)
    // Only one footer strip is ever selected.
    expect(placedOffers(barOffers, 'footer-promo')).toHaveLength(1)
  })

  it('hides an original advertisement once it is unpublished', () => {
    const hidden = seedOffer(allSlugs[0], { isPublished: false })
    expect(toTopBarSlides([hidden])).toHaveLength(0)
    expect(placedOffers([hidden], 'footer-promo')).toHaveLength(0)
  })

  it('stops showing an original advertisement once its record is deleted', () => {
    // Only the second top-bar record survives; the first is gone from the DB.
    const survivor = seedOffer(allSlugs[1])
    expect(toTopBarSlides([survivor]).map((slide) => slide.slug)).toEqual([allSlugs[1]])
    expect(toTopBarSlides([survivor]).length).toBe(1)
  })
})

describe('Promotional bar icons', () => {
  it('registers the icons used by the originals', () => {
    expect(PROMO_BAR_ICONS).toContain('Ticket')
    expect(PROMO_BAR_ICONS).toContain('BadgePercent')
    expect(PROMO_BAR_ICONS).toContain('Star')
    expect(PROMO_BAR_ICONS).toContain('Accessibility')
    expect(new Set(PROMO_BAR_ICONS).size).toBe(PROMO_BAR_ICONS.length)
    expect(MAX_PROMO_BAR_ICONS).toBeGreaterThanOrEqual(4)
    expect(DEFAULT_ACCESS_ICON).toBe('Accessibility')
  })

  it('keeps legacy records without icons valid and renders nothing extra', () => {
    expect(readCampaign(undefined).icons).toEqual([])
    expect(validateCampaign({ body: '', terms: '', ctaLabel: '', ctaHref: '', priceLabel: '', placements: ['offers'] }).icons).toEqual([])
  })

  it('stores icon order exactly as selected', () => {
    const icons = ['Star', 'Ticket', 'Gift']
    expect(validateCampaign({ body: '', terms: '', ctaLabel: '', ctaHref: '', priceLabel: '', placements: ['offers'], icons }).icons).toEqual(icons)
    expect(readCampaign({ icons }).icons).toEqual(icons)
  })

  it('rejects unsafe or unknown icon identifiers', () => {
    const base = { body: '', terms: '', ctaLabel: '', ctaHref: '', priceLabel: '', placements: ['offers'] }
    expect(() => validateCampaign({ ...base, icons: ['<svg onload=alert(1)>'] })).toThrow()
    expect(() => validateCampaign({ ...base, icons: ['javascript:alert(1)'] })).toThrow()
    expect(() => validateCampaign({ ...base, icons: ['NotARealIcon'] })).toThrow()
    expect(() => validateCampaign({ ...base, icons: 42 })).toThrow()
    // Hand-edited payloads are sanitized on read too.
    expect(readCampaign({ icons: ['Star', '<script>', 'NotARealIcon'] }).icons).toEqual(['Star'])
  })

  it('enforces the icon limit', () => {
    const tooMany = ['Ticket', 'Star', 'Gift', 'Bell', 'Tag']
    expect(() => validateCampaign({ body: '', terms: '', ctaLabel: '', ctaHref: '', priceLabel: '', placements: ['offers'], icons: tooMany })).toThrow()
    expect(readCampaign({ icons: tooMany }).icons).toEqual(['Ticket', 'Star', 'Gift', 'Bell'])
  })

  it('carries icon changes publicly without touching text or CTA', () => {
    const base = seedOffer(allSlugs[0])
    const slides = toTopBarSlides([base])
    expect(slides[0].icons).toEqual(['Ticket', 'BadgePercent'])
    const changed = toTopBarSlides([{ ...base, campaign: validateCampaign({ ...base.campaign, icons: ['Gift'] }) }])
    expect(changed[0].icons).toEqual(['Gift'])
    expect(changed[0].text).toBe(base.title)
    expect(changed[0].label).toBe(base.campaign.ctaLabel)
    expect(changed[0].href).toBe('/special-offers')
  })
})

describe('Promotional CTA destination', () => {
  const tours = [{ slug: 'cairo-and-giza-pyramids' }, { slug: 'retired-tour', status: 'draft' }]

  it('persists the linked tour slug and accepts legacy records without it', () => {
    const base = { body: '', terms: '', ctaLabel: 'View', ctaHref: '/x', priceLabel: '', placements: ['offers'] }
    expect(validateCampaign({ ...base, ctaTourSlug: 'cairo-and-giza-pyramids' }).ctaTourSlug).toBe('cairo-and-giza-pyramids')
    expect(validateCampaign(base).ctaTourSlug).toBe('')
    expect(() => validateCampaign({ ...base, ctaTourSlug: 'Not A Slug!' })).toThrow()
  })

  it('resolves a live tour through the shared routing convention', () => {
    expect(resolveTourCtaHref('cairo-and-giza-pyramids', tours)).toBe('/egypt-tours/cairo-and-giza-pyramids')
  })

  it('never generates a link for unpublished or removed tours', () => {
    expect(resolveTourCtaHref('retired-tour', tours)).toBeNull()
    expect(resolveTourCtaHref('missing-tour', tours)).toBeNull()
    expect(resolveTourCtaHref('', tours)).toBeNull()
  })

  it('navigates top-bar slides to the linked tour instead of the offer page', () => {
    const offer: Offer = {
      slug: 'pyramids-deal', title: 'Pyramids deal', badge: 'Promo', copy: 'x', image: '',
      campaign: validateCampaign({ body: '', terms: '', ctaLabel: 'View tour', ctaHref: '/custom', ctaTourSlug: 'cairo-and-giza-pyramids', icons: [], priceLabel: '', placements: ['top-bar'] }),
    }
    expect(toTopBarSlides([offer], tours)[0].href).toBe('/egypt-tours/cairo-and-giza-pyramids')
  })

  it('falls back to the offer page when the linked tour dies', () => {
    const offer: Offer = {
      slug: 'gone-deal', title: 'Gone', badge: 'Promo', copy: 'x', image: '',
      campaign: validateCampaign({ body: '', terms: '', ctaLabel: '', ctaHref: '/egypt-tours/retired-tour', ctaTourSlug: 'retired-tour', icons: [], priceLabel: '', placements: ['top-bar'] }),
    }
    expect(toTopBarSlides([offer], tours)[0].href).toBe('/special-offers/gone-deal')
  })

  it('keeps validated custom URLs and rejects unsafe ones', () => {
    const offer = (href: string): Offer => ({
      slug: `s-${href.length}`, title: 'x', badge: 'Promo', copy: 'x', image: '',
      campaign: validateCampaign({ body: '', terms: '', ctaLabel: '', ctaHref: href, icons: [], priceLabel: '', placements: ['top-bar'] }),
    })
    expect(toTopBarSlides([offer('/make-your-trip')])[0].href).toBe('/make-your-trip')
    expect(toTopBarSlides([offer('https://partner.example/deal')])[0].href).toBe('https://partner.example/deal')
    for (const href of ['javascript:alert(1)', '//evil.example', 'data:text/html,test', 'http://insecure.example']) {
      expect(safeCampaignHref(href)).toBe(false)
    }
  })

  it('uses the same tour / custom / offer fallback order', () => {
    const toursFor = [{ slug: 'live-tour' }]
    const campaign = (ctaTourSlug: string, ctaHref: string) => validateCampaign({ body: '', terms: '', ctaLabel: '', ctaHref, ctaTourSlug, icons: [], priceLabel: '', placements: ['offers'] })
    const base = { title: 'x', badge: 'Promo', copy: 'x', image: '' }
    expect(campaignCtaHref({ slug: 'a', campaign: campaign('live-tour', '/custom') }, toursFor)).toBe('/egypt-tours/live-tour')
    expect(campaignCtaHref({ slug: 'b', campaign: campaign('', '/custom') }, toursFor)).toBe('/custom')
    expect(campaignCtaHref({ ...base, slug: 'c', campaign: campaign('', '') }, toursFor)).toBe('/special-offers/c')
  })
})

describe('Promotional Bars workflow architecture', () => {
  it('keeps bar placements separate from the original marketing surfaces', () => {
    expect([...promoBarPlacements].sort()).toEqual(['footer-promo', 'top-bar'])
    expect([...marketingPlacements].sort()).toEqual(['blog-sidebar', 'home', 'offers', 'trips-sidebar'])
    for (const placement of promoBarPlacements) {
      expect(marketingPlacements).not.toContain(placement)
      expect(campaignPlacements).toContain(placement)
    }
    expect(readCampaign(undefined).placements).toEqual(['offers'])
  })

  it('recognizes bar records without touching tour or marketing records', () => {
    const barOnly = seedOffer(allSlugs[0])
    const hybrid = seedOffer(allSlugs[0], { slug: 'hybrid', campaign: validateCampaign({ ...barOnly.campaign, placements: ['offers', 'top-bar'] }) })
    const marketing = seedOffer(allSlugs[0], { slug: 'mkt', campaign: validateCampaign({ ...barOnly.campaign, placements: ['offers', 'home'] }) })
    const tourOffer = seedOffer(allSlugs[0], { slug: 'tour', tourSlug: 'some-tour' })
    expect(isPromoBar(barOnly)).toBe(true)
    expect(isPromoBar(hybrid)).toBe(true)
    expect(isPromoBar(marketing)).toBe(false)
    expect(isPromoBar(tourOffer)).toBe(false)
  })

  it('serves the footer placement independently with ordering and scheduling', () => {
    const footerCampaign = (extra: Record<string, unknown> = {}) =>
      validateCampaign({ body: '', terms: '', ctaLabel: '', ctaHref: '', icons: [], priceLabel: '', placements: ['footer-promo'], ...extra })
    const rows: Offer[] = [
      { slug: 'second', title: 'Second', badge: 'Promo', copy: 'x', image: '', displayOrder: 2, campaign: footerCampaign() },
      { slug: 'first', title: 'First', badge: 'Promo', copy: 'x', image: '', displayOrder: 1, campaign: footerCampaign() },
      { slug: 'hidden', title: 'Hidden', badge: 'Promo', copy: 'x', image: '', isPublished: false, campaign: footerCampaign() },
      { slug: 'expired', title: 'Expired', badge: 'Promo', copy: 'x', image: '', deadline: '2000-01-01', campaign: footerCampaign() },
    ]
    expect(placedOffers(rows, 'footer-promo').map((o) => o.slug)).toEqual(['first', 'second'])
    expect(placedOffers(rows.filter((o) => o.slug !== 'hidden'), 'offers').map((o) => o.slug)).toEqual([])
    const hybridRows: Offer[] = [
      { slug: 'hybrid', title: 'H', badge: 'Promo', copy: 'x', image: '', campaign: footerCampaign({ placements: ['offers', 'footer-promo'] }) },
    ]
    expect(placedOffers(hybridRows, 'footer-promo')).toHaveLength(1)
    expect(placedOffers(hybridRows, 'offers')).toHaveLength(1)
  })

  it('rotates through every eligible top-bar record in display order', () => {
    const campaign = validateCampaign({ body: '', terms: '', ctaLabel: '', ctaHref: '', icons: [], priceLabel: '', placements: ['top-bar'] })
    const rows: Offer[] = [
      { slug: 'second', title: 'Second', badge: 'Promo', copy: 'x', image: '', displayOrder: 2, campaign },
      { slug: 'first', title: 'First', badge: 'Promo', copy: 'x', image: '', displayOrder: 1, campaign },
      { slug: 'third', title: 'Third', badge: 'Promo', copy: 'x', image: '', campaign },
    ]
    expect(toTopBarSlides(rows).map((slide) => slide.slug)).toEqual(['first', 'second', 'third'])
  })
})
