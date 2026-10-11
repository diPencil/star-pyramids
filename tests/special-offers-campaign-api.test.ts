import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => ({ id: 'staff' }), hasPermission: () => true }))
vi.mock('@/lib/server/db', () => ({ db: { offer: { findUnique: mocks.findUnique } } }))
vi.mock('@/lib/server/catalogue-translations', () => ({
  catalogueTranslationResponse: async (_kind: string, body: unknown) => body,
  saveWithCatalogueTranslations: async (_kind: string, _translations: unknown, _previous: unknown, mutate: (tx: unknown) => Promise<unknown>) => mutate({ offer: { create: mocks.create, update: mocks.update }, tour: {} }),
  deleteWithCatalogueTranslations: async (_kind: string, _slug: unknown, mutate: (tx: unknown) => Promise<unknown>) => mutate({ offer: { delete: mocks.remove } }),
}))
import { POST } from '@/app/api/offers/route'
import { PUT, DELETE } from '@/app/api/offers/[slug]/route'
import { readCampaign } from '@/lib/marketing-campaigns'
const context = { params: Promise.resolve({ slug: 'campaign' }) }
const campaign = { ...readCampaign(undefined), body: 'Actual details', terms: 'Actual terms', ctaHref: '/make-your-trip', placements: ['offers', 'home', 'trips-sidebar', 'blog-sidebar'] }
function request(method: string, data?: unknown) {
  return new Request('http://localhost:3000/api/offers/campaign', { method, headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.findUnique.mockResolvedValue(null)
  mocks.create.mockImplementation(async ({ data }) => data)
  mocks.update.mockImplementation(async ({ data }) => data)
})
describe('Campaign API round trip', () => {
  it('stores campaign settings together with gallery, highlights and translations payload', async () => {
    const response = await POST(request('POST', { slug: 'campaign', title: 'Campaign', badge: 'Family', copy: 'Actual copy', image: '/cover.jpg', gallery: ['/detail.jpg'], highlights: ['Actual benefit'], campaign, price: 125.5, startsAt: '2026-01-01', deadline: '2099-12-31', translations: { es: { 'campaign.body': 'Detalles' } } }))
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.offer.content).toMatchObject({ campaign, gallery: ['/detail.jpg'], highlights: ['Actual benefit'] })
    expect(body.offer).toMatchObject({ price: 125.5, tourSlug: null, discountPercent: null })
  })
  it('preserves campaign, gallery and other legacy content when only hiding a campaign', async () => {
    mocks.findUnique.mockResolvedValue({ slug: 'campaign', title: 'Campaign', badge: 'Family', copy: 'Copy', tourSlug: null, discountPercent: null, startsAt: null, deadline: null, content: JSON.stringify({ campaign, gallery: ['/detail.jpg'], retained: true }) })
    const response = await PUT(request('PUT', { isPublished: false }), context)
    expect(response.status).toBe(200)
    expect((await response.json()).offer.content).toMatchObject({ campaign, gallery: ['/detail.jpg'], retained: true })
  })
  it('rejects unsafe campaign links before any write', async () => {
    const response = await POST(request('POST', { slug: 'campaign', title: 'Campaign', badge: 'Family', copy: 'Copy', campaign: { ...campaign, ctaHref: 'javascript:alert(1)' } }))
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it.each([{ price: -1 }, { originalPrice: 'invalid' }, { displayOrder: 1.5 }])('rejects invalid financial/order input %j', async input => {
    expect((await POST(request('POST', input))).status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('deletes only the selected offer record', async () => {
    mocks.findUnique.mockResolvedValue({ slug: 'campaign' })
    mocks.remove.mockResolvedValue({ slug: 'campaign' })
    expect((await DELETE(request('DELETE'), context)).status).toBe(200)
    expect(mocks.remove).toHaveBeenCalledWith({ where: { slug: 'campaign' } })
  })
})
