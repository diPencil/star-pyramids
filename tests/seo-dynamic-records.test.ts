import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SeoContent } from '@/lib/seo-content'
import type { Tour, Blog } from '@/data/types'

const state = vi.hoisted(() => ({ locale: 'en', seo: null as (SeoContent & { structuredData?: boolean }) | null, category: 'multi-days-tours', destinationSlug: undefined as string | undefined }))
vi.mock('@/lib/server/db', () => { throw new Error('Public SEO tests must not access the database') })
vi.mock('@/lib/server/locale', () => ({ getServerLocale: async () => state.locale, getOgLocale: (locale: string) => ({ en: 'en_US', es: 'es_ES', it: 'it_IT' })[locale] }))
vi.mock('@/lib/server/record-seo', () => ({ getPublishedRecordSeo: vi.fn(async () => state.seo) }))
vi.mock('@/lib/server/global-seo', () => ({ getGlobalSeo: async () => ({ openGraph: { images: [{ url: '/global.jpg' }] }, twitter: { images: ['/global.jpg'] } }) }))
vi.mock('@/lib/server/catalogue-translations', () => ({ attachCatalogueTranslations: async (_kind: string, rows: object[]) => rows }))
vi.mock('@/lib/server/tours', () => ({ findTourBySlug: async () => ({ ...record, status: 'published', category: state.category, destinationSlug: state.destinationSlug }), getRelatedDbTours: async () => [], listTours: async () => [{ slug: 'live', status: 'published' }, { slug: 'draft', status: 'draft' }] }))
vi.mock('@/lib/server/destinations', () => ({ findDestinationBySlug: async () => record, getPublishedDestinations: async () => [{ slug: 'giza' }], getPublishedOneDayDestinations: async () => [{ ...record, slug: 'giza' }] }))
vi.mock('@/lib/server/blogs', () => ({ findBlogBySlug: async () => ({ ...record, category: 'Travel' }), getPublishedDbBlogs: async () => [], listBlogSlugs: async () => ['story'] }))
vi.mock('@/lib/server/events', () => ({ findEventBySlug: async () => record, getPublishedDbEvents: async () => [{ slug: 'festival' }] }))
vi.mock('@/lib/server/offers', () => ({ findOfferBySlug: async () => record, getPublishedDbOffers: async () => [{ slug: 'offer' }, { slug: 'linked', tourSlug: 'live' }, { slug: 'hidden', isPublished: false }] }))
vi.mock('@/lib/server/categories', () => ({ findCategoryBySlug: async () => ({ ...record, active: true }), getPublishedCategories: async () => [{ slug: 'classic' }] }))
vi.mock('@/lib/server/seo-manager', () => ({ readSeoState: async () => ({}) }))
vi.mock('@/components/site', () => ({ SiteShell: () => null, OneDayDestinationPage: () => null, MultiDayCategoryPage: () => null }))
vi.mock('@/components/tour-detail', () => ({ TourDetailPage: () => null }))
vi.mock('@/components/day-tour-detail', () => ({ DayTourDetailPage: () => null }))
vi.mock('@/components/extended-pages', () => ({ BlogDetailPage: () => null, DestinationDetailPage: () => null, EventDetailPage: () => null, OfferDetailPage: () => null }))

import { dynamicSeo, dynamicCategorySeo, publicRecordCanonical, recordStructuredDataEnabled } from '@/lib/dynamic-seo'
import { RecordPageJsonLd, generateBuiltinRecordSchemaPreview, generateTouristTripJsonLd, generateBlogPostingJsonLd } from '@/lib/structured-data'
import { getPublishedRecordSeo } from '@/lib/server/record-seo'
import sitemap from '@/app/sitemap'
import TourPage, { generateMetadata as tourMetadata } from '@/app/egypt-tours/[slug]/page'
import BlogPage, { generateMetadata as blogMetadata } from '@/app/blogs/[slug]/page'
import { generateMetadata as destinationMetadata } from '@/app/destinations/[slug]/page'
import { generateMetadata as eventMetadata } from '@/app/events/[slug]/page'
import { generateMetadata as offerMetadata } from '@/app/special-offers/[slug]/page'
import { generateMetadata as regionMetadata } from '@/app/egypt-tours/one-day-tours/[region]/page'
import { generateMetadata as categoryMetadata } from '@/app/egypt-tours/multi-days-tours/[category]/page'

