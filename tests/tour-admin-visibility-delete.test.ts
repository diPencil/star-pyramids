import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  signedIn: true,
  permissions: ['tours.view', 'tours.edit', 'tours.delete'] as string[],
}))

const db = vi.hoisted(() => ({
  tour: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  bookingItem: { findFirst: vi.fn() },
  tripRequest: { findFirst: vi.fn() },
  review: { findFirst: vi.fn() },
  favoriteItem: { findFirst: vi.fn() },
  offer: { findFirst: vi.fn(), findMany: vi.fn() },
  journeyGalleryTour: { findFirst: vi.fn() },
}))

vi.mock('@/lib/server/auth', () => ({
  getCurrentUser: async () =>
    state.signedIn
      ? { id: 'staff-1', roles: ['ADMIN'], permissions: state.permissions }
      : null,
  hasPermission: (_user: unknown, key: string) => state.permissions.includes(key),
}))
vi.mock('@/lib/server/db', () => ({ db }))
vi.mock('@/lib/server/special-offers', () => ({
  applyLinkedOfferDeals: async (rows: unknown[]) => rows,
}))

import { DELETE, GET as getTour } from '@/app/api/tours/[slug]/route'
import { GET as listTours } from '@/app/api/tours/route'

const context = (slug: string) => ({ params: Promise.resolve({ slug }) })
const mutation = (slug: string, origin = 'http://localhost:3000') =>
  new Request(`http://localhost:3000/api/tours/${slug}`, {
    method: 'DELETE',
    headers: { host: 'localhost:3000', origin },
  })
const read = (path: string) =>
  new Request(`http://localhost:3000${path}`, {
    headers: { host: 'localhost:3000' },
  })

beforeEach(() => {
  state.signedIn = true
  state.permissions = ['tours.view', 'tours.edit', 'tours.delete']
  vi.clearAllMocks()
  for (const relation of [
    db.bookingItem,
    db.tripRequest,
    db.review,
    db.favoriteItem,
    db.offer,
    db.journeyGalleryTour,
  ]) {
    relation.findFirst.mockResolvedValue(null)
  }
  db.offer.findMany.mockResolvedValue([])
  db.tour.deleteMany.mockResolvedValue({ count: 1 })
})

