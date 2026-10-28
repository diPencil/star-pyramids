import { beforeEach, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ user: vi.fn(), permission: vi.fn(), list: vi.fn(), count: vi.fn(), stats: vi.fn(), tour: vi.fn(), tours: vi.fn(), one: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: m.user, hasPermission: m.permission }))
vi.mock('@/lib/server/db', () => ({ db: { tour: { findUnique: m.tour, findMany: m.tours }, review: { findMany: m.list, count: m.count, aggregate: m.stats, findUnique: m.one, updateMany: m.update } } }))
import { GET as publicList } from '@/app/api/reviews/route'
import { GET as adminList } from '@/app/api/admin/reviews/route'
import { GET as detail, PATCH } from '@/app/api/admin/reviews/[publicId]/route'
import { parseReviewScope, reviewPage } from '@/lib/review-scope'

const rows = [
  { publicId: 'a', tourSlug: '@website', status: 'PUBLISHED', rating: 4, text: 'Website experience', title: null, publishedAt: new Date('2026-10-20'), user: { firstName: 'Actual', lastName: 'Customer', email: 'private@example.com' } },
  { publicId: 'b', tourSlug: 'published-trip', status: 'PUBLISHED', rating: 5, text: 'Trip experience', title: 'Great', publishedAt: new Date('2026-10-21'), user: { firstName: 'Real', lastName: 'Reviewer' } },
  { publicId: 'c', tourSlug: 'hidden-trip', status: 'PUBLISHED', rating: 3, text: 'Saved public review', title: null, publishedAt: new Date('2026-10-19'), user: { firstName: 'Guest' } },
  { publicId: 'd', tourSlug: 'deleted-trip', status: 'PUBLISHED', rating: 2, text: 'Saved public review', title: null, publishedAt: new Date('2026-10-18'), user: { firstName: 'Guest' } },
  { publicId: 'pending', tourSlug: 'published-trip', status: 'PENDING', rating: 1, text: 'Unapproved', title: null, publishedAt: null, user: { firstName: 'Private' } },
  { publicId: 'rejected', tourSlug: '@website', status: 'REJECTED', rating: 1, text: 'Rejected', title: null, publishedAt: null, user: { firstName: 'Private' } },
]
type Row = typeof rows[number]
function matches(row: Row, where: { status?: string; tourSlug?: string | { not: string } }) {
  return (!where.status || row.status === where.status) && (!where.tourSlug || (typeof where.tourSlug === 'string' ? row.tourSlug === where.tourSlug : row.tourSlug !== where.tourSlug.not))
}
const request = (query: string, admin = false) => new Request(`http://localhost:3000/api/${admin ? 'admin/' : ''}reviews?${query}`)
const params = { params: Promise.resolve({ publicId: 'review-id' }) }
const patch = (body: unknown, origin = 'http://localhost:3000') => PATCH(new Request('http://localhost:3000/api/admin/reviews/review-id', { method: 'PATCH', headers: { host: 'localhost:3000', origin }, body: JSON.stringify(body) }), params)
beforeEach(() => {
  vi.clearAllMocks()
  m.user.mockResolvedValue({ id: 'staff' }); m.permission.mockReturnValue(true)
  m.tour.mockImplementation(async ({ where }) => where.slug === 'published-trip' ? { slug: where.slug, status: 'published' } : where.slug === 'hidden-trip' ? { slug: where.slug, status: 'draft' } : null)
  m.tours.mockImplementation(async ({ where }) => (!where.slug || where.slug.in.includes('published-trip')) ? [{ slug: 'published-trip', title: 'Database trip name' }] : [])
  m.list.mockImplementation(async ({ where, skip = 0, take = 20 }) => rows.filter(row => matches(row, where)).sort((a, b) => Number(b.publishedAt) - Number(a.publishedAt)).slice(skip, skip + take))
  m.count.mockImplementation(async ({ where }) => rows.filter(row => matches(row, where)).length)
  m.stats.mockImplementation(async ({ where }) => { const found = rows.filter(row => matches(row, where)); return { _avg: { rating: found.length ? found.reduce((sum, row) => sum + row.rating, 0) / found.length : null }, _count: { rating: found.length } } })
  m.one.mockResolvedValue({ ...rows[0], id: 'internal-id', status: 'PENDING' })
  m.update.mockResolvedValue({ count: 1 })
})

