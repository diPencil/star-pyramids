import { beforeEach, expect, it, vi } from 'vitest'

type Row = { id: string; publicId: string; userId: string; tourSlug: string; rating: number; title: string | null; text: string; status: string; publishedAt: Date | null; user: { firstName: string; lastName: string; email: string } }
type Filter = { status?: string; tourSlug?: string | { not: string } }
const memory = vi.hoisted(() => ({ rows: [] as Row[] }))
const filtered = (where: Filter) => memory.rows.filter(row => (!where.status || row.status === where.status) && (!where.tourSlug || (typeof where.tourSlug === 'string' ? row.tourSlug === where.tourSlug : row.tourSlug !== where.tourSlug.not)))
vi.mock('@/lib/server/auth/auth', () => ({ getCurrentUser: async () => ({ id: 'customer' }), hasPermission: () => true }))
vi.mock('@/lib/server/db', () => ({ db: {
  reviewAttempt: { count: async () => 0, create: async () => ({}) },
  tour: {
    findUnique: async ({ where }: { where: { slug: string } }) => ({ slug: where.slug, status: 'published' }),
    findMany: async ({ where }: { where: { slug: { in: string[] } } }) => where.slug.in.map(slug => ({ slug, title: slug === 'full-day-cairo' ? 'Full Day Cairo' : 'Full Day Pyramids' })),
  },
  review: {
    findUnique: async ({ where }: { where: { publicId?: string; userId_tourSlug?: { userId: string; tourSlug: string } } }) => memory.rows.find(row => where.publicId ? row.publicId === where.publicId : row.userId === where.userId_tourSlug?.userId && row.tourSlug === where.userId_tourSlug?.tourSlug) ?? null,
    create: async ({ data }: { data: Omit<Row, 'id' | 'publicId' | 'publishedAt' | 'user'> }) => {
      const row = { ...data, id: 'internal', publicId: 'review-1', publishedAt: null, user: { firstName: 'Real', lastName: 'Traveler', email: 'private@example.test' } }
      memory.rows.push(row); return row
    },
    findMany: async ({ where }: { where: Filter }) => filtered(where),
    count: async ({ where }: { where: Filter }) => filtered(where).length,
    aggregate: async ({ where }: { where: Filter }) => { const rows = filtered(where); return { _avg: { rating: rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : null }, _count: { rating: rows.length } } },
    updateMany: async ({ where, data }: { where: { publicId: string; status: string }; data: Partial<Row> }) => {
      const row = memory.rows.find(row => row.publicId === where.publicId && row.status === where.status)
      if (!row) return { count: 0 }
      Object.assign(row, data); return { count: 1 }
    },
  },
} }))
import { GET, POST } from '@/app/api/reviews/route'
import { PATCH } from '@/app/api/admin/reviews/[publicId]/route'

const request = (path: string, body?: unknown, method = 'POST') => new Request('http://localhost:3000' + path, body === undefined ? {} : { method, headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify(body) })
const list = async (query: string) => (await GET(request('/api/reviews?' + query))).json()
const moderate = (action: string) => PATCH(request('/api/admin/reviews/review-1', { action }, 'PATCH'), { params: Promise.resolve({ publicId: 'review-1' }) })
beforeEach(() => { memory.rows = [] })

it('stores one selected-trip review pending, then exposes that same approved review on the homepage and correct tour only', async () => {
  const response = await POST(request('/api/reviews', { tourSlug: 'full-day-cairo', rating: 5, title: 'Cairo experience', text: 'A memorable Cairo tour with our guide.' }))
  expect(response.status).toBe(201)
  expect(memory.rows[0]).toMatchObject({ status: 'PENDING', tourSlug: 'full-day-cairo' })
  expect((await list('scope=trips')).summary.count).toBe(0)
  expect((await list('tourSlug=full-day-cairo')).summary.count).toBe(0)
  expect((await moderate('publish')).status).toBe(200)
  for (const query of ['scope=trips', 'scope=all', 'tourSlug=full-day-cairo']) {
    const data = await list(query)
    expect(data.summary).toEqual({ count: 1, average: 5 })
    expect(data.reviews[0]).toMatchObject({ publicId: 'review-1', scope: 'trips', trip: { slug: 'full-day-cairo', title: 'Full Day Cairo', href: '/egypt-tours/full-day-cairo' } })
    expect(JSON.stringify(data)).not.toContain('private@example.test')
  }
  expect((await list('scope=website')).summary.count).toBe(0)
  expect((await list('tourSlug=full-day-pyramids')).summary.count).toBe(0)
  expect((await moderate('reject')).status).toBe(200)
  expect((await list('scope=trips')).summary.count).toBe(0)
  expect((await list('tourSlug=full-day-cairo')).summary.count).toBe(0)
})
