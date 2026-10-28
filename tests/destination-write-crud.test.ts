import { beforeEach, describe, expect, it, vi } from 'vitest'
import { stripRecordSeo, initialRecordSeoState } from '@/lib/record-seo'
import { destinationEditorRecord, validateDestinationWrite } from '@/lib/destination-write'

type Row = { slug: string; updatedAt: Date; detail: string; [key: string]: unknown }
type Tour = { slug: string; destinationSlug: string | null; category: string; status: string; updatedAt: Date }
const m = vi.hoisted(() => ({
  destinations: new Map<string, Row>(), tours: new Map<string, Tour>(), translations: new Map<string, string>(),
  user: true, permissions: new Set<string>(), origin: true, fail: '', sequence: 0,
  destinationWrite: vi.fn(), tourWrite: vi.fn(),
}))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => m.user ? { id: 'staff' } : null, hasPermission: (_user: unknown, key: string) => m.permissions.has(key) }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => m.origin }))
vi.mock('@/lib/server/db', () => {
  const conflict = (code = 'P2025') => Object.assign(new Error('PRIVATE SQL DIAGNOSTIC'), { code })
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => value instanceof Date ? (row[key] as Date)?.getTime() === value.getTime() : row[key] === value)
  const db = {
    destination: {
      findUnique: async ({ where }: { where: { slug: string } }) => structuredClone(m.destinations.get(where.slug) ?? null),
      findMany: async ({ where = {} }: { where?: Record<string, unknown> }) => structuredClone([...m.destinations.values()].filter(row => matches(row, where))),
      create: async ({ data }: { data: Record<string, unknown> & { slug: string } }) => {
        if (m.fail) throw conflict(m.fail)
        if (m.destinations.has(data.slug)) throw conflict('P2002')
        const row: Row = { ...data, slug: data.slug, detail: String(data.detail), updatedAt: new Date(1800000000000 + ++m.sequence) }
        m.destinationWrite(data); m.destinations.set(row.slug, row); return structuredClone(row)
      },
      update: async ({ where, data }: { where: { slug: string; detail: string; updatedAt: Date }; data: Record<string, unknown> & { slug: string } }) => {
        if (m.fail) throw conflict(m.fail)
        const old = m.destinations.get(where.slug)
        if (!old || !matches(old, where)) throw conflict()
        const row = { ...old, ...data, updatedAt: new Date(1800000000000 + ++m.sequence) }
        m.destinationWrite(data); m.destinations.delete(where.slug); m.destinations.set(row.slug, row); return structuredClone(row)
      },
      delete: async ({ where }: { where: { slug: string; detail: string; updatedAt: Date } }) => {
        const row = m.destinations.get(where.slug)
        if (!row || !matches(row, where)) throw conflict()
        m.destinations.delete(where.slug); return row
      },
    },
    tour: {
      findUnique: async ({ where }: { where: { slug: string } }) => structuredClone(m.tours.get(where.slug) ?? null),
      findMany: async ({ where }: { where: Record<string, unknown> }) => structuredClone([...m.tours.values()].filter(row => matches(row, where))),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: { destinationSlug: string | null } }) => {
        const row = [...m.tours.values()].find(row => matches(row, where))
        if (!row) return { count: 0 }
        m.tourWrite(data); Object.assign(row, data, { updatedAt: new Date(1800000000000 + ++m.sequence) }); return { count: 1 }
      },
    },
    $queryRaw: async (query: TemplateStringsArray | { values?: unknown[] }) => Array.isArray(query) ? [] : [...m.translations].map(([slug, payload]) => ({ slug, payload })),
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(' ')
      if (sql.startsWith('INSERT')) m.translations.set(String(values[1]), String(values[2]))
      if (sql.startsWith('UPDATE')) {
        const [nextSlug, , previousSlug] = values
        const value = m.translations.get(String(previousSlug))
        if (value) { m.translations.delete(String(previousSlug)); m.translations.set(String(nextSlug), value) }
      }
      if (sql.startsWith('DELETE')) m.translations.delete(String(values[1]))
      return 1
    },
  }
  return { db: { ...db, $transaction: async (mutate: (tx: typeof db) => Promise<unknown>) => {
    const before = structuredClone([m.destinations, m.tours, m.translations])
    try { return await mutate(db) }
    catch (error) {
      for (const [index, map] of [m.destinations, m.tours, m.translations].entries()) {
        map.clear()
        for (const [key, value] of before[index]) (map as Map<string, unknown>).set(key, value)
      }
      throw error
    }
  } } }
})

