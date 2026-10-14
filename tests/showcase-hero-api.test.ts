import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ user: { id: 'staff' } as { id: string } | null, allowed: true, origin: true, read: vi.fn(), change: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => mock.user, hasPermission: () => mock.allowed }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => mock.origin }))
vi.mock('@/lib/server/showcase-heroes', () => ({ readShowcaseState: mock.read, changeShowcaseHero: mock.change }))
import { GET, PATCH } from '@/app/api/admin/website-cms/showcase-heroes/[id]/route'
import { initialShowcaseState } from '@/lib/showcase-heroes'
const context = (id = 'about') => ({ params: Promise.resolve({ id }) })
beforeEach(() => { mock.user = { id: 'staff' }; mock.allowed = true; mock.origin = true; mock.read.mockReset().mockResolvedValue(initialShowcaseState()); mock.change.mockReset().mockResolvedValue(initialShowcaseState()) })
describe('showcase hero security with no database writes', () => {
  it('requires authenticated viewing before reading private drafts', async () => {
    mock.user = null
    expect((await GET(new Request('https://example.com'), context())).status).toBe(401)
    mock.user = { id: 'staff' }; mock.allowed = false
    expect((await GET(new Request('https://example.com'), context())).status).toBe(403)
    expect(mock.read).not.toHaveBeenCalled()
  })
  it('requires permission and origin for writes', async () => {
    mock.allowed = false
    expect((await PATCH(new Request('https://example.com', { method: 'PATCH' }), context())).status).toBe(403)
    mock.allowed = true; mock.origin = false
    expect((await PATCH(new Request('https://example.com', { method: 'PATCH' }), context())).status).toBe(403)
    expect(mock.change).not.toHaveBeenCalled()
  })
  it('rejects arbitrary setting identities and invalid revisions', async () => {
    expect((await GET(new Request('https://example.com'), context('__proto__'))).status).toBe(404)
    expect((await PATCH(new Request('https://example.com', { method: 'PATCH', body: JSON.stringify({ action: 'delete', revision: 0 }) }), context())).status).toBe(400)
    expect(mock.change).not.toHaveBeenCalled(); expect(mock.read).not.toHaveBeenCalled()
  })
  it('uses private uncached responses and safe errors', async () => {
    const response = await GET(new Request('https://example.com'), context())
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    mock.read.mockRejectedValue(new Error('Database details'))
    const failure = await GET(new Request('https://example.com'), context())
    expect(failure.status).toBe(503); expect(await failure.text()).not.toContain('Database details')
  })
})
