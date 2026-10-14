import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Blog, Offer, Tour } from '@/data/types'
vi.mock('@/lib/server/record-seo', () => ({ getPublishedRecordSeo: vi.fn(async () => null) }))
vi.mock('@/lib/server/global-seo', () => ({ getGlobalSeo: vi.fn(async () => ({})) }))
vi.mock('@/lib/server/catalogue-translations', () => ({ attachCatalogueTranslations: async (_kind: string, rows: object[]) => rows }))

vi.mock('@/lib/server/db', () => { throw new Error('SEO tests must not access the database') })
vi.mock('@/lib/server/tours', () => ({ listTours: vi.fn() }))
vi.mock('@/lib/server/destinations', () => ({
  getPublishedDestinations: vi.fn(), getPublishedOneDayDestinations: vi.fn(),
}))
vi.mock('@/lib/server/blogs', () => ({ listBlogSlugs: vi.fn() }))
vi.mock('@/lib/server/events', () => ({ getPublishedDbEvents: vi.fn() }))
vi.mock('@/lib/server/offers', () => ({ getPublishedDbOffers: vi.fn() }))
vi.mock('@/lib/server/categories', () => ({ getPublishedCategories: vi.fn() }))
vi.mock('@/lib/server/seo-manager', () => ({ readSeoState: vi.fn() }))

import { getCanonicalUrl, getHreflangEntries, getSiteUrl } from '@/lib/seo'
import sitemap from '@/app/sitemap'
import robots from '@/app/robots'
import { listTours } from '@/lib/server/tours'
import { getPublishedDestinations, getPublishedOneDayDestinations } from '@/lib/server/destinations'
import { listBlogSlugs } from '@/lib/server/blogs'
import { getPublishedDbEvents } from '@/lib/server/events'
import { getPublishedDbOffers } from '@/lib/server/offers'
import { getPublishedCategories } from '@/lib/server/categories'
import { readSeoState } from '@/lib/server/seo-manager'
import { initialPageState } from '@/lib/page-sections'
import { originalSeoPage } from '@/lib/seo-manager'
import { generateBlogPostingJsonLd, generateOrganizationJsonLd, generateTouristTripJsonLd, renderJsonLd } from '@/lib/structured-data'

afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks() })
beforeEach(() => {
  vi.mocked(readSeoState).mockResolvedValue(initialPageState())
  for (const reader of [listTours, getPublishedDestinations, getPublishedOneDayDestinations,
    listBlogSlugs, getPublishedDbEvents, getPublishedDbOffers, getPublishedCategories]) {
    vi.mocked(reader).mockResolvedValue([])
  }
})

describe('public SEO origin', () => {
  it.each([
    '', 'not a URL', 'http://starpyramids.com', 'https://localhost:3000',
    'https://preview.localhost', 'https://127.0.0.1', 'https://10.0.0.1',
    'https://[::1]', 'https://intranet', 'https://preview.local',
    'https://user:password@starpyramids.com', 'https://user@starpyramids.com',
  ])('falls back for %s', async (value) => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', value)
    expect(await getSiteUrl()).toBe('https://starpyramids.com')
    expect(generateOrganizationJsonLd()).toHaveProperty('url', 'https://starpyramids.com')
  })

  it('normalizes the configured origin and retains the single-URL locale strategy', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.starpyramids.com/path/?query=1#hash')
    expect(await getSiteUrl()).toBe('https://www.starpyramids.com')
    expect(await getCanonicalUrl('trips')).toBe('https://www.starpyramids.com/trips')
    expect(await getHreflangEntries('/trips')).toEqual({
      en: 'https://www.starpyramids.com/trips', 'x-default': 'https://www.starpyramids.com/trips',
    })
  })
})

