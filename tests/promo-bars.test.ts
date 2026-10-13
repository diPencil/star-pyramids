import { describe, expect, it } from 'vitest'
import {
  campaignCtaHref,
  campaignPlacements,
  isPromoBar,
  marketingPlacements,
  promoBarPlacements,
  readCampaign,
  resolveTourCtaHref,
  safeCampaignHref,
  toTopBarSlides,
  placedOffers,
  validateCampaign,
} from '@/lib/marketing-campaigns'
import {
  ACCESS_STRIP_DEFAULT_CTA_LABEL,
  ACCESS_STRIP_DEFAULT_HREF,
  ACCESS_STRIP_DEFAULT_NOTE,
  readAccessStrip,
  resolveAccessStrip,
  validateAccessStrip,
} from '@/lib/access-strip'
import { localizeCatalogue, validateCatalogueTranslations } from '@/lib/catalogue-translations'
import type { Offer } from '@/data/types'

const topBarCampaign = (extra: Record<string, unknown> = {}) =>
  validateCampaign({
    ...readCampaign(undefined),
    body: 'Seasonal value',
    ctaLabel: 'View offers',
    ctaHref: '/special-offers',
    placements: ['top-bar'],
    ...extra,
  })

const offer = (extra: Partial<Offer> = {}): Offer => ({
  slug: 'sample',
  title: 'Sample',
  badge: 'Family',
  copy: 'Description',
  image: '/cover.jpg',
  ...extra,
})

describe('Top promotional bar placement', () => {
  it('registers top-bar as a campaign placement and persists it', () => {
    expect(campaignPlacements).toContain('top-bar')
    const saved = validateCampaign(topBarCampaign())
    expect(readCampaign(saved).placements).toContain('top-bar')
    expect(() => validateCampaign({ ...topBarCampaign(), placements: ['invalid'] })).toThrow()
  })

  it('rotates through every eligible campaign in display order', () => {
    const rows = [
      offer({ slug: 'second', title: 'Second', displayOrder: 2, campaign: topBarCampaign() }),
      offer({ slug: 'first', title: 'First', displayOrder: 1, campaign: topBarCampaign() }),
      offer({ slug: 'third', title: 'Third', campaign: topBarCampaign() }),
    ]
    expect(toTopBarSlides(rows).map((slide) => slide.slug)).toEqual(['first', 'second', 'third'])
  })

  it('hides unpublished, expired and not-yet-started campaigns', () => {
    const rows = [
      offer({ slug: 'live', campaign: topBarCampaign() }),
      offer({ slug: 'hidden', isPublished: false, campaign: topBarCampaign() }),
      offer({ slug: 'expired', deadline: '2000-01-01', campaign: topBarCampaign() }),
      offer({ slug: 'scheduled', startsAt: '2099-01-01', campaign: topBarCampaign() }),
      offer({ slug: 'unpublished-tour', tourSlug: 'draft', linkedTourPublished: false }),
    ]
    expect(toTopBarSlides(rows).map((slide) => slide.slug)).toEqual(['live'])
  })

  it('never pulls linked-tour offers into the top bar', () => {
    const rows = [offer({ slug: 'tour-deal', tourSlug: 'live-tour' })]
    expect(toTopBarSlides(rows)).toEqual([])
    expect(placedOffers(rows, 'home')).toHaveLength(1)
  })

  it('keeps top-bar campaigns out of existing placements unless selected', () => {
    const rows = [offer({ slug: 'bar-only', campaign: topBarCampaign() })]
    expect(placedOffers(rows, 'home')).toEqual([])
    expect(placedOffers(rows, 'offers')).toEqual([])
    expect(placedOffers(rows, 'trips-sidebar')).toEqual([])
    expect(placedOffers(rows, 'blog-sidebar')).toEqual([])
    const shared = [offer({ slug: 'shared', campaign: topBarCampaign({ placements: ['top-bar', 'home'] }) })]
    expect(placedOffers(shared, 'home').map((o) => o.slug)).toEqual(['shared'])
  })

  it('uses the campaign CTA and falls back safely', () => {
    const rows = [
      offer({ slug: 'custom', title: 'Custom', campaign: topBarCampaign({ ctaLabel: 'Plan now', ctaHref: '/make-your-trip' }) }),
      offer({ slug: 'unsafe', title: 'Unsafe', campaign: { ...topBarCampaign(), ctaHref: 'javascript:alert(1)' } }),
      offer({ slug: 'plain', title: 'Plain', campaign: topBarCampaign({ ctaLabel: '', ctaHref: '' }) }),
    ]
    const slides = toTopBarSlides(rows)
    expect(slides[0]).toMatchObject({ text: 'Custom', href: '/make-your-trip', label: 'Plan now' })
    // Empty labels/CTAs degrade to the offer page and the render default.
    expect(slides[1]).toMatchObject({ text: 'Plain', href: '/special-offers/plain', label: '' })
    // Unsafe destinations never reach the header link.
    expect(slides[2]).toMatchObject({ text: 'Unsafe', href: '/special-offers/unsafe' })
  })

  it('renders translated titles and CTA labels per language', () => {
    const translations = validateCatalogueTranslations('offer', {
      es: { title: 'Oferta de verano', 'campaign.ctaLabel': 'Ver ofertas' },
    })
    const localized = localizeCatalogue(
      offer({ slug: 'summer', title: 'Summer offer', campaign: topBarCampaign(), translations }),
      'offer',
      'es',
    )
    const slides = toTopBarSlides([localized])
    expect(slides).toHaveLength(1)
    expect(slides[0]).toMatchObject({ text: 'Oferta de verano', label: 'Ver ofertas' })
  })

  it('rejects unsafe CTA destinations', () => {
    for (const href of ['javascript:alert(1)', '//evil.example', 'data:text/html,test', 'http://insecure.example']) {
      expect(safeCampaignHref(href)).toBe(false)
    }
    expect(safeCampaignHref('/special-offers')).toBe(true)
    expect(safeCampaignHref('https://starpyramids.com/special-offers')).toBe(true)
  })
})

