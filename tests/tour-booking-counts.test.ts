import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  signedIn: true,
  permissions: ['tours.view'] as string[],
}))

const db = vi.hoisted(() => ({
  tour: { findMany: vi.fn() },
  bookingItem: { findMany: vi.fn() },
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

import { GET as listTours } from '@/app/api/tours/route'
import { sortAdminRows } from '@/components/admin/admin-table-sort'

const read = (path: string) =>
  new Request(`http://localhost:3000${path}`, { headers: { host: 'localhost:3000' } })

type TourResponse = {
  slug: string
  status?: string
  bookingCount?: number
}

const tours = [
  { id: '1', slug: 'cairo', aliases: '["cairo-old","cairo-legacy"]', title: 'Cairo', status: 'draft' },
  { id: '2', slug: 'luxor', aliases: '[]', title: 'Luxor', status: 'published' },
  { id: '3', slug: 'aswan', aliases: '[]', title: 'Aswan', status: 'published' },
]

const adminUrl = '/api/tours?all=1&withBookingCounts=1'

beforeEach(() => {
  state.signedIn = true
  state.permissions = ['tours.view']
  vi.clearAllMocks()
  db.tour.findMany.mockResolvedValue(tours)
  db.bookingItem.findMany.mockResolvedValue([])
})

describe('tour booking counts', () => {
  it('returns zero for trips with no bookings', async () => {
    const response = await listTours(read(adminUrl))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { tours: TourResponse[] }
    expect(body.tours.map((tour) => tour.bookingCount)).toEqual([0, 0, 0])
  })

  it('counts multiple bookings once and maps aliases to the canonical trip', async () => {
    db.bookingItem.findMany.mockResolvedValue([
      { bookingId: 'b1', tourSlug: 'cairo' },
      { bookingId: 'b1', tourSlug: 'cairo' },
      { bookingId: 'b1', tourSlug: 'cairo-old' },
      { bookingId: 'b2', tourSlug: 'cairo-old' },
      { bookingId: 'b3', tourSlug: 'cairo-legacy' },
      { bookingId: 'b4', tourSlug: 'luxor' },
      { bookingId: 'b4', tourSlug: 'luxor' },
    ])
    const response = await listTours(read(adminUrl))
    const body = (await response.json()) as { tours: TourResponse[] }
    const bySlug = new Map(body.tours.map((tour) => [tour.slug, tour.bookingCount]))
    expect(bySlug.get('cairo')).toBe(3)
    expect(bySlug.get('luxor')).toBe(1)
    expect(bySlug.get('aswan')).toBe(0)
  })

  it('keeps unpublished trips visible to authorized staff with their counts', async () => {
    db.bookingItem.findMany.mockResolvedValue([{ bookingId: 'b1', tourSlug: 'cairo' }])
    const body = (await (await listTours(read(adminUrl))).json()) as { tours: TourResponse[] }
    expect(body.tours.find((tour) => tour.slug === 'cairo')).toMatchObject({
      status: 'draft',
      bookingCount: 1,
    })
  })

  it('does not filter historical counts by booking status', async () => {
    await listTours(read(adminUrl))
    const args = db.bookingItem.findMany.mock.calls[0][0] as {
      where: { tourSlug: { in: string[] } }
      include?: unknown
      select: Record<string, boolean>
      distinct: string[]
    }
    expect(args.where).toEqual({
      tourSlug: { in: ['cairo', 'cairo-old', 'cairo-legacy', 'luxor', 'aswan'] },
    })
    expect(args.select).toEqual({ bookingId: true, tourSlug: true })
    expect(args.distinct).toEqual(['bookingId', 'tourSlug'])
    expect(args).not.toHaveProperty('include')
  })

  it('uses one grouped lookup for the complete catalogue, not one query per trip', async () => {
    const manyTours = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      slug: `tour-${index}`,
      aliases: '[]',
      title: `Tour ${index}`,
      status: 'published',
    }))
    db.tour.findMany.mockResolvedValue(manyTours)
    db.bookingItem.findMany.mockResolvedValue([
      { bookingId: 'b1', tourSlug: 'tour-0' },
      { bookingId: 'b2', tourSlug: 'tour-29' },
    ])

    const response = await listTours(read(adminUrl))
    expect(response.status).toBe(200)
    expect(db.tour.findMany).toHaveBeenCalledTimes(1)
    expect(db.bookingItem.findMany).toHaveBeenCalledTimes(1)

    const body = (await response.json()) as { tours: TourResponse[] }
    expect(body.tours).toHaveLength(30)
    expect(body.tours[0].bookingCount).toBe(1)
    expect(body.tours[29].bookingCount).toBe(1)
  })

  it('recomputes counts on each request after bookings change', async () => {
    db.bookingItem.findMany.mockResolvedValueOnce([{ bookingId: 'b1', tourSlug: 'cairo' }])
    const first = (await (await listTours(read(adminUrl))).json()) as { tours: TourResponse[] }
    expect(first.tours.find((tour) => tour.slug === 'cairo')?.bookingCount).toBe(1)

    db.bookingItem.findMany.mockResolvedValueOnce([
      { bookingId: 'b1', tourSlug: 'cairo' },
      { bookingId: 'b2', tourSlug: 'cairo' },
    ])
    const second = (await (await listTours(read(adminUrl))).json()) as { tours: TourResponse[] }
    expect(second.tours.find((tour) => tour.slug === 'cairo')?.bookingCount).toBe(2)
    expect(db.bookingItem.findMany).toHaveBeenCalledTimes(2)
  })

  it('requires tours.view and never exposes counts to public list callers', async () => {
    state.signedIn = false
    expect((await listTours(read(adminUrl))).status).toBe(401)

    state.signedIn = true
    state.permissions = ['tours.edit']
    expect((await listTours(read(adminUrl))).status).toBe(403)

    state.signedIn = false
    const publicResponse = await listTours(read('/api/tours?withBookingCounts=1'))
    expect(publicResponse.status).toBe(200)
    const body = (await publicResponse.json()) as { tours: TourResponse[] }
    expect(body.tours).toHaveLength(2)
    expect(body.tours.every((tour) => !('bookingCount' in tour))).toBe(true)
    expect(db.bookingItem.findMany).not.toHaveBeenCalled()
  })

  it('sorts the complete result set by booking count', () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      id: index,
      bookings: (index * 7) % 6,
    }))
    const accessors = { bookings: (row: (typeof rows)[number]) => row.bookings }

    const ascending = sortAdminRows(rows, accessors, 'bookings', 'asc')
    const descending = sortAdminRows(rows, accessors, 'bookings', 'desc')
    expect(ascending).toHaveLength(30)
    expect(descending).toHaveLength(30)
    expect(ascending.map((row) => row.bookings)).toEqual(
      [...rows.map((row) => row.bookings)].sort((left, right) => left - right),
    )
    expect(descending.map((row) => row.bookings)).toEqual(
      [...rows.map((row) => row.bookings)].sort((left, right) => right - left),
    )
  })
})
