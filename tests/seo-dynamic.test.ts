import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/server/record-seo', () => ({ getPublishedRecordSeo: vi.fn(async () => null) }))
vi.mock('@/lib/server/global-seo', () => ({ getGlobalSeo: vi.fn(async () => ({})) }))

const state = vi.hoisted(() => ({ cookie: undefined as string | undefined, record: null as Record<string, unknown> | null, linkedTour: undefined as Record<string, unknown> | null | undefined, translations: {} as Record<string, Record<string, string>> }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => key === 'star-locale' && state.cookie ? { value: state.cookie } : undefined }) }))
vi.mock('@/lib/server/settings', () => ({ getSetting: async () => 'Star Pyramids' }))
vi.mock('@/lib/server/catalogue-translations', () => ({ attachCatalogueTranslations: vi.fn(async (_kind: string, rows: object[]) => rows.map((row) => ({ ...row, translations: state.translations }))) }))
vi.mock('@/lib/server/tours', () => ({ listTours: vi.fn(async () => []), findTourBySlug: vi.fn(async () => state.linkedTour === undefined ? state.record : state.linkedTour) }))
vi.mock('@/lib/server/blogs', () => ({ findBlogBySlug: async () => state.record }))
vi.mock('@/lib/server/destinations', () => ({
  findDestinationBySlug: async () => state.record,
  getPublishedOneDayDestinations: vi.fn(async () => state.record?.showInOneDayTours === true && state.record?.isPublished !== false ? [state.record] : []),
}))
vi.mock('@/lib/server/categories', () => ({ findCategoryBySlug: vi.fn(async () => state.record) }))
vi.mock('@/lib/server/events', () => ({ findEventBySlug: async () => state.record }))
vi.mock('@/lib/server/offers', () => ({ findOfferBySlug: async () => state.record }))
vi.mock('@/components/site', () => ({ SiteShell: () => null }))
vi.mock('@/components/tour-detail', () => ({ TourDetailPage: () => null }))
vi.mock('@/components/day-tour-detail', () => ({ DayTourDetailPage: () => null }))
vi.mock('@/components/extended-pages', () => ({ DestinationDetailPage: () => null, EventDetailPage: () => null }))
vi.mock('@/lib/structured-data', () => ({ RecordPageJsonLd: () => null }))

import { generateMetadata as tour } from '@/app/egypt-tours/[slug]/page'
import { generateMetadata as blog } from '@/app/blogs/[slug]/page'
import DestinationPage, { generateMetadata as destination } from '@/app/destinations/[slug]/page'
import EventPage, { generateMetadata as event } from '@/app/events/[slug]/page'
import { generateMetadata as offer } from '@/app/special-offers/[slug]/page'
import RegionPage, { generateMetadata as regionMetadata } from '@/app/egypt-tours/one-day-tours/[region]/page'
import CategoryPage, { generateMetadata as categoryMetadata } from '@/app/egypt-tours/multi-days-tours/[category]/page'
import { attachCatalogueTranslations } from '@/lib/server/catalogue-translations'
import { getPublishedOneDayDestinations } from '@/lib/server/destinations'
import { findCategoryBySlug } from '@/lib/server/categories'
import { findTourBySlug } from '@/lib/server/tours'

const routes = [
  ['egypt-tours', tour], ['blogs', blog], ['destinations', destination], ['events', event], ['special-offers', offer],
] as const
const params = { params: Promise.resolve({ slug: 'alias' }) }

beforeEach(() => {
  vi.clearAllMocks()
  state.cookie = undefined
  state.linkedTour = undefined
  state.translations = {}
  state.record = { slug: 'canonical', title: 'Original title', image: '/record.jpg', summary: 'Original summary', excerpt: 'Original excerpt', copy: 'Original copy', detail: { tourSlugs: [] }, status: 'published' }
})

