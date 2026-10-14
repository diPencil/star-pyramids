import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ user: { id: 'staff' } as { id: string } | null, allowed: true, origin: true, read: vi.fn(), change: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => mock.user, hasPermission: () => mock.allowed }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => mock.origin }))
vi.mock('@/lib/server/faq-hero', () => ({ readFaqHeroState: mock.read, changeFaqHero: mock.change }))
import { GET, PATCH } from '@/app/api/admin/website-cms/editorial-heroes/[id]/route'
import { initialFaqHeroState } from '@/lib/faq-hero'
const context = (id: string) => ({ params: Promise.resolve({ id }) })
beforeEach(() => { mock.user = { id: 'staff' }; mock.allowed = true; mock.origin = true; mock.read.mockReset().mockResolvedValue(initialFaqHeroState()); mock.change.mockReset().mockResolvedValue(initialFaqHeroState()) })
describe('editorial hero routes use only allowlisted identities', () => {
  it('rejects unknown IDs without reading or writing settings', async () => {
    expect((await GET(new Request('https://example.com'), context('unknown'))).status).toBe(404)
    expect((await PATCH(new Request('https://example.com', { method: 'PATCH' }), context('__proto__'))).status).toBe(404)
    expect(mock.read).not.toHaveBeenCalled(); expect(mock.change).not.toHaveBeenCalled()
  })
  it.each(['destinations', 'guide', 'accessible'])('enforces auth and permission for %s', async (id) => {
    mock.user = null
    expect((await GET(new Request('https://example.com'), context(id))).status).toBe(401)
    mock.user = { id: 'staff' }; mock.allowed = false
    expect((await GET(new Request('https://example.com'), context(id))).status).toBe(403)
    expect(mock.read).not.toHaveBeenCalled()
  })
  it('forwards the explicit route identity for reads and writes', async () => {
    await GET(new Request('https://example.com'), context('destinations'))
    expect(mock.read).toHaveBeenCalledWith('destinations')
    const response = await PATCH(new Request('https://example.com', { method: 'PATCH', body: JSON.stringify({ action: 'unpublish', revision: 0 }) }), context('destinations'))
    expect(response.status).toBe(200)
    expect(mock.change).toHaveBeenCalledWith('unpublish', 0, undefined, 'destinations')
  })
})