import { POST, GET as list } from '@/app/api/destinations/route'
import { PUT, DELETE, GET as detail } from '@/app/api/destinations/[slug]/route'
const context = (slug = 'cairo') => ({ params: Promise.resolve({ slug }) })
const request = (method: string, body?: unknown, query = '') => new Request('http://localhost/api/destinations/cairo' + query, { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
const seed = () => {
  const row: Row = { slug: 'cairo', title: 'Cairo', image: '/cairo.jpg', copy: 'City', nameAr: 'Old name', copyAr: 'Old copy', showInDestinations: false, showInOneDayTours: true, isPublished: true, displayOrder: 1, detail: JSON.stringify({ intro: 'Details', facts: [], bestFor: [], experiences: [], rhythm: [], practical: [], tourSlugs: [], seoManager: initialRecordSeoState() }), updatedAt: new Date('2026-10-28T00:00:00.000Z') }
  m.destinations.set(row.slug, row)
  m.translations.set(row.slug, JSON.stringify({ es: { title: 'El Cairo' } }))
  return row
}
const tour = (slug = 'tour-one', destinationSlug: string | null = 'cairo', status = 'published') => {
  const row: Tour = { slug, destinationSlug, status, category: 'one-day-tours', updatedAt: new Date('2026-10-28T00:00:00.000Z') }
  m.tours.set(slug, row); return row
}
beforeEach(() => {
  m.destinations.clear(); m.tours.clear(); m.translations.clear(); vi.clearAllMocks()
  m.user = true; m.origin = true; m.fail = ''; m.sequence = 0
  m.permissions = new Set(['destinations.create', 'destinations.edit', 'destinations.view', 'destinations.delete', 'tours.edit'])
})

describe('Destination CRUD validation and security', () => {
  it('creates and reopens a configured destination with translations and explicit false flags', async () => {
    const response = await POST(request('POST', { slug: 'siwa', title: 'Siwa', image: '/siwa.jpg', isPublished: false, showInDestinations: false, showInOneDayTours: false, translations: { it: { title: 'Oasi di Siwa' } }, detail: { intro: 'Oasis' } }))
    expect(response.status).toBe(201)
    const reopened = await detail(request('GET', undefined, '?admin=1'), context('siwa'))
    const row = (await reopened.json()).destination
    expect(row).toMatchObject({ title: 'Siwa', image: '/siwa.jpg', isPublished: false, showInDestinations: false, translations: { it: { title: 'Oasi di Siwa' } } })
    expect(destinationEditorRecord(row)).toMatchObject({ updatedAt: expect.any(String), detail: { intro: 'Oasis' } })
    expect((await detail(request('GET'), context('siwa'))).status).toBe(404)
  })
  it('treats explicit empty description and facts as authoritative during create/edit', async () => {
    const response = await POST(request('POST', { slug: 'siwa', title: 'Siwa', copy: '', detail: { facts: [] } }))
    expect(response.status).toBe(201)
    expect(m.destinations.get('siwa')?.copy).toBe('')
    const record = destinationEditorRecord((await response.json()).destination)
    expect(record.detail.facts).toEqual([])
    expect((await PUT(request('PUT', { copy: '', detail: { ...record.detail, facts: [] } }), context('siwa'))).status).toBe(200)
    expect(JSON.parse(m.destinations.get('siwa')!.detail).facts).toEqual([])
    expect(m.destinations.get('siwa')?.copy).toBe('')
  })
  it.each([null, [], 'bad', { slug: '--bad', title: 'X' }, { slug: 'cairo', title: '' }, { slug: 'cairo', title: 'X', image: 'javascript:alert(1)' }, { slug: 'cairo', title: 'X', isPublished: 'false' }, { slug: 'cairo', title: 'X', showInDestinations: 0 }, { slug: 'cairo', title: 'X', displayOrder: 1.5 }, { slug: 'cairo', title: 'X', userId: 'forged' }])('rejects malformed create/update data %j without writes', async value => {
    seed()
    expect((await POST(request('POST', value))).status).toBe(400)
    expect((await PUT(request('PUT', value), context())).status).toBe(400)
    expect(m.destinationWrite).not.toHaveBeenCalled()
  })
  it('rejects malformed JSON with a safe response', async () => {
    expect((await POST(new Request('http://localhost/api/destinations', { method: 'POST', body: '{broken' }))).status).toBe(400)
  })
  it('requires login, operation permission, and same-origin protection', async () => {
    seed()
    m.user = false
    for (const result of [await POST(request('POST', {})), await PUT(request('PUT', {}), context()), await DELETE(request('DELETE'), context())]) expect(result.status).toBe(401)
    m.user = true; m.permissions.clear()
    for (const result of [await POST(request('POST', {})), await PUT(request('PUT', {}), context()), await DELETE(request('DELETE'), context())]) expect(result.status).toBe(403)
    m.permissions.add('destinations.edit'); m.origin = false
    expect((await PUT(request('PUT', {}), context())).status).toBe(403)
    expect(m.destinationWrite).not.toHaveBeenCalled()
  })
  it('supports false-to-true toggles and explicit optional clears without losing reserved SEO', async () => {
    seed()
    const response = await PUT(request('PUT', { nameAr: null, copyAr: '', image: null, copy: '', showInDestinations: true, showInOneDayTours: false, isPublished: false, displayOrder: null, detail: null }), context())
    expect(response.status).toBe(200)
    const stored = m.destinations.get('cairo')!
    expect(stored).toMatchObject({ nameAr: null, copyAr: null, image: '', copy: '', showInDestinations: true, showInOneDayTours: false, isPublished: false, displayOrder: 999 })
    expect(JSON.parse(stored.detail)).toEqual({ seoManager: initialRecordSeoState() })
    expect(JSON.stringify(await response.json())).not.toContain('seoManager')
    expect(m.translations.get('cairo')).toContain('El Cairo')
  })
  it('saves and reopens EN/ES/IT deep detail translations using the agreed editor paths', async () => {
    seed()
    const fields = ['detail.heroAlt', 'detail.eyebrow', 'detail.intro', 'detail.facts.0.label', 'detail.facts.0.value', 'detail.experiences.0.title', 'detail.experiences.0.copy', 'detail.experiences.0.alt', 'detail.rhythm.0.label', 'detail.rhythm.0.title', 'detail.rhythm.0.copy', 'detail.practical.0.title', 'detail.practical.0.copy', 'title', 'copy', 'stay', 'bestFor']
    const translations = { es: Object.fromEntries(fields.map(field => [field, `ES ${field}`])), it: Object.fromEntries(fields.map(field => [field, `IT ${field}`])) }
    expect((await PUT(request('PUT', { translations }), context())).status).toBe(200)
    const reopened = (await (await detail(request('GET', undefined, '?admin=1'), context())).json()).destination
    expect(reopened.translations).toEqual(translations)
    expect(destinationEditorRecord(reopened).title).toBe('Cairo')
    expect(m.tourWrite).not.toHaveBeenCalled()
  })
  it('rejects an old editor revision and atomic database races as conflicts', async () => {
    seed()
    expect((await PUT(request('PUT', { title: 'Stale', expectedUpdatedAt: '2020-01-01T00:00:00.000Z' }), context())).status).toBe(409)
    expect(m.destinationWrite).not.toHaveBeenCalled()
    m.fail = 'P2025'
    expect((await PUT(request('PUT', { title: 'Race' }), context())).status).toBe(409)
    m.fail = 'P2002'
    expect((await POST(request('POST', { slug: 'siwa', title: 'Siwa' }))).status).toBe(409)
  })
  it('preserves excluded published destinations and all existing tours on visibility-only saves', async () => {
    seed(); tour()
    expect((await PUT(request('PUT', { copy: 'Updated', showInDestinations: false }), context())).status).toBe(200)
    expect(m.destinations.get('cairo')).toMatchObject({ isPublished: true, showInDestinations: false })
    expect(m.tours.get('tour-one')?.destinationSlug).toBe('cairo')
    expect(m.tourWrite).not.toHaveBeenCalled()
    expect((await (await list(request('GET'))).json()).destinations).toHaveLength(1)
  })
})

describe('Atomic Destination tour associations and lifecycle', () => {
  it('saves explicit tour additions together with the destination and translations', async () => {
    seed(); tour('tour-one', 'giza')
    const response = await PUT(request('PUT', { title: 'Updated Cairo', translations: { it: { title: 'Il Cairo' } }, tourChanges: [{ slug: 'tour-one', expectedDestinationSlug: 'giza', linked: true }] }), context())
    expect(response.status).toBe(200)
    expect(m.tours.get('tour-one')?.destinationSlug).toBe('cairo')
    expect(m.translations.get('cairo')).toContain('Il Cairo')
  })
  it('requires tours.edit for association changes', async () => {
    seed(); tour('tour-one', null, 'draft'); m.permissions.delete('tours.edit')
    expect((await PUT(request('PUT', { tourChanges: [{ slug: 'tour-one', expectedDestinationSlug: null, linked: true }] }), context())).status).toBe(403)
    expect(m.destinationWrite).not.toHaveBeenCalled()
  })
  it('rolls back destination, translations, and earlier links when a later association is stale', async () => {
    const before = structuredClone(seed()); tour('a-tour', null, 'draft'); tour('z-tour', 'giza')
    const response = await PUT(request('PUT', { title: 'Must roll back', translations: { it: { title: 'Must roll back' } }, tourChanges: [
      { slug: 'a-tour', expectedDestinationSlug: null, linked: true }, { slug: 'z-tour', expectedDestinationSlug: 'old-target', linked: true },
    ] }), context())
    expect(response.status).toBe(409)
    expect(m.destinations.get('cairo')).toEqual(before)
    expect(m.tours.get('a-tour')?.destinationSlug).toBeNull()
    expect(m.translations.get('cairo')).not.toContain('Must roll back')
  })
  it('allows draft unlinking but never detaches a published one-day tour', async () => {
    seed(); tour()
    const change = { slug: 'tour-one', expectedDestinationSlug: 'cairo', linked: false }
    expect((await PUT(request('PUT', { tourChanges: [change] }), context())).status).toBe(409)
    expect(m.tours.get('tour-one')?.destinationSlug).toBe('cairo')
    m.tours.get('tour-one')!.status = 'draft'
    expect((await PUT(request('PUT', { tourChanges: [change] }), context())).status).toBe(200)
    expect(m.tours.get('tour-one')?.destinationSlug).toBeNull()
  })
  it('renames tour references and translations atomically without changing publication or listing flags', async () => {
    seed(); tour()
    const response = await PUT(request('PUT', { slug: 'cairo-city' }), context())
    expect(response.status).toBe(200)
    expect(m.destinations.has('cairo')).toBe(false)
    expect(m.destinations.get('cairo-city')).toMatchObject({ isPublished: true, showInDestinations: false })
    expect(m.tours.get('tour-one')?.destinationSlug).toBe('cairo-city')
    expect(m.translations.has('cairo')).toBe(false)
    expect(m.translations.get('cairo-city')).toContain('El Cairo')
  })
  it('rolls back linked renames without tours.edit, and rejects deleting referenced destinations', async () => {
    seed(); tour(); m.permissions.delete('tours.edit')
    expect((await PUT(request('PUT', { slug: 'renamed' }), context())).status).toBe(403)
    expect(m.destinations.has('cairo')).toBe(true)
    expect((await DELETE(request('DELETE'), context())).status).toBe(409)
    expect(m.tours.get('tour-one')?.destinationSlug).toBe('cairo')
    expect(m.translations.has('cairo')).toBe(true)
  })
  it('deletes an unreferenced record and translations together', async () => {
    seed()
    expect((await DELETE(request('DELETE'), context())).status).toBe(200)
    expect(m.destinations.size).toBe(0)
    expect(m.translations.size).toBe(0)
  })
  it('validates optional detail and duplicate association payloads', () => {
    expect(() => validateDestinationWrite({ detail: { facts: [{ label: 'Missing value' }] } })).toThrow('facts')
    const change = { slug: 'tour-one', expectedDestinationSlug: null, linked: true }
    expect(() => validateDestinationWrite({ tourChanges: [change, change] })).toThrow('association')
    expect(stripRecordSeo({ intro: 'Kept', seoManager: { private: true } })).toEqual({ intro: 'Kept' })
  })
})