describe.each(routes)('%s metadata', (route, generate) => {
  it('uses an absolute title, canonical record slug, real hreflangs and matching social images', async () => {
    const result = await generate(params)
    expect(result.title).toEqual({ absolute: 'Original title | STAR PYRAMIDS' })
    const canonical = result.alternates?.canonical
    expect(canonical).toEqual(expect.stringContaining(`/${route}/canonical`))
    expect(result.alternates?.languages).toEqual({ en: canonical, 'x-default': canonical })
    expect(result.openGraph).toMatchObject({ title: 'Original title | STAR PYRAMIDS', url: canonical, locale: 'en_US', images: [{ url: '/record.jpg' }] })
    expect(result.twitter).toMatchObject({ images: ['/record.jpg'], description: result.description })
  })

  it.each(['es', 'it'])('uses actual %s catalogue copy or an honest English tour fallback', async (locale) => {
    state.cookie = locale
    state.translations = { [locale]: { title: 'Translated title', excerpt: 'Translated excerpt', copy: 'Translated copy' } }
    state.record!.translations = state.translations
    const result = await generate(params)
    expect(result.title).toEqual({ absolute: `${route === 'egypt-tours' ? 'Original title' : 'Translated title'} | STAR PYRAMIDS` })
    expect(result.description).toBe(route === 'egypt-tours' ? 'Original summary' : route === 'blogs' ? 'Translated excerpt' : 'Translated copy')
  })

  it('does not mix untranslated descriptions into a translated title', async () => {
    state.cookie = 'es'
    state.translations = { es: { title: 'Translated title', excerpt: '  ', copy: '  ' } }
    state.record!.translations = state.translations
    expect((await generate(params)).description).toBe(route === 'egypt-tours' ? 'Original summary' : 'Translated title')
  })

  it.each(['es', 'it', 'ar', 'invalid'])('falls back coherently when %s has no translated title', async (locale) => {
    state.cookie = locale
    state.translations = { [locale]: { copy: 'Orphan translation', excerpt: 'Orphan translation' } }
    state.record!.translations = state.translations
    const result = await generate(params)
    expect(result.title).toEqual({ absolute: 'Original title | STAR PYRAMIDS' })
    expect(result.openGraph).toMatchObject({ locale: 'en_US' })
    expect(result.description).toMatch(/^Original /)
  })

  it('uses the record title for blank descriptions and clears social images when absent', async () => {
    Object.assign(state.record!, { copy: '  ', summary: '', excerpt: '', image: '' })
    const result = await generate(params)
    expect(result.description).toBe('Original title')
    expect(result.openGraph).toMatchObject({ images: [] })
    expect(result.twitter).toMatchObject({ images: [] })
  })

  it('keeps missing records noindex', async () => {
    state.record = null
    expect((await generate(params)).robots).toEqual({ index: false, follow: false })
  })
})

it('keeps unpublished tours noindex', async () => {
  state.record!.status = 'draft'
  expect((await tour(params)).robots).toEqual({ index: false, follow: false })
})

describe('public detail visibility and linked offers', () => {
  it.each([
    ['destination', destination, DestinationPage],
    ['event', event, EventPage],
  ] as const)('keeps unpublished %s records out of metadata and rendering', async (_kind, generate, page) => {
    state.record!.isPublished = false
    const result = await generate(params)
    expect(result.robots).toEqual({ index: false, follow: false })
    expect(result.alternates).toBeUndefined()
    expect(result.openGraph).toBeUndefined()
    await expect(page(params)).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(attachCatalogueTranslations).not.toHaveBeenCalled()
  })

  it('allows published destinations excluded only from destination listings', async () => {
    Object.assign(state.record!, { isPublished: true, showInDestinations: false })
    expect((await destination(params)).alternates?.canonical).toEqual(expect.stringMatching(/\/destinations\/canonical$/))
    await expect(DestinationPage(params)).resolves.toBeDefined()
  })

  it('uses the published linked tour metadata instead of independent offer SEO', async () => {
    state.record!.tourSlug = 'tour-alias'
    state.linkedTour = { slug: 'canonical-tour', title: 'Linked tour', summary: 'Tour summary', image: '/tour.jpg', status: 'published' }
    const result = await offer(params)
    expect(findTourBySlug).toHaveBeenCalledWith('tour-alias')
    expect(result.title).toEqual({ absolute: 'Linked tour | STAR PYRAMIDS' })
    expect(result.description).toBe('Tour summary')
    expect(result.alternates?.canonical).toEqual(expect.stringMatching(/\/egypt-tours\/canonical-tour$/))
    expect(result.alternates?.languages).toEqual({ en: result.alternates?.canonical, 'x-default': result.alternates?.canonical })
    expect(result.openGraph).toMatchObject({ url: result.alternates?.canonical, images: [{ url: '/tour.jpg' }] })
    expect(result.twitter).toMatchObject({ images: ['/tour.jpg'] })
    expect(attachCatalogueTranslations).not.toHaveBeenCalled()
  })

  it.each([null, { slug: 'hidden-tour', title: 'Hidden tour', status: 'draft' }])('does not advertise unavailable linked tours: %j', async (linkedTour) => {
    state.record!.tourSlug = 'unavailable-tour'
    state.linkedTour = linkedTour
    const result = await offer(params)
    expect(result.robots).toEqual({ index: false, follow: false })
    expect(result.alternates).toBeUndefined()
    expect(result.openGraph).toBeUndefined()
  })
})