describe('technical discovery', () => {
  it('applies published SEO-only state to listing, cruise template, and planner URLs', async () => {
    vi.mocked(readSeoState).mockImplementation(async (id) => {
      const content = originalSeoPage(id)
      const excluded = ['trips', 'standard-nile-cruises', 'planner'].includes(id)
      return { ...initialPageState(), seoManaged: true,
        published: { ...content, seo: { ...content.seo, index: !excluded } },
        seoDraft: { ...content.seo, index: true },
      }
    })
    const paths = (await sitemap()).map(({ url }) => new URL(url).pathname)
    expect(paths).not.toContain('/trips')
    expect(paths).not.toContain('/egypt-tours/nile-cruises/standard-nile-cruises')
    expect(paths).not.toContain('/make-your-trip')
    expect(paths).toContain('/egypt-tours/nile-cruises/deluxe-nile-cruise')
    expect(paths).toContain('/faq')
  })

  it('excludes published noindex and alternate canonical static routes', async () => {
    vi.mocked(readSeoState).mockImplementation(async (id) => {
      const content = originalSeoPage(id)
      return { ...initialPageState(), seoManaged: true,
        published: { ...content, seo: { ...content.seo,
          ...(id === 'homepage' ? { index: false } : {}),
          ...(id === 'faq' ? { canonical: '/contact' } : {}),
          ...(id === 'privacy' ? { canonical: '/privacy', follow: false } : {}),
        } },
      }
    })
    const paths = (await sitemap()).map(({ url }) => new URL(url).pathname)
    expect(paths).not.toContain('/')
    expect(paths).not.toContain('/faq')
    expect(paths).toContain('/privacy')
    expect(paths).toContain('/contact')
  })

  it('ignores unpublished SEO and page drafts', async () => {
    vi.mocked(readSeoState).mockImplementation(async (id) => {
      const content = originalSeoPage(id)
      const draftSeo = { ...content.seo, index: false, canonical: '/contact' }
      return { ...initialPageState(), seoDraft: draftSeo, draft: { ...content, seo: draftSeo } }
    })
    const paths = (await sitemap()).map(({ url }) => new URL(url).pathname)
    expect(paths).toContain('/')
    expect(paths).toContain('/faq')
  })

  it('honors published page SEO while a conflicting SEO draft exists', async () => {
    vi.mocked(readSeoState).mockImplementation(async (id) => {
      const content = originalSeoPage(id)
      return { ...initialPageState(), mode: 'published',
        published: { ...content, seo: { ...content.seo, index: id !== 'faq' } },
        seoDraft: { ...content.seo, index: true },
      }
    })
    const paths = (await sitemap()).map(({ url }) => new URL(url).pathname)
    expect(paths).not.toContain('/faq')
    expect(paths).toContain('/')
  })

  it('preserves static routes when SEO state cannot be read', async () => {
    vi.mocked(readSeoState).mockRejectedValue(new Error('CMS unavailable'))
    const paths = (await sitemap()).map(({ url }) => new URL(url).pathname)
    expect(paths).toContain('/')
    expect(paths).toContain('/faq')
  })

  it('uses public repositories and canonical tour slugs without invented metadata', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.mocked(listTours).mockResolvedValue([
      { slug: 'published-tour', aliases: ['old-tour'], status: 'published' },
      { slug: 'draft-tour', status: 'draft' },
    ] as Tour[])
    vi.mocked(getPublishedDestinations).mockResolvedValue([{ slug: 'giza' }] as never)
    vi.mocked(getPublishedOneDayDestinations).mockResolvedValue([{ slug: 'cairo' }] as never)
    vi.mocked(listBlogSlugs).mockResolvedValue(['story', 'story'])
    vi.mocked(getPublishedDbEvents).mockResolvedValue([{ slug: 'festival' }] as never)
    vi.mocked(getPublishedDbOffers).mockResolvedValue([{ slug: 'offer' }] as never)
    vi.mocked(getPublishedCategories).mockResolvedValue([{ slug: 'classic' }] as never)
    const entries = await sitemap()
    const paths = entries.map(({ url }) => new URL(url).pathname)
    expect(paths).toEqual(expect.arrayContaining([
      '/egypt-tours/published-tour', '/destinations/giza', '/blogs/story', '/events/festival',
      '/special-offers/offer', '/egypt-tours/one-day-tours/cairo',
      '/egypt-tours/multi-days-tours/classic', '/egypt-tours/nile-cruises/standard-nile-cruises',
    ]))
    expect(paths).not.toContain('/egypt-tours/old-tour')
    expect(paths).not.toContain('/egypt-tours/draft-tour')
    expect(new Set(paths).size).toBe(paths.length)
    expect(entries.every((entry) => Object.keys(entry).join() === 'url')).toBe(true)
    expect(paths.some((path) => /^\/(en|es|it)\//.test(path))).toBe(false)
  })

  it('omits unavailable collections without static entity fallbacks', async () => {
    for (const reader of [listTours, getPublishedDestinations, getPublishedOneDayDestinations,
      listBlogSlugs, getPublishedDbEvents, getPublishedDbOffers, getPublishedCategories]) {
      vi.mocked(reader).mockRejectedValue(new Error('unavailable'))
    }
    expect((await sitemap()).some(({ url }) => url.endsWith('/trips'))).toBe(true)
    expect((await sitemap()).some(({ url }) => url.includes('/blogs/'))).toBe(false)
  })

  it('omits redirecting linked offers and unpublished records without exposing draft tours', async () => {
    vi.mocked(listTours).mockResolvedValue([
      { slug: 'live-tour', status: 'published' },
      { slug: 'draft-tour', status: 'draft' },
    ] as Tour[])
    vi.mocked(getPublishedDbOffers).mockResolvedValue([
      { slug: 'standalone', isPublished: true },
      { slug: 'linked-offer', tourSlug: 'live-tour', isPublished: true },
      { slug: 'linked-draft-tour', tourSlug: 'draft-tour', isPublished: true },
      { slug: 'unpublished-linked-offer', tourSlug: 'live-tour', isPublished: false },
      { slug: 'unpublished-standalone', isPublished: false },
    ] as Offer[])
    const paths = (await sitemap()).map(({ url }) => new URL(url).pathname)
    expect(paths.filter((path) => path.startsWith('/special-offers/'))).toEqual(['/special-offers/standalone'])
    expect(paths.filter((path) => path === '/egypt-tours/live-tour')).toHaveLength(1)
    expect(paths).not.toContain('/egypt-tours/draft-tour')
  })

  it('keeps public crawling enabled and excludes private preview and voucher routes', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://localhost')
    const result = await robots()
    expect(result.sitemap).toBe('https://starpyramids.com/sitemap.xml')
    expect(result.rules).toEqual([expect.objectContaining({
      userAgent: '*', allow: '/', disallow: expect.arrayContaining([
        '/website-cms-preview', '/verify-voucher', '/admin/', '/account/', '/booking/', '/api/',
      ]),
    })])
  })
})

