import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const entity = () => ({ findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() })
  return { tour: entity(), blog: entity(), destination: entity(), event: entity(), offer: entity(), multiDayCategory: entity(), catalogueTranslation: { ...entity(), create: vi.fn() }, $queryRaw: vi.fn(), $executeRaw: vi.fn(), $transaction: vi.fn() }
})
vi.mock('@/lib/server/db', () => ({ db: mocks }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => ({ id: 'staff' }), hasPermission: () => true }))
vi.mock('@/lib/blog-editorial', () => ({ BlogEditorialInputError: class extends Error {}, validateBlogEditorial: (value: unknown) => value }))
import { emptyRecordSeoContent, initialRecordSeoState, isRecordSeoKind, preserveRecordSeo, recordSeoStateFromPayload, remapRecordSeoCanonical, stripRecordSeo, transitionRecordSeo, validateRecordSeoState, type RecordSeoKind } from '@/lib/record-seo'
import { changeRecordSeo, getPublishedRecordSeo, listRecordSeo, readRecordSeo, RecordSeoNotEligibleError, RecordSeoNotFoundError } from '@/lib/server/record-seo'
import { HeroConflictError } from '@/lib/server/website-heroes'
import { attachCatalogueTranslations, catalogueTranslationResponse, saveWithCatalogueTranslations } from '@/lib/server/catalogue-translations'
import { decodeTourJson } from '@/lib/tour-json'
import { PUT as updateTour } from '@/app/api/tours/[slug]/route'
import { PUT as updateBlog } from '@/app/api/blogs/[slug]/route'
import { PUT as updateDestination } from '@/app/api/destinations/[slug]/route'
import { PUT as updateEvent } from '@/app/api/events/[slug]/route'
import { PUT as updateOffer } from '@/app/api/offers/[slug]/route'

const timestamp = new Date('2026-01-01T00:00:00.000Z')
const seo = () => ({ ...emptyRecordSeoContent(), text: { en: { title: 'Egypt', description: 'Explore Egypt' }, es: { title: 'Egipto', description: 'Explore Egipto' }, it: { title: 'Egitto', description: 'Explore Egitto' } }, structuredData: false })
const saved = () => transitionRecordSeo(initialRecordSeoState(), 'save-draft', seo())
const published = () => transitionRecordSeo(saved(), 'publish')
const row = (extra: Record<string, unknown> = {}) => ({ slug: 'egypt', title: 'Egypt', name: 'Egypt', summary: 'Summary', copy: 'Copy', image: '/egypt.png', updatedAt: timestamp, status: 'published', isPublished: true, active: true, showInDestinations: true, tourSlug: null, content: '{}', detail: '{}', ...extra })
const kinds: RecordSeoKind[] = ['tour', 'blog', 'destination', 'event', 'offer', 'category']
const model = (kind: RecordSeoKind) => mocks[kind === 'category' ? 'multiDayCategory' : kind]
const prefixes: Record<RecordSeoKind, string> = { tour: '/egypt-tours/', blog: '/blogs/', destination: '/destinations/', event: '/events/', offer: '/special-offers/', category: '/egypt-tours/multi-days-tours/' }

beforeEach(() => {
  vi.resetAllMocks()
  for (const kind of kinds) {
    model(kind).findUnique.mockResolvedValue(row())
    model(kind).findMany.mockResolvedValue([])
    model(kind).updateMany.mockResolvedValue({ count: 1 })
    model(kind).update.mockImplementation(async args => row(args.data))
  }
  mocks.catalogueTranslation.findUnique.mockResolvedValue(null)
  mocks.catalogueTranslation.findMany.mockResolvedValue([])
  mocks.catalogueTranslation.updateMany.mockResolvedValue({ count: 1 })
  mocks.catalogueTranslation.create.mockResolvedValue({})
  mocks.$queryRaw.mockResolvedValue([])
  mocks.$executeRaw.mockResolvedValue(1)
  mocks.$transaction.mockImplementation(async (fn: (tx: typeof mocks) => unknown) => fn(mocks))
})

