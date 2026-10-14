import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ authenticated: true, allowed: true, findMany: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => mock.authenticated ? { id: 'staff' } : null, hasPermission: () => mock.allowed }))
vi.mock('@/lib/server/db', () => ({ db: { tour: { findMany: mock.findMany }, destination: { findMany: mock.findMany }, blog: { findMany: mock.findMany }, offer: { findMany: mock.findMany } } }))
import { GET } from '@/app/api/admin/website-cms/reference-options/route'
beforeEach(() => { mock.authenticated = true; mock.allowed = true; mock.findMany.mockReset().mockResolvedValue([{ slug: 'published-record', title: 'Published record' }]) })
describe('published CMS reference options without database access', () => {
  it('enforces session and settings permission before loading any records', async () => {
    mock.authenticated = false
    expect((await GET(new Request('https://example.test?source=tours'))).status).toBe(401)
    mock.authenticated = true; mock.allowed = false
    expect((await GET(new Request('https://example.test?source=tours'))).status).toBe(403)
    expect(mock.findMany).not.toHaveBeenCalled()
  })
  it('limits searches to public records and bounded queries, returning only link options', async () => {
    const result = await GET(new Request('https://example.test?source=tours&q=' + 'x'.repeat(120)))
    expect(result.status).toBe(200)
    expect(mock.findMany.mock.calls[0][0]).toMatchObject({ where: { status: 'published', title: { contains: 'x'.repeat(100) } }, take: 100, select: { slug: true, title: true } })
    expect(await result.json()).toEqual({ options: [{ value: 'published-record', label: 'Published record', href: '/egypt-tours/published-record' }], truncated: false })
  })
  it('uses the existing tour-offer link rule and excludes expired or unpublished-tour offers', async () => {
    mock.findMany.mockResolvedValue([
      { slug: 'tour-offer', title: 'Tour offer', tourSlug: 'real-tour', tour: { status: 'published' }, isPublished: true },
      { slug: 'expired', title: 'Expired', deadline: '2000-01-01', isPublished: true },
      { slug: 'draft-tour', title: 'Draft tour', tourSlug: 'hidden-tour', tour: { status: 'draft' }, isPublished: true },
    ])
    const result = await (await GET(new Request('https://example.test?source=offers'))).json()
    expect(result.options).toEqual([{ value: 'tour-offer', label: 'Tour offer', href: '/egypt-tours/real-tour' }])
  })
  it('rejects arbitrary data sources and hides database errors', async () => {
    expect((await GET(new Request('https://example.test?source=users'))).status).toBe(400)
    expect(mock.findMany).not.toHaveBeenCalled()
    mock.findMany.mockRejectedValue(new Error('connection-secret'))
    const result = await GET(new Request('https://example.test?source=blogs'))
    expect(result.status).toBe(503)
    expect(await result.text()).not.toContain('connection-secret')
  })
})