describe('JSON-LD', () => {
  it('escapes script breakouts while preserving JSON content', () => {
    const data = { name: '</script><script>alert(1)</script>' }
    const element = renderJsonLd(data)
    const html = (element.props as { dangerouslySetInnerHTML: { __html: string } }).dangerouslySetInnerHTML.__html
    expect(html).not.toContain('<')
    expect(JSON.parse(html)).toEqual(data)
  })

  it('omits unsupported organization assertions', () => {
    const org = generateOrganizationJsonLd()
    for (const key of ['geo', 'sameAs', 'image', 'priceRange']) expect(org).not.toHaveProperty(key)
    expect(org).toHaveProperty('paymentAccepted', 'Cash, Bank Transfer')
    expect(org).toHaveProperty('currenciesAccepted', 'USD')
  })

  it('rejects nonfinite prices and avoids invented availability and validity dates', () => {
    const tour = { slug: 'tour', title: 'Tour', summary: 'Summary', category: 'one-day-tours', price: Infinity } as Tour
    expect(generateTouristTripJsonLd(tour)).not.toHaveProperty('offers')
    const priced = generateTouristTripJsonLd({ ...tour, price: 50 })
    expect(priced).toHaveProperty('offers.price', 50)
    expect(priced).not.toHaveProperty('offers.validFrom')
    expect(priced).not.toHaveProperty('offers.availability')
  })

  it('keeps itinerary counts consistent with the emitted locations', () => {
    const tour = { slug: 'tour', title: 'Tour', category: 'one-day-tours',
      detail: { itinerary: [{ title: 'Day one' }], locations: ['Giza', 'Cairo'] },
    } as Tour
    const result = generateTouristTripJsonLd(tour)
    expect(result).toHaveProperty('itinerary.numberOfItems', 2)
    expect(result).toHaveProperty('itinerary.itemListElement.length', 2)
  })

  it('does not claim a publication date is a modification date', () => {
    const blog = { slug: 'story', title: 'Story', excerpt: 'Text', date: '2026-01-01', category: 'Travel' } as Blog
    const result = generateBlogPostingJsonLd(blog)
    expect(result).toHaveProperty('datePublished', '2026-01-01')
    expect(result).not.toHaveProperty('dateModified')
  })
})