it.each([['all', ['b', 'a', 'c', 'd']], ['website', ['a']], ['trips', ['b', 'c', 'd']]])('filters %s on the server and never duplicates records', async (scope, ids) => {
  const response = await publicList(request(`scope=${scope}`)); expect(response.status).toBe(200)
  const data = await response.json(); expect(data.reviews.map((row: Row) => row.publicId)).toEqual(ids)
  expect(data.summary.count).toBe(ids.length); expect(new Set(data.reviews.map((row: Row) => row.publicId)).size).toBe(ids.length)
  expect(m.list.mock.calls[0][0].where.status).toBe('PUBLISHED')
})
it('keeps published reviews but hides deleted/unpublished trip metadata and all user private fields', async () => {
  const response = await publicList(request('scope=trips')); const data = await response.json()
  expect(data.reviews[0].trip).toEqual({ slug: 'published-trip', title: 'Database trip name', href: '/egypt-tours/published-trip' })
  expect(data.reviews.slice(1).every((row: { trip: unknown }) => row.trip === null)).toBe(true)
  expect(JSON.stringify(data)).not.toMatch(/hidden-trip|deleted-trip|private@example|internal-id|Unapproved|Rejected/)
  expect(m.tours.mock.calls[0][0]).toMatchObject({ where: { status: 'published' }, select: { slug: true, title: true } })
})
it('preserves legacy tourSlug API and does not expose unpublished trip pages', async () => {
  const result = await publicList(request('tourSlug=published-trip')); expect(result.status).toBe(200); expect((await result.json()).summary.count).toBe(1)
  expect((await publicList(request('tourSlug=hidden-trip'))).status).toBe(404)
  expect((await publicList(request('tourSlug=deleted-trip'))).status).toBe(404)
})
it('defaults omitted scope to all and rejects invalid/conflicting scope filters', async () => {
  expect((await (await publicList(request(''))).json()).summary.count).toBe(4)
  expect((await publicList(request('scope=bogus'))).status).toBe(400)
  expect((await publicList(request('scope=website&tourSlug=published-trip'))).status).toBe(400)
  expect((await publicList(request('tourSlug=%40website'))).status).toBe(404)
})
it('paginates before projection with deterministic publishedAt/publicId ordering', async () => {
  const result = await (await publicList(request('scope=all&page=2&limit=2'))).json()
  expect(result.reviews.map((row: Row) => row.publicId)).toEqual(['c', 'd'])
  expect(result.pagination).toEqual({ page: 2, limit: 2, total: 4, totalPages: 2 })
  expect(m.list.mock.calls[0][0]).toMatchObject({ skip: 2, take: 2, orderBy: [{ publishedAt: 'desc' }, { publicId: 'desc' }] })
})
it('bounds malformed pagination and returns generic storage errors', async () => {
  expect(reviewPage('Infinity', 1, 50)).toBe(1); expect(reviewPage('9007199254740992', 1, 50)).toBe(1); expect(reviewPage('999', 10, 20)).toBe(20)
  expect(parseReviewScope('')).toBe(null)
  m.list.mockRejectedValueOnce(Error('secret database password')); const result = await publicList(request('scope=all'))
  expect(result.status).toBe(503); expect(JSON.stringify(await result.json())).not.toContain('secret')
})
it('protects admin listing, details and moderation separately', async () => {
  m.user.mockResolvedValue(null)
  expect((await adminList(request('', true))).status).toBe(401); expect((await detail(request(''), params)).status).toBe(401); expect((await patch({ action: 'publish' })).status).toBe(401)
  m.user.mockResolvedValue({ id: 'staff' }); m.permission.mockReturnValue(false)
  expect((await adminList(request('', true))).status).toBe(403); expect((await detail(request(''), params)).status).toBe(403); expect((await patch({ action: 'publish' })).status).toBe(403)
  expect(m.update).not.toHaveBeenCalled()
})
it('uses MySQL-compatible search, global sorting and server pagination', async () => {
  const result = await adminList(request('scope=trips&status=PENDING&q=trip&page=2&limit=10&sort=rating&direction=asc', true)); expect(result.status).toBe(200)
  const args = m.list.mock.calls[0][0]
  expect(args).toMatchObject({ where: { status: 'PENDING', tourSlug: { not: '@website' } }, skip: 10, take: 10, orderBy: [{ rating: 'asc' }, { publicId: 'desc' }] })
  expect(JSON.stringify(args)).not.toContain('insensitive')
  expect((await adminList(request('status=invalid', true))).status).toBe(400)
  expect((await adminList(request('scope=trips&tourSlug=%40website', true))).status).toBe(400)
})
it.each([null, [], {}, { action: 'publish', text: 'overwritten' }, { action: 'invalid' }])('rejects invalid moderation body %j without modifying content', async body => {
  expect((await patch(body)).status).toBe(400); expect(m.update).not.toHaveBeenCalled()
})
it.each([['PENDING', 'publish', 'PUBLISHED'], ['PENDING', 'reject', 'REJECTED'], ['REJECTED', 'pend', 'PENDING'], ['PUBLISHED', 'reject', 'REJECTED']])('moderates %s with %s without overwriting review content', async (status, action, expected) => {
  m.one.mockResolvedValue({ ...rows[0], status, id: 'internal-id' })
  expect((await patch({ action })).status).toBe(200)
  expect(m.update).toHaveBeenCalledWith({ where: { publicId: 'review-id', status }, data: { status: expected, publishedAt: action === 'publish' ? expect.any(Date) : null } })
})
it('rejects conflicting moderation and cross-origin writes', async () => {
  m.update.mockResolvedValue({ count: 0 }); expect((await patch({ action: 'publish' })).status).toBe(409)
  expect((await patch({ action: 'publish' }, 'https://evil.example')).status).toBe(403)
})