describe('record SEO lifecycle and original JSON boundaries', () => {
  it.each(kinds)('remaps only exact %s self-canonicals on an actual slug rename', kind => {
    const canonical = prefixes[kind] + 'egypt'
    const state = { ...published(), draft: { ...seo(), canonical }, published: { ...seo(), canonical }, future: { preserve: true } }
    const next = remapRecordSeoCanonical(state, { kind, oldSlug: 'egypt', newSlug: 'renamed' })
    expect(next).toMatchObject({ draft: { canonical: prefixes[kind] + 'renamed' }, published: { canonical: prefixes[kind] + 'renamed' }, revision: state.revision + 1, future: state.future })
    expect(next.updatedAt).not.toBeNull()
    expect(state.draft.canonical).toBe(canonical)
    const crossPage = { ...state, draft: { ...seo(), canonical: '/about' }, published: { ...seo(), canonical: prefixes[kind] + 'egypt-other' } }
    expect(remapRecordSeoCanonical(crossPage, { kind, oldSlug: 'egypt', newSlug: 'renamed' })).toBe(crossPage)
    expect(remapRecordSeoCanonical(state, { kind, oldSlug: 'egypt', newSlug: 'egypt' })).toBe(state)
  })
  it('remaps destination detail and region snapshots independently with one revision increment', () => {
    const state = { ...published(), updatedAt: '2020-01-01T00:00:00.000Z', draft: { ...seo(), canonical: '/destinations/egypt' }, published: { ...seo(), canonical: '/egypt-tours/one-day-tours/egypt' } }
    const next = remapRecordSeoCanonical(state, { kind: 'destination', oldSlug: 'egypt', newSlug: 'renamed' })
    expect(next.draft?.canonical).toBe('/destinations/renamed')
    expect(next.published?.canonical).toBe('/egypt-tours/one-day-tours/renamed')
    expect(next.revision).toBe(state.revision + 1)
    expect(Date.parse(next.updatedAt!)).toBeGreaterThan(Date.parse(state.updatedAt))
    const mixed = { ...state, published: { ...seo(), canonical: '/about' } }
    expect(remapRecordSeoCanonical(mixed, { kind: 'destination', oldSlug: 'egypt', newSlug: 'renamed' }).published).toBe(mixed.published)
  })
  it('does not create an override on rename and rejects revision overflow', () => {
    expect(JSON.parse(preserveRecordSeo({ business: true }, undefined, false, { kind: 'blog', oldSlug: 'egypt', newSlug: 'renamed' })!)).toEqual({ business: true })
    const state = { ...published(), revision: Number.MAX_SAFE_INTEGER, published: { ...seo(), canonical: '/blogs/egypt' } }
    expect(() => remapRecordSeoCanonical(state, { kind: 'blog', oldSlug: 'egypt', newSlug: 'renamed' })).toThrow('revision limit')
  })
  it('excludes cars and starts without a publication', () => {
    expect(kinds.every(isRecordSeoKind)).toBe(true)
    expect(isRecordSeoKind('car')).toBe(false)
    expect(initialRecordSeoState()).toEqual({ version: 1, revision: 0, draft: null, published: null, updatedAt: null })
    expect(() => transitionRecordSeo(initialRecordSeoState(), 'publish')).toThrow('Save an SEO draft')
  })
  it('keeps drafts private and restores only the override', () => {
    const state = published()
    const next = transitionRecordSeo(state, 'save-draft', { ...seo(), image: 'https://images.example.com/new.png' })
    expect(next.published).toEqual(state.published)
    expect(next.draft?.image).toBe('https://images.example.com/new.png')
    expect(state.published?.structuredData).toBe(false)
    expect(transitionRecordSeo(next, 'restore')).toMatchObject({ revision: 4, draft: null, published: null })
  })
  it.each([undefined, {}, { ...initialRecordSeoState(), version: 2 }, { ...initialRecordSeoState(), revision: -1 }, { ...initialRecordSeoState(), updatedAt: 'invalid' }, { ...initialRecordSeoState(), draft: { ...seo(), structuredData: 'no' } }])('fails closed for invalid state %j', value => {
    expect(() => validateRecordSeoState(value)).toThrow()
  })
  it('preserves unknown stored envelope fields and unrelated original SEO fields', () => {
    const state = { ...saved(), future: { ownedElsewhere: true } }
    expect(transitionRecordSeo(state, 'publish')).toHaveProperty('future', state.future)
    const original = { seo: { legacy: true }, seoManager: state, business: 'original' }
    const next = JSON.parse(preserveRecordSeo(original, { ...original, business: 'edited', seoManager: { injected: true } })!)
    expect(next).toEqual({ ...original, business: 'edited' })
  })
  it('never injects client SEO into a new or unmanaged record', () => {
    expect(JSON.parse(preserveRecordSeo({}, { content: 'business', seoManager: published() })!)).toEqual({ content: 'business' })
  })
  it('preserves absent tour detail semantics through the real decoder', () => {
    expect(preserveRecordSeo(null, undefined, true)).toBeNull()
    expect(decodeTourJson({ detail: JSON.stringify({ seoManager: published() }) }).detail).toBeNull()
    expect(decodeTourJson({ detail: JSON.stringify({ seoManager: published(), intro: 'Business' }) }).detail).toEqual({ intro: 'Business' })
    expect(stripRecordSeo({ intro: 'Business', seoManager: saved() })).toEqual({ intro: 'Business' })
  })
  it.each(['broken', '[]', 'null'])('never resets malformed original JSON %s', value => {
    expect(() => preserveRecordSeo(value, {})).toThrow()
    expect(() => recordSeoStateFromPayload(value)).toThrow()
  })
})

