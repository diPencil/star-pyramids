import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ user: vi.fn(), permission: vi.fn(), many: vi.fn(), one: vi.fn(), translations: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: m.user, hasPermission: m.permission }))
vi.mock('@/lib/server/db', () => ({ db: { destination: { findMany: m.many, findUnique: m.one }, $queryRaw: m.translations } }))
import { GET as list } from '@/app/api/destinations/route'
import { GET as detail } from '@/app/api/destinations/[slug]/route'

const rows = [
  { slug: 'public', title: 'Published destination', isPublished: true, showInDestinations: false, showInOneDayTours: true, detail: JSON.stringify({ intro: 'Public copy', seoManager: { draft: { secret: 'PRIVATE SEO' } } }) },
  { slug: 'draft', title: 'PRIVATE DESTINATION', isPublished: false, detail: '{}' },
]
const request = (query = '') => new Request('https://example.test/api/destinations' + query)
const context = (slug: string) => ({ params: Promise.resolve({ slug }) })
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue(null)
  m.permission.mockReturnValue(false)
  m.translations.mockResolvedValue([])
  m.many.mockImplementation(async ({ where }) => rows.filter(row => where.isPublished === undefined || row.isPublished === where.isPublished))
  m.one.mockImplementation(async ({ where }) => rows.find(row => row.slug === where.slug) ?? null)
})

describe('destination public/private publication boundary', () => {
  it('exposes only published rows, including one-day-only records, without private SEO', async () => {
    const response = await list(request())
    const body = await response.json()
    expect(body.destinations.map((row: { slug: string }) => row.slug)).toEqual(['public'])
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE|seoManager/)
    expect(m.many).toHaveBeenCalledWith(expect.objectContaining({ where: { isPublished: true } }))
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
  it('keeps default reads public even for staff and rejects unpublished detail reads', async () => {
    m.user.mockResolvedValue({ id: 'staff' }); m.permission.mockReturnValue(true)
    expect((await (await list(request())).json()).destinations).toHaveLength(1)
    expect((await detail(request(), context('draft'))).status).toBe(404)
    expect((await detail(request(), context('missing'))).status).toBe(404)
    const response = await detail(request(), context('public'))
    expect(response.status).toBe(200)
    expect(JSON.stringify(await response.json())).not.toContain('seoManager')
  })
  it('requires authentication and destination read/edit permission before reading drafts', async () => {
    expect((await list(request('?admin=1'))).status).toBe(401)
    expect((await detail(request('?admin=1'), context('draft'))).status).toBe(401)
    m.user.mockResolvedValue({ id: 'customer' })
    expect((await list(request('?admin=1'))).status).toBe(403)
    expect((await detail(request('?admin=1'), context('draft'))).status).toBe(403)
    expect(m.many).not.toHaveBeenCalled(); expect(m.one).not.toHaveBeenCalled()
  })
  it.each(['destinations.view', 'destinations.edit'])('preserves private editor reads for %s', async permission => {
    m.user.mockResolvedValue({ id: 'staff' })
    m.permission.mockImplementation((_user, key) => key === permission)
    const response = await list(request('?admin=1'))
    expect((await response.json()).destinations).toHaveLength(2)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect((await detail(request('?admin=1'), context('draft'))).status).toBe(200)
  })
})