const record = { slug: 'live', title: 'Visible title', name: 'Visible category', summary: 'Summary', excerpt: 'Excerpt', copy: 'Copy', image: '/record.jpg' }
const published = (): SeoContent & { structuredData?: boolean } => ({
  text: { en: { title: 'Saved EN', description: 'Description EN' }, es: { title: 'Saved ES', description: 'Description ES' }, it: { title: 'Saved IT', description: 'Description IT' } },
  image: '/saved.jpg', index: false, follow: false, card: 'summary',
})

beforeEach(() => { state.locale = 'en'; state.seo = null; state.category = 'multi-days-tours'; state.destinationSlug = undefined; vi.clearAllMocks(); vi.mocked(getPublishedRecordSeo).mockImplementation(async () => state.seo) })

describe('published record metadata', () => {
  it('applies published overrides through all seven actual public route groups', async () => {
    state.locale = 'es'; state.seo = published()
    const params = { params: Promise.resolve({ slug: 'live' }) }
    const metadata = await Promise.all([
      tourMetadata(params), blogMetadata(params), destinationMetadata(params), eventMetadata(params), offerMetadata(params),
      regionMetadata({ params: Promise.resolve({ region: 'giza' }) }),
      categoryMetadata({ params: Promise.resolve({ category: 'live' }) }),
    ])
    for (const result of metadata) {
      expect(result.title).toEqual({ absolute: 'Saved ES' })
      expect(result.robots).toEqual({ index: false, follow: false })
    }
  })
  it.each(['tour', 'blog', 'destination', 'event', 'offer', 'category'] as const)('uses saved SEO for %s without changing visible records', async kind => {
    state.seo = published()
    const before = JSON.stringify(record)
    const metadata = kind === 'category' ? await dynamicCategorySeo(record, '/categories') : await dynamicSeo(record, kind, '/records')
    expect(metadata.title).toEqual({ absolute: 'Saved EN' })
    expect(metadata.description).toBe('Description EN')
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.openGraph).toMatchObject({ images: [{ url: '/saved.jpg' }], title: 'Saved EN' })
    expect(metadata.twitter).toMatchObject({ card: 'summary', images: ['/saved.jpg'] })
    expect(getPublishedRecordSeo).toHaveBeenCalledWith(kind, 'live')
    expect(JSON.stringify(record)).toBe(before)
  })

  it.each(['en', 'es', 'it'])('uses independent saved %s SEO and only real hreflangs', async locale => {
    state.locale = locale; state.seo = published(); state.seo.canonical = '/destinations/giza'
    const metadata = await dynamicSeo(record, 'tour', '/egypt-tours')
    expect(metadata.title).toEqual({ absolute: `Saved ${locale.toUpperCase()}` })
    expect(metadata.alternates).toEqual({ canonical: 'https://starpyramids.com/destinations/giza', languages: { en: 'https://starpyramids.com/destinations/giza', 'x-default': 'https://starpyramids.com/destinations/giza' } })
    expect(metadata.openGraph).toMatchObject({ url: metadata.alternates?.canonical })
  })

  it('keeps each destination URL self canonical when no override is published', async () => {
    state.seo = published()
    for (const route of ['/destinations', '/egypt-tours/one-day-tours']) {
      expect((await dynamicSeo(record, 'destination', route)).alternates?.canonical).toBe(`https://starpyramids.com${route}/live`)
    }
  })

  it('retains original fields and global social images for blank overrides', async () => {
    state.seo = { text: { en: { title: '', description: '' }, es: { title: '', description: '' }, it: { title: '', description: '' } }, image: '' }
    const metadata = await dynamicSeo({ ...record, image: '' }, 'tour', '/egypt-tours')
    expect(metadata.title).toEqual({ absolute: 'Visible title | STAR PYRAMIDS' })
    expect(metadata.description).toBe('Summary')
    expect(metadata.openGraph).toMatchObject({ images: [{ url: '/global.jpg' }] })
  })

  it('fails closed only for metadata whose published SEO read rejects', async () => {
    vi.mocked(getPublishedRecordSeo).mockImplementation(async kind => {
      if (kind === 'tour') throw new Error('Unavailable or malformed payload')
      return null
    })
    const failed = await dynamicSeo(record, 'tour', '/egypt-tours')
    expect(failed.description).toBe('Summary')
    expect(failed.robots).toEqual({ index: false, follow: false })
    expect((await dynamicSeo(record, 'blog', '/blogs')).robots).toBeUndefined()
  })

  it.each(['https://evil.com', '//evil.com', '/admin/trips', '/search', '/a?b', '/a#b', '/a/../b', '/a\\b'])('ignores invalid canonical %s', value => {
    expect(publicRecordCanonical(value)).toBeUndefined()
  })
})