describe('record SEO persistence with mocked database only', () => {
  it.each(kinds)('reads %s initial state without writing', async kind => {
    expect((await readRecordSeo(kind, 'egypt')).state).toEqual(initialRecordSeoState())
    expect(model(kind).updateMany).not.toHaveBeenCalled()
    expect(mocks.catalogueTranslation.create).not.toHaveBeenCalled()
  })
  it.each(kinds.filter(kind => kind !== 'category'))('CAS saves %s only in its original JSON field', async kind => {
    const field = kind === 'tour' || kind === 'destination' ? 'detail' : 'content'
    const original = JSON.stringify({ business: { nested: ['unchanged'] }, seo: { legacy: true } })
    model(kind).findUnique.mockResolvedValue(row({ [field]: original }))
    const result = await changeRecordSeo(kind, 'egypt', 'save-draft', 0, seo())
    const args = model(kind).updateMany.mock.calls[0][0]
    expect(args.where).toEqual({ slug: 'egypt', [field]: original, updatedAt: timestamp })
    expect(Object.keys(args.data)).toEqual([field])
    expect(JSON.parse(args.data[field])).toEqual({ business: { nested: ['unchanged'] }, seo: { legacy: true }, seoManager: result.state })
  })
  it('creates a nullable tour SEO payload without manufacturing public detail', async () => {
    mocks.tour.findUnique.mockResolvedValue(row({ detail: null }))
    await changeRecordSeo('tour', 'egypt', 'save-draft', 0, seo())
    const args = mocks.tour.updateMany.mock.calls[0][0]
    expect(args.where.detail).toBeNull()
    expect(decodeTourJson({ detail: args.data.detail }).detail).toBeNull()
  })
  it('rejects stale revisions and concurrent business changes', async () => {
    mocks.blog.findUnique.mockResolvedValue(row({ content: JSON.stringify({ seoManager: saved() }) }))
    await expect(changeRecordSeo('blog', 'egypt', 'publish', 0)).rejects.toBeInstanceOf(HeroConflictError)
    expect(mocks.blog.updateMany).not.toHaveBeenCalled()
    mocks.blog.updateMany.mockResolvedValue({ count: 0 })
    await expect(changeRecordSeo('blog', 'egypt', 'publish', 1)).rejects.toBeInstanceOf(HeroConflictError)
  })
  it('fails closed for malformed stored JSON or reserved state before any write', async () => {
    for (const content of ['bad', JSON.stringify({ seoManager: {} })]) {
      mocks.blog.findUnique.mockResolvedValue(row({ content }))
      await expect(changeRecordSeo('blog', 'egypt', 'restore', 0)).rejects.toThrow()
    }
    expect(mocks.blog.updateMany).not.toHaveBeenCalled()
  })
  it('returns typed 404 errors for missing records and linked offers', async () => {
    mocks.blog.findUnique.mockResolvedValue(null)
    await expect(readRecordSeo('blog', 'absent')).rejects.toMatchObject({ status: 404 })
    await expect(readRecordSeo('blog', 'absent')).rejects.toBeInstanceOf(RecordSeoNotFoundError)
    mocks.offer.findUnique.mockResolvedValue(row({ tourSlug: 'tour' }))
    await expect(changeRecordSeo('offer', 'egypt', 'restore', 0)).rejects.toBeInstanceOf(RecordSeoNotEligibleError)
    expect(mocks.offer.updateMany).not.toHaveBeenCalled()
  })
  it('publishes SEO for hidden records without publishing business content', async () => {
    mocks.blog.findUnique.mockResolvedValue(row({ isPublished: false, content: JSON.stringify({ seoManager: saved() }) }))
    expect((await changeRecordSeo('blog', 'egypt', 'publish', 1)).state.published).toEqual(seo())
    expect(await getPublishedRecordSeo('blog', 'egypt')).toBeNull()
  })
  it('exposes only the published snapshot, honoring original destination/category availability', async () => {
    mocks.destination.findUnique.mockResolvedValue(row({ showInDestinations: false, detail: JSON.stringify({ seoManager: published() }) }))
    expect(await getPublishedRecordSeo('destination', 'egypt')).toEqual(seo())
    mocks.catalogueTranslation.findUnique.mockResolvedValue({ payload: JSON.stringify({ seoManager: published() }) })
    mocks.multiDayCategory.findUnique.mockResolvedValue(row({ active: false }))
    expect(await getPublishedRecordSeo('category', 'egypt')).toBeNull()
    mocks.blog.findUnique.mockResolvedValue(row({ content: JSON.stringify({ seoManager: saved() }) }))
    expect(await getPublishedRecordSeo('blog', 'egypt')).toBeNull()
  })
  it('lists nested descriptors including hidden records, excluding linked offers and cars', async () => {
    mocks.destination.findMany.mockResolvedValue([row({ isPublished: false, showInOneDayTours: true })])
    mocks.offer.findMany.mockResolvedValue([row({ tourSlug: 'tour' }), row({ slug: 'campaign' })])
    const result = await listRecordSeo()
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ record: { kind: 'destination', published: false, description: 'Summary', image: '/egypt.png', updatedAt: timestamp.toISOString() }, state: initialRecordSeoState() })
    expect(result[0].record.canonicalPaths).toContain('/egypt-tours/one-day-tours/egypt')
    expect(result[1].record.slug).toBe('campaign')
  })
  it('CAS updates category payload preserving all translations', async () => {
    const payload = JSON.stringify({ es: { name: 'Egipto' }, it: { copy: 'Testo' }, seoManager: saved() })
    mocks.catalogueTranslation.findUnique.mockResolvedValue({ payload })
    await changeRecordSeo('category', 'egypt', 'publish', 1)
    const args = mocks.catalogueTranslation.updateMany.mock.calls[0][0]
    expect(args.where).toEqual({ entityType: 'category', slug: 'egypt', payload })
    expect(JSON.parse(args.data.payload)).toMatchObject({ es: { name: 'Egipto' }, it: { copy: 'Testo' }, seoManager: { revision: 2 } })
    expect(mocks.multiDayCategory.updateMany).not.toHaveBeenCalled()
  })
  it('turns category first-insert races into conflicts', async () => {
    mocks.catalogueTranslation.create.mockRejectedValue({ code: 'P2002' })
    await expect(changeRecordSeo('category', 'egypt', 'save-draft', 0, seo())).rejects.toBeInstanceOf(HeroConflictError)
  })
})

