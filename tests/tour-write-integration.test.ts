import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tourWritePayload } from '@/lib/tour-write'
import { blankTour, editorData } from '@/components/admin/trip-builder'
import { buildTripPreview } from '@/lib/trip-builder-preview'
import { decodeTourJson } from '@/lib/tour-json'
const memory = vi.hoisted(() => ({ rows: new Map<string, any>(), allowed: true, authenticated: true, origin: true, now: 0, conflict: false }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => memory.authenticated ? { id: 'staff' } : null, hasPermission: () => memory.allowed }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => memory.origin }))
vi.mock('@/lib/server/special-offers', () => ({ applyLinkedOfferDeals: async (rows: unknown[]) => rows }))
vi.mock('@/lib/server/tours', () => ({ getTourBookingCounts: vi.fn(), findTourDeletionBlockers: async () => [] }))
vi.mock('@/lib/server/db', () => ({ db: { tour: {
  findUnique: async ({ where }: any) => memory.rows.get(where.slug) ?? null,
  findMany: async () => [...memory.rows.values()],
  create: async ({ data }: any) => { if (memory.rows.has(data.slug)) throw { code: 'P2002' }; const row = { ...data, updatedAt: new Date(1700000000000 + ++memory.now) }; memory.rows.set(row.slug, row); return row },
  update: async ({ where, data }: any) => { const row = memory.rows.get(where.slug); if (memory.conflict) throw { code: 'P2025' }; const next = { ...row, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)), updatedAt: new Date(1700000000000 + ++memory.now) }; memory.rows.set(next.slug, next); return next },
} } }))
import { POST, GET as list } from '@/app/api/tours/route'
import { PUT, GET } from '@/app/api/tours/[slug]/route'
const context = { params: Promise.resolve({ slug: 'audit-trip' }) }
const request = (method: string, data: unknown) => new Request('https://example.test/api/tours', { method, body: JSON.stringify(data) })
const initial = () => ({ ...blankTour(), slug: 'audit-trip', title: 'Audit trip', price: 120.25, image: '/egypt-hero.png', duration: '1 day', location: 'Cairo', destinationSlug: 'cairo', titleAr: 'Legacy title', groupSize: '10', travelStyle: 'Private', deal: { percent: 10, endsAt: '2099-01-01' }, dayDetail: { overview: ['Overview'], stops: [], travelerPrices: [{ travelers: 1, adultPrice: 120.25, childPrice: 60, infantPrice: 0 }], addOns: [] } })
beforeEach(() => { memory.rows.clear(); memory.allowed = true; memory.authenticated = true; memory.origin = true; memory.conflict = false; memory.now = 0 })
describe('real Tour handlers with isolated in-memory persistence', () => {
  it('creates a draft, reopens/edits/previews, publishes and filters the public read model', async () => {
    const created = await POST(request('POST', tourWritePayload(initial(), 'draft')))
    expect(created.status).toBe(201)
    memory.authenticated = false
    expect((await GET(new Request('https://example.test'), context)).status).toBe(404)
    expect((await (await list(new Request('https://example.test/api/tours'))).json()).tours).toHaveLength(0)
    memory.authenticated = true
    const draft = (await (await GET(new Request('https://example.test'), context)).json()).tour
    const editor = editorData({ ...draft, price: Number(draft.price) })
    const projection = buildTripPreview(draft, { ...editor, catSlugs: editor.categorySlugs, form: { ...editor.form, title: 'Unsaved update' } }, 'en')
    expect(JSON.stringify(projection)).toContain('Unsaved update')
    expect(memory.rows.get('audit-trip').title).toBe('Audit trip')
    const saved = await PUT(request('PUT', tourWritePayload({ ...draft, title: 'Published update' }, 'published')), context)
    expect(saved.status).toBe(200)
    memory.authenticated = false
    expect((await (await GET(new Request('https://example.test'), context)).json()).tour).toMatchObject({ title: 'Published update', status: 'published' })
    expect((await (await list(new Request('https://example.test/api/tours'))).json()).tours).toHaveLength(1)
  })
  it('persists explicit clears rather than resurrecting old optional values', async () => {
    await POST(request('POST', tourWritePayload(initial(), 'draft')))
    const row = decodeTourJson(memory.rows.get('audit-trip')) as ReturnType<typeof initial>
    const payload = tourWritePayload({ ...row, titleAr: '', groupSize: '', travelStyle: '', deal: undefined, gallery: [], galleryCaptions: [], journeyVideos: [], dayDetail: { overview: [], stops: [], included: [], excluded: [], addOns: [], locations: [] } }, 'draft')
    expect((await PUT(request('PUT', payload), context)).status).toBe(200)
    const saved = decodeTourJson(memory.rows.get('audit-trip')) as any
    expect(saved).toMatchObject({ titleAr: null, groupSize: null, travelStyle: null, deal: null, gallery: [], dayDetail: { overview: [], addOns: [] } })
  })
  it.each([{ price: -1 }, { price: '10' }, { category: 'invalid' }, { status: 'anything' }, { slug: '../bad' }, { title: '' }, { dayDetail: { travelerPrices: [{ travelers: 1, adultPrice: -2 }] } }])('rejects invalid mutation %j before writes', async patch => {
    expect((await POST(request('POST', { ...initial(), ...patch }))).status).toBe(400)
    expect(memory.rows.size).toBe(0)
  })
  it.each([
    { category: 'one-day-tours', destinationSlug: null },
    { category: 'multi-days-tours', categorySlugs: [] },
    { category: 'nile-cruises', cruiseType: null },
    { category: 'shore-excursions', departurePort: '' },
  ])('does not publish an incomplete category through a status-only patch %j', async patch => {
    const created = await POST(request('POST', { ...initial(), ...patch, status: 'draft' }))
    expect(created.status).toBe(201)
    expect((await PUT(request('PUT', { status: 'published' }), context)).status).toBe(400)
    expect(memory.rows.get('audit-trip').status).toBe('draft')
  })
  it('rejects stale saves and maps database races to 409', async () => {
    const draft = (await (await POST(request('POST', tourWritePayload(initial(), 'draft')))).json()).tour
    expect((await PUT(request('PUT', { title: 'Newer update', expectedUpdatedAt: draft.updatedAt }), context)).status).toBe(200)
    expect((await PUT(request('PUT', { title: 'Old stale update', expectedUpdatedAt: draft.updatedAt }), context)).status).toBe(409)
    expect(memory.rows.get('audit-trip').title).toBe('Newer update')
    memory.conflict = true
    expect((await PUT(request('PUT', { title: 'Racing update' }), context)).status).toBe(409)
  })
  it('preserves role and same-origin boundaries', async () => {
    memory.authenticated = false
    expect((await POST(request('POST', initial()))).status).toBe(401)
    memory.authenticated = true; memory.allowed = false
    expect((await POST(request('POST', initial()))).status).toBe(403)
    memory.allowed = true; memory.origin = false
    expect((await POST(request('POST', initial()))).status).toBe(403)
    expect(memory.rows.size).toBe(0)
  })
})