describe('Promotional CTA destination', () => {
  const tours = [
    { slug: 'cairo-and-giza-pyramids' },
    { slug: 'retired-tour', status: 'draft' },
  ]

  it('persists the linked tour slug and accepts legacy records without it', () => {
    const saved = validateCampaign(topBarCampaign({ ctaTourSlug: 'cairo-and-giza-pyramids' }))
    expect(readCampaign(saved).ctaTourSlug).toBe('cairo-and-giza-pyramids')
    expect(readCampaign({ ...topBarCampaign(), ctaTourSlug: undefined }).ctaTourSlug).toBe('')
    expect(() => validateCampaign({ ...topBarCampaign(), ctaTourSlug: 'Not A Slug!' })).toThrow()
    expect(() => validateCampaign({ ...topBarCampaign(), ctaTourSlug: 42 })).toThrow()
  })

  it('resolves a live tour through the shared tour routing convention', () => {
    expect(resolveTourCtaHref('cairo-and-giza-pyramids', tours)).toBe('/egypt-tours/cairo-and-giza-pyramids')
  })

  it('never generates a link for unpublished or removed tours', () => {
    expect(resolveTourCtaHref('retired-tour', tours)).toBeNull()
    expect(resolveTourCtaHref('missing-tour', tours)).toBeNull()
    expect(resolveTourCtaHref('', tours)).toBeNull()
  })

  it('navigates top-bar slides to the linked tour instead of the offer page', () => {
    const rows = [
      offer({
        slug: 'pyramids-deal',
        title: 'Pyramids deal',
        campaign: topBarCampaign({ ctaTourSlug: 'cairo-and-giza-pyramids', ctaHref: '/custom' }),
      }),
    ]
    const slides = toTopBarSlides(rows, tours)
    expect(slides).toHaveLength(1)
    expect(slides[0].href).toBe('/egypt-tours/cairo-and-giza-pyramids')
  })

  it('falls back to the offer page — not a stale URL — when the tour dies', () => {
    const rows = [
      offer({
        slug: 'gone-deal',
        campaign: topBarCampaign({
          ctaTourSlug: 'retired-tour',
          ctaHref: '/egypt-tours/retired-tour',
        }),
      }),
    ]
    expect(toTopBarSlides(rows, tours)[0].href).toBe('/special-offers/gone-deal')
  })

  it('keeps validated custom URLs for campaigns without a linked tour', () => {
    const rows = [
      offer({ slug: 'custom', campaign: topBarCampaign({ ctaHref: '/make-your-trip' }) }),
      offer({ slug: 'external', campaign: topBarCampaign({ ctaHref: 'https://partner.example/deal' }) }),
    ]
    const slides = toTopBarSlides(rows, tours)
    expect(slides.find((s) => s.slug === 'custom')?.href).toBe('/make-your-trip')
    expect(slides.find((s) => s.slug === 'external')?.href).toBe('https://partner.example/deal')
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
    // Legacy default: a campaign without placements stays an offers listing.
    expect(readCampaign(undefined).placements).toEqual(['offers'])
  })

  it('keeps previously created top-bar records valid', () => {
    expect(() => validateCampaign(topBarCampaign())).not.toThrow()
    expect(() => validateCampaign(topBarCampaign({ placements: ['footer-promo'] }))).not.toThrow()
    expect(() => validateCampaign(topBarCampaign({ placements: ['top-bar', 'footer-promo'] }))).not.toThrow()
    expect(readCampaign(topBarCampaign()).placements).toEqual(['top-bar'])
  })

  it('recognizes bar records without touching tour or marketing records', () => {
    const barOnly = offer({ slug: 'bar', campaign: topBarCampaign() })
    const hybrid = offer({ slug: 'hybrid', campaign: topBarCampaign({ placements: ['offers', 'top-bar'] }) })
    const marketing = offer({ slug: 'mkt', campaign: topBarCampaign({ placements: ['offers', 'home'] }) })
    const tour = offer({ slug: 'tour', tourSlug: 'some-tour' })
    const legacy = offer({ slug: 'legacy' })
    expect(isPromoBar(barOnly)).toBe(true)
    expect(isPromoBar(hybrid)).toBe(true)
    expect(isPromoBar(marketing)).toBe(false)
    expect(isPromoBar(tour)).toBe(false)
    expect(isPromoBar(legacy)).toBe(false)
  })

  it('serves the footer placement independently with ordering and scheduling', () => {
    const footerCampaign = (extra: Record<string, unknown> = {}) =>
      topBarCampaign({ placements: ['footer-promo'], ...extra })
    const rows = [
      offer({ slug: 'second', title: 'Second', displayOrder: 2, campaign: footerCampaign() }),
      offer({ slug: 'first', title: 'First', displayOrder: 1, campaign: footerCampaign() }),
      offer({ slug: 'hidden', isPublished: false, campaign: footerCampaign() }),
      offer({ slug: 'expired', deadline: '2000-01-01', campaign: footerCampaign() }),
      offer({ slug: 'tour-deal', tourSlug: 'live-tour' }),
    ]
    expect(placedOffers(rows, 'footer-promo').map((o) => o.slug)).toEqual(['first', 'second'])
    // Bar records stay out of the ordinary catalogue unless also configured there.
    expect(placedOffers(rows.filter((o) => o.slug !== 'tour-deal'), 'offers').map((o) => o.slug)).toEqual([])
    expect(placedOffers(rows, 'home').map((o) => o.slug)).toEqual(['tour-deal'])
    const hybridRows = [offer({ slug: 'hybrid', campaign: footerCampaign({ placements: ['offers', 'footer-promo'] }) })]
    expect(placedOffers(hybridRows, 'footer-promo')).toHaveLength(1)
    expect(placedOffers(hybridRows, 'offers')).toHaveLength(1)
  })

  it('resolves bar CTA destinations with the same tour / custom / offer fallback', () => {
    const tours = [{ slug: 'cairo-and-giza-pyramids' }, { slug: 'retired-tour', status: 'draft' }]
    const live = offer({ slug: 'live', campaign: topBarCampaign({ ctaTourSlug: 'cairo-and-giza-pyramids', ctaHref: '/custom' }) })
    const dead = offer({ slug: 'dead', campaign: topBarCampaign({ ctaTourSlug: 'retired-tour', ctaHref: '/custom' }) })
    const custom = offer({ slug: 'custom', campaign: topBarCampaign({ ctaHref: '/make-your-trip' }) })
    const plain = offer({ slug: 'plain', campaign: topBarCampaign({ ctaHref: '' }) })
    expect(campaignCtaHref(live, tours)).toBe('/egypt-tours/cairo-and-giza-pyramids')
    expect(campaignCtaHref(dead, tours)).toBe('/special-offers/dead')
    expect(campaignCtaHref(custom, tours)).toBe('/make-your-trip')
    expect(campaignCtaHref(plain, tours)).toBe('/special-offers/plain')
  })
})