describe('original category editor and API read preservation', () => {
  it.each([
    ['tour', updateTour, 'detail'], ['blog', updateBlog, 'content'],
    ['destination', updateDestination, 'detail'], ['event', updateEvent, 'content'], ['offer', updateOffer, 'content'],
  ] as const)('the actual %s PUT atomically renames its self-canonical with the business slug', async (kind, update, field) => {
    const state = { ...published(), draft: { ...seo(), canonical: prefixes[kind] + 'egypt' }, published: { ...seo(), canonical: prefixes[kind] + 'egypt' } }
    const raw = JSON.stringify({ editorial: {}, original: true, seoManager: state })
    model(kind).findUnique.mockResolvedValueOnce(row({ [field]: raw })).mockResolvedValueOnce(null)
    const request = new Request(`http://localhost:3000/api/${kind}/egypt`, {
      method: 'PUT', headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ slug: 'renamed' }),
    })
    expect((await update(request, { params: Promise.resolve({ slug: 'egypt' }) })).status).toBe(200)
    const args = model(kind).update.mock.calls[0][0]
    expect(args.where).toEqual({ slug: 'egypt', [field]: raw, updatedAt: timestamp })
    expect(args.data.slug).toBe('renamed')
    expect(JSON.parse(args.data[field])).toMatchObject({ original: true, seoManager: { draft: { canonical: prefixes[kind] + 'renamed' }, published: { canonical: prefixes[kind] + 'renamed' }, revision: state.revision + 1 } })
  })
  it.each([
    ['tour', updateTour, 'detail'], ['blog', updateBlog, 'content'],
    ['destination', updateDestination, 'detail'], ['event', updateEvent, 'content'], ['offer', updateOffer, 'content'],
  ] as const)('the actual %s PUT preserves DB SEO and guards against concurrent saves', async (kind, update, field) => {
    const state = published()
    const raw = JSON.stringify({ editorial: {}, original: true, seoManager: state })
    model(kind).findUnique.mockResolvedValue(row({ [field]: raw }))
    const request = new Request(`http://localhost:3000/api/${kind}/egypt`, {
      method: 'PUT', headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ [field]: { editorial: {}, edited: true, seoManager: { injected: true } } }),
    })
    const response = await update(request, { params: Promise.resolve({ slug: 'egypt' }) })
    expect(response.status).toBe(200)
    const args = model(kind).update.mock.calls[0][0]
    expect(args.where).toEqual({ slug: 'egypt', [field]: raw, updatedAt: timestamp })
    expect(JSON.parse(args.data[field]).seoManager).toEqual(state)
    expect(JSON.stringify(await response.json())).not.toContain('seoManager')
  })
  it('updates translations while preserving DB SEO across a slug rename', async () => {
    const state = { ...published(), published: { ...seo(), canonical: '/egypt-tours/multi-days-tours/egypt' } }
    const payload = JSON.stringify({ es: { name: 'Old' }, seoManager: state })
    mocks.$queryRaw.mockResolvedValueOnce([{ slug: 'egypt' }]).mockResolvedValueOnce([{ payload }])
    const mutate = vi.fn().mockResolvedValue({ slug: 'renamed' })
    await saveWithCatalogueTranslations('category', { it: { name: 'New' } }, 'egypt', mutate)
    const call = mocks.$executeRaw.mock.calls.at(-1)!
    expect(call[0].join(' ')).toContain('BINARY payload = BINARY')
    expect(JSON.parse(call[1])).toMatchObject({ it: { name: 'New' }, seoManager: { ...state, updatedAt: expect.any(String), revision: state.revision + 1, published: { ...state.published, canonical: '/egypt-tours/multi-days-tours/renamed' } } })
    expect(call).toContain(payload)
    expect(call).toContain('renamed')
  })
  it('remaps category SEO when the business rename omits translations, preserving the payload', async () => {
    const state = { ...published(), draft: { ...seo(), canonical: '/about' }, published: { ...seo(), canonical: '/egypt-tours/multi-days-tours/egypt' } }
    const payload = JSON.stringify({ es: { name: 'Egipto' }, it: { copy: 'Testo' }, seoManager: state })
    mocks.$queryRaw.mockResolvedValueOnce([{ slug: 'egypt' }]).mockResolvedValueOnce([{ payload }])
    await saveWithCatalogueTranslations('category', undefined, 'egypt', async () => ({ slug: 'renamed' }))
    expect(mocks.$transaction).toHaveBeenCalledOnce()
    const call = mocks.$executeRaw.mock.calls.at(-1)!
    expect(call[0].join(' ')).toContain('BINARY payload = BINARY')
    expect(call).toContain(payload)
    expect(JSON.parse(call[1])).toMatchObject({ es: { name: 'Egipto' }, it: { copy: 'Testo' }, seoManager: { revision: state.revision + 1, draft: state.draft, published: { canonical: '/egypt-tours/multi-days-tours/renamed' } } })
  })
  it('rejects category payload races and client reserved-key injection', async () => {
    mocks.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ payload: '{}' }])
    mocks.$executeRaw.mockResolvedValue(0)
    await expect(saveWithCatalogueTranslations('category', { es: { name: 'Updated' } }, 'egypt', async () => ({ slug: 'egypt' }))).rejects.toBeInstanceOf(HeroConflictError)
    await expect(saveWithCatalogueTranslations('category', { seoManager: published() }, 'egypt', async () => ({ slug: 'egypt' }))).rejects.toThrow('Invalid translation language')
  })
  it('strips reserved SEO before translation validation', async () => {
    mocks.$queryRaw.mockResolvedValue([{ slug: 'egypt', payload: JSON.stringify({ es: { name: 'Egipto' }, seoManager: published() }) }])
    expect(await attachCatalogueTranslations('category', [{ slug: 'egypt' }])).toEqual([{ slug: 'egypt', translations: { es: { name: 'Egipto' } } }])
  })
  it('does not misreport unchanged translations as a CAS failure', async () => {
    const payload = JSON.stringify({ es: { name: 'Egypt' }, seoManager: published() })
    mocks.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ payload }])
    await saveWithCatalogueTranslations('category', { es: { name: 'Egypt' } }, 'egypt', async () => ({ slug: 'egypt' }))
    expect(mocks.$executeRaw).not.toHaveBeenCalled()
  })
  it.each(['blog', 'event', 'offer', 'destination'] as const)('never leaks reserved drafts from raw %s API responses', async kind => {
    const key = kind === 'destination' ? 'detail' : 'content'
    for (const encoded of [false, true]) {
      const value = { business: true, seoManager: saved() }
      const response = await catalogueTranslationResponse(kind, { item: { slug: 'egypt', [key]: encoded ? JSON.stringify(value) : value } })
      expect(JSON.stringify(response)).not.toContain('seoManager')
      expect(JSON.stringify(response)).toContain('business')
    }
  })
})