describe('tour list visibility', () => {
  const rows = [
    { id: '1', slug: 'published', title: 'Published', status: 'published' },
    { id: '2', slug: 'draft', title: 'Draft', status: 'draft' },
    { id: '3', slug: 'legacy', title: 'Legacy', status: null },
  ]

  it('returns only published tours to the public', async () => {
    state.signedIn = false
    db.tour.findMany.mockResolvedValue(rows)
    const response = await listTours(read('/api/tours'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { tours: Array<{ slug: string }> }
    expect(body.tours.map((tour) => tour.slug)).toEqual(['published', 'legacy'])
  })

  it('requires authentication and tours.view for ?all=1', async () => {
    state.signedIn = false
    expect((await listTours(read('/api/tours?all=1'))).status).toBe(401)

    state.signedIn = true
    state.permissions = ['tours.edit']
    expect((await listTours(read('/api/tours?all=1'))).status).toBe(403)

    state.permissions = ['tours.view']
    db.tour.findMany.mockResolvedValue(rows)
    const response = await listTours(read('/api/tours?all=1'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { tours: Array<{ slug: string }> }
    expect(body.tours.map((tour) => tour.slug)).toEqual(['published', 'draft', 'legacy'])
  })
})

describe('single tour visibility', () => {
  it('hides an unpublished tour from the public', async () => {
    state.signedIn = false
    db.tour.findUnique.mockResolvedValue({ id: '1', slug: 'draft', status: 'draft' })
    const response = await getTour(read('/api/tours/draft'), context('draft'))
    expect(response.status).toBe(404)
  })

  it('allows staff with tours.view to preview an unpublished tour', async () => {
    state.permissions = ['tours.view']
    db.tour.findUnique.mockResolvedValue({ id: '1', slug: 'draft', status: 'draft' })
    const response = await getTour(read('/api/tours/draft'), context('draft'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { tour: { slug: string } }
    expect(body.tour.slug).toBe('draft')
  })

  it('keeps published tours public', async () => {
    state.signedIn = false
    db.tour.findUnique.mockResolvedValue({ id: '1', slug: 'live', status: 'published' })
    const response = await getTour(read('/api/tours/live'), context('live'))
    expect(response.status).toBe(200)
  })
})

describe('tour deletion guards', () => {
  it('requires authentication and tours.delete', async () => {
    state.signedIn = false
    expect((await DELETE(mutation('draft'), context('draft'))).status).toBe(401)

    state.signedIn = true
    state.permissions = ['tours.view']
    expect((await DELETE(mutation('draft'), context('draft'))).status).toBe(403)
  })

  it('rejects cross-origin mutations before touching data', async () => {
    const response = await DELETE(mutation('draft', 'https://evil.example'), context('draft'))
    expect(response.status).toBe(403)
    expect(db.tour.findUnique).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown tour', async () => {
    db.tour.findUnique.mockResolvedValue(null)
    expect((await DELETE(mutation('missing'), context('missing'))).status).toBe(404)
  })

  it('refuses to delete a published or legacy-published tour', async () => {
    db.tour.findUnique.mockResolvedValue({ slug: 'live', status: 'published', aliases: '[]' })
    const live = await DELETE(mutation('live'), context('live'))
    expect(live.status).toBe(409)
    expect(await live.json()).toMatchObject({ code: 'TOUR_PUBLISHED' })

    db.tour.findUnique.mockResolvedValue({ slug: 'legacy', status: null, aliases: '[]' })
    const legacy = await DELETE(mutation('legacy'), context('legacy'))
    expect(legacy.status).toBe(409)
    expect(db.tour.deleteMany).not.toHaveBeenCalled()
  })

  it('refuses to delete a tour referenced by bookings, including aliases', async () => {
    db.tour.findUnique.mockResolvedValue({ slug: 'draft', status: 'draft', aliases: '["old-draft"]' })
    db.bookingItem.findFirst.mockImplementation(
      async ({ where }: { where: { tourSlug: { in: string[] } } }) =>
        where.tourSlug.in.includes('old-draft') ? { id: 'booking-1' } : null,
    )
    const response = await DELETE(mutation('draft'), context('draft'))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'TOUR_IN_USE', blockers: ['bookings'] })
    expect(db.bookingItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tourSlug: { in: ['draft', 'old-draft'] } } }),
    )
    expect(db.tour.deleteMany).not.toHaveBeenCalled()
  })

  it('reports every protected relation', async () => {
    db.tour.findUnique.mockResolvedValue({ slug: 'draft', status: 'draft', aliases: '[]' })
    db.bookingItem.findFirst.mockResolvedValue({ id: 'b' })
    db.tripRequest.findFirst.mockResolvedValue({ id: 't' })
    db.review.findFirst.mockResolvedValue({ id: 'r' })
    db.favoriteItem.findFirst.mockResolvedValue({ id: 'f' })
    db.offer.findFirst.mockResolvedValue({ slug: 'offer' })
    db.journeyGalleryTour.findFirst.mockResolvedValue({ id: 'g' })
    const response = await DELETE(mutation('draft'), context('draft'))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'TOUR_IN_USE',
      blockers: ['bookings', 'tripRequests', 'reviews', 'favorites', 'offers', 'gallery'],
    })
  })

  it('deletes an eligible unpublished tour', async () => {
    db.tour.findUnique.mockResolvedValue({ slug: 'draft', status: 'draft', aliases: '[]' })
    const response = await DELETE(mutation('draft'), context('draft'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deleted: true })
    expect(db.tour.deleteMany).toHaveBeenCalledWith({ where: { slug: 'draft', status: 'draft' } })
  })

  it('refuses to delete when the row changed during confirmation', async () => {
    db.tour.findUnique.mockResolvedValue({ slug: 'draft', status: 'draft', aliases: '[]' })
    db.tour.deleteMany.mockResolvedValue({ count: 0 })
    const response = await DELETE(mutation('draft'), context('draft'))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'TOUR_CHANGED' })
  })

  it('maps a relation race to a safe conflict', async () => {
    db.tour.findUnique.mockResolvedValue({ slug: 'draft', status: 'draft', aliases: '[]' })
    db.tour.deleteMany.mockRejectedValue(Object.assign(new Error('FK'), { code: 'P2003' }))
    const response = await DELETE(mutation('draft'), context('draft'))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'TOUR_IN_USE' })
  })
})