const regionParams = { params: Promise.resolve({ region: 'canonical' }) }
const categoryParams = { params: Promise.resolve({ category: 'requested-category' }) }

describe('nested catalogue metadata', () => {
  beforeEach(() => {
    Object.assign(state.record!, { name: 'Original category', active: true, showInOneDayTours: true, isPublished: true })
  })

  it('uses the published region source and its nested canonical path', async () => {
    const result = await regionMetadata(regionParams)
    expect(getPublishedOneDayDestinations).toHaveBeenCalledOnce()
    expect(attachCatalogueTranslations).toHaveBeenCalledWith('destination', [state.record])
    expect(result.alternates?.canonical).toEqual(expect.stringMatching(/\/egypt-tours\/one-day-tours\/canonical$/))
    expect(result.alternates?.languages).toEqual({ en: result.alternates?.canonical, 'x-default': result.alternates?.canonical })
  })

  it.each(['es', 'it'])('reuses stored %s category name/copy and canonical record slug', async (locale) => {
    state.cookie = locale
    state.translations = { [locale]: { name: 'Translated category', copy: 'Translated category copy' } }
    const result = await categoryMetadata(categoryParams)
    expect(findCategoryBySlug).toHaveBeenCalledWith('requested-category')
    expect(attachCatalogueTranslations).toHaveBeenCalledWith('category', [state.record])
    expect(result.title).toEqual({ absolute: 'Translated category | STAR PYRAMIDS' })
    expect(result.description).toBe('Translated category copy')
    expect(result.alternates?.canonical).toEqual(expect.stringMatching(/\/egypt-tours\/multi-days-tours\/canonical$/))
    expect(result.alternates?.languages).toEqual({ en: result.alternates?.canonical, 'x-default': result.alternates?.canonical })
    expect(result.openGraph).toMatchObject({ images: [{ url: '/record.jpg' }], locale: locale === 'es' ? 'es_ES' : 'it_IT' })
    expect(result.twitter).toMatchObject({ images: ['/record.jpg'], description: result.description })
  })

  it('uses the translated category name alone when translated copy is blank', async () => {
    state.cookie = 'es'
    state.translations = { es: { name: 'Translated category', copy: '  ' } }
    expect((await categoryMetadata(categoryParams)).description).toBe('Translated category')
  })

  it('falls back to English category values when the translated name is missing', async () => {
    state.cookie = 'it'
    state.translations = { it: { copy: 'Orphan copy' } }
    const result = await categoryMetadata(categoryParams)
    expect(result.title).toEqual({ absolute: 'Original category | STAR PYRAMIDS' })
    expect(result.description).toBe('Original copy')
    expect(result.openGraph).toMatchObject({ locale: 'en_US' })
  })

  it('localizes region metadata from existing destination translations', async () => {
    state.cookie = 'es'
    state.translations = { es: { title: 'Translated region', copy: 'Translated region copy' } }
    const result = await regionMetadata(regionParams)
    expect(result.title).toEqual({ absolute: 'Translated region | STAR PYRAMIDS' })
    expect(result.description).toBe('Translated region copy')
  })

  it.each([{ isPublished: false }, { showInOneDayTours: false }])('rejects unavailable regions: %j', async (flags) => {
    Object.assign(state.record!, flags)
    expect((await regionMetadata(regionParams)).robots).toEqual({ index: false, follow: false })
    await expect(RegionPage(regionParams)).rejects.toThrow()
    expect(attachCatalogueTranslations).not.toHaveBeenCalled()
  })

  it('rejects inactive categories', async () => {
    state.record!.active = false
    expect((await categoryMetadata(categoryParams)).robots).toEqual({ index: false, follow: false })
    await expect(CategoryPage(categoryParams)).rejects.toThrow()
    expect(attachCatalogueTranslations).not.toHaveBeenCalled()
  })

  it('rejects missing regions and categories', async () => {
    state.record = null
    expect((await regionMetadata(regionParams)).robots).toEqual({ index: false, follow: false })
    expect((await categoryMetadata(categoryParams)).robots).toEqual({ index: false, follow: false })
    await expect(RegionPage(regionParams)).rejects.toThrow()
    await expect(CategoryPage(categoryParams)).rejects.toThrow()
  })
})