describe('record schema', () => {
  it('disables schema on rejected reads while successful null reads stay automatic', async () => {
    vi.mocked(getPublishedRecordSeo).mockImplementation(async kind => {
      if (kind === 'event') throw new Error('Unavailable or malformed payload')
      return null
    })
    expect(await recordStructuredDataEnabled('event', 'festival')).toBe(false)
    expect(await RecordPageJsonLd({ kind: 'event', slug: 'festival', name: 'Festival', path: '/events/festival' })).toBeNull()
    expect(await recordStructuredDataEnabled('tour', 'live')).toBe(true)
  })
  it.each(['multi-days-tours', 'nile-cruises', 'shore-excursions', 'one-day-tours'])('uses the visible %s category breadcrumb route', async category => {
    state.category = category
    const element = await TourPage({ params: Promise.resolve({ slug: 'live' }) })
    const breadcrumb = (element.props as { children: { props: { dangerouslySetInnerHTML: { __html: string } } }[] }).children[1]
    const data = JSON.parse(breadcrumb.props.dangerouslySetInnerHTML.__html)
    expect(data.itemListElement.map((item: { item: string }) => item.item)).toEqual([
      'https://starpyramids.com', `https://starpyramids.com/egypt-tours/${category}`, 'https://starpyramids.com/egypt-tours/live',
    ])
    expect(data.itemListElement[1].name).toBe(category === 'one-day-tours' ? 'One Day Tours' : 'Egypt Tours')
  })

  it.each(['giza', 'missing-region'])('includes only a real public day-tour region (%s)', async destinationSlug => {
    state.category = 'one-day-tours'; state.destinationSlug = destinationSlug
    const element = await TourPage({ params: Promise.resolve({ slug: 'live' }) })
    const breadcrumb = (element.props as { children: { props: { dangerouslySetInnerHTML: { __html: string } } }[] }).children[1]
    const data = JSON.parse(breadcrumb.props.dangerouslySetInnerHTML.__html)
    expect(data.itemListElement).toHaveLength(destinationSlug === 'giza' ? 4 : 3)
    if (destinationSlug === 'giza') expect(data.itemListElement[2]).toMatchObject({ name: 'Visible title', item: 'https://starpyramids.com/egypt-tours/one-day-tours/giza' })
  })

  it('previews the same built-in rich schema from full records and honors disabling', () => {
    const tour = { ...record, category: 'one-day-tours', price: 40 } as Tour
    const blog = { ...record, category: 'Travel', date: '2026-01-01' } as Blog
    expect(generateBuiltinRecordSchemaPreview({ kind: 'tour', record: tour })).toEqual(generateTouristTripJsonLd(tour))
    expect(generateBuiltinRecordSchemaPreview({ kind: 'blog', record: blog })).toEqual(generateBlogPostingJsonLd(blog))
    expect(generateBuiltinRecordSchemaPreview({ kind: 'tour', record: tour }, false)).toBeNull()
    expect(generateBuiltinRecordSchemaPreview({ kind: 'blog', record: blog }, false)).toBeNull()
  })
  it.each([TourPage, BlogPage])('disables existing detail and breadcrumb blocks together', async page => {
    state.seo = { ...published(), structuredData: false }
    const element = await page({ params: Promise.resolve({ slug: 'live' }) })
    const children = (element.props as { children: unknown[] }).children
    expect(children.slice(0, 2)).toEqual([false, false])
    state.seo = null
    const automatic = await page({ params: Promise.resolve({ slug: 'live' }) })
    const scripts = (automatic.props as { children: { type: string }[] }).children
    expect(scripts.slice(0, 2).map(child => child.type)).toEqual(['script', 'script'])
  })
  it('defaults to automatic and disables only for a published false flag', async () => {
    expect(await recordStructuredDataEnabled('tour', 'live')).toBe(true)
    state.seo = { ...published(), structuredData: false }
    expect(await recordStructuredDataEnabled('blog', 'live')).toBe(false)
    expect(await RecordPageJsonLd({ kind: 'event', slug: 'live', name: 'Visible event', path: '/events/live' })).toBeNull()
  })

  it.each([false, true])('emits conservative visible page data (collection=%s)', async collection => {
    const element = await RecordPageJsonLd({ kind: 'destination', slug: 'giza', name: 'Giza', path: '/destinations/giza', collection })
    const data = JSON.parse((element!.props as { dangerouslySetInnerHTML: { __html: string } }).dangerouslySetInnerHTML.__html)
    expect(data).toEqual({ '@context': 'https://schema.org', '@type': collection ? 'CollectionPage' : 'WebPage', name: 'Giza', url: 'https://starpyramids.com/destinations/giza' })
  })
})