describe('Footer accessibility strip settings', () => {  it('keeps the long-standing defaults when nothing is configured', () => {
    expect(readAccessStrip(null)).toBeNull()
    expect(readAccessStrip('')).toBeNull()
    expect(ACCESS_STRIP_DEFAULT_HREF).toBe('/accessible-travel')
    expect(ACCESS_STRIP_DEFAULT_NOTE.en).toBe(
      '5% discount on all our tour packages for guests requiring accessibility assistance.',
    )
    expect(ACCESS_STRIP_DEFAULT_CTA_LABEL.en).toBe('Read More')
    for (const locale of ['en', 'es', 'it', 'ar'] as const) {
      const resolved = resolveAccessStrip(null, locale)
      expect(resolved).toEqual({ visible: true, note: '', ctaLabel: '', ctaHref: '' })
    }
  })

  it('resolves per-language overrides and falls back per field', () => {
    const override = readAccessStrip({
      visible: true,
      note: { es: 'Aviso de accesibilidad.' },
      ctaLabel: {},
      ctaHref: '/accessible-travel',
    })
    expect(resolveAccessStrip(override, 'es')).toEqual({
      visible: true,
      note: 'Aviso de accesibilidad.',
      ctaLabel: '',
      ctaHref: '/accessible-travel',
    })
    // Untouched languages keep rendering the built-in copy.
    expect(resolveAccessStrip(override, 'en').note).toBe('')
  })

  it('supports hiding the strip without losing the saved copy', () => {
    const override = readAccessStrip({ visible: false, note: { en: 'Custom notice.' } })
    expect(resolveAccessStrip(override, 'en').visible).toBe(false)
  })

  it('degrades unsafe CTA destinations instead of breaking the strip', () => {
    const override = readAccessStrip({ ctaHref: 'javascript:alert(1)' })
    expect(override?.ctaHref).toBe('')
  })

  it('validates admin input strictly', () => {
    expect(() =>
      validateAccessStrip({
        visible: true,
        note: { en: 'Custom.', ar: 'مخصص.' },
        ctaLabel: { en: 'Read more' },
        ctaHref: '/accessible-travel',
      }),
    ).not.toThrow()
    expect(() => validateAccessStrip({ ctaHref: 'javascript:alert(1)' })).toThrow()
    expect(() => validateAccessStrip({ note: { en: 'x'.repeat(501) } })).toThrow()
    expect(() => validateAccessStrip({ note: { xx: 'Nope' } })).toThrow()
    expect(() => validateAccessStrip({ visible: 'yes' })).toThrow()
    expect(() => validateAccessStrip('not-json')).toThrow()
  })
})