describe('record sitemap policies', () => {
  it('omits only URLs whose published SEO read rejects, retaining successful null reads', async () => {
    vi.mocked(getPublishedRecordSeo).mockImplementation(async (kind, slug) => {
      if (kind === 'destination' && slug === 'giza') throw new Error('Unavailable or malformed payload')
      return null
    })
    const paths = (await sitemap()).map(entry => new URL(entry.url).pathname)
    expect(paths).not.toContain('/destinations/giza')
    expect(paths).not.toContain('/egypt-tours/one-day-tours/giza')
    expect(paths).toEqual(expect.arrayContaining(['/egypt-tours/live', '/blogs/story', '/events/festival', '/special-offers/offer', '/egypt-tours/multi-days-tours/classic', '/trips']))
    expect(vi.mocked(getPublishedRecordSeo).mock.calls.filter(([kind]) => kind === 'destination')).toHaveLength(1)
  })
  it('excludes noindex records across all collections and never reads hidden or linked records', async () => {
    state.seo = published()
    const paths = (await sitemap()).map(entry => new URL(entry.url).pathname)
    expect(paths).not.toContain('/egypt-tours/live')
    expect(paths).not.toContain('/blogs/story')
    expect(paths).not.toContain('/destinations/giza')
    expect(paths).not.toContain('/egypt-tours/one-day-tours/giza')
    expect(paths).not.toContain('/events/festival')
    expect(paths).not.toContain('/special-offers/offer')
    expect(paths).not.toContain('/egypt-tours/multi-days-tours/classic')
    for (const slug of ['draft', 'hidden', 'linked']) expect(vi.mocked(getPublishedRecordSeo).mock.calls.flat()).not.toContain(slug)
  })

  it('evaluates both destination paths separately and shares a single published read', async () => {
    vi.mocked(getPublishedRecordSeo).mockImplementation(async kind => kind === 'destination' ? { ...published(), index: true, canonical: '/destinations/giza' } : null)
    const paths = (await sitemap()).map(entry => new URL(entry.url).pathname)
    expect(paths).toContain('/destinations/giza')
    expect(paths).not.toContain('/egypt-tours/one-day-tours/giza')
    expect(vi.mocked(getPublishedRecordSeo).mock.calls.filter(([kind]) => kind === 'destination')).toHaveLength(1)
  })
})
