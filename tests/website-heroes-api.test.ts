import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ user: { id: 'staff' } as { id: string } | null, allowed: true, origin: true, read: vi.fn(), change: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => mocks.user, hasPermission: () => mocks.allowed }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => mocks.origin }))
vi.mock('@/lib/server/website-heroes', () => ({ readHeroState: mocks.read, changeHero: mocks.change, HeroConflictError: class extends Error {} }))
import { GET, PATCH } from '@/app/api/admin/website-cms/hero-sections/route'
import { GET as publicGET } from '@/app/api/website-heroes/homepage/route'
import { initialHeroState, originalHomeHero } from '@/lib/website-heroes'
beforeEach(() => { mocks.user = { id: 'staff' }; mocks.allowed = true; mocks.origin = true; mocks.read.mockReset().mockResolvedValue(initialHeroState()); mocks.change.mockReset().mockResolvedValue(initialHeroState()) })
describe('CMS API security without database writes', () => {
  it('requires authentication before reading private drafts', async () => {
    mocks.user = null
    expect((await GET()).status).toBe(401)
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('requires permission and same-origin before mutation', async () => {
    mocks.allowed = false
    expect((await PATCH(new Request('https://example.com', { method: 'PATCH' }))).status).toBe(403)
    mocks.allowed = true; mocks.origin = false
    expect((await PATCH(new Request('https://example.com', { method: 'PATCH' }))).status).toBe(403)
    expect(mocks.change).not.toHaveBeenCalled()
  })
  it('rejects invalid revision and action without persistence', async () => {
    const response = await PATCH(new Request('https://example.com', { method: 'PATCH', body: JSON.stringify({ action: 'delete', revision: -1 }) }))
    expect(response.status).toBe(400)
    expect(mocks.change).not.toHaveBeenCalled()
  })
  it('does not expose private drafts or revisions publicly', async () => {
    mocks.read.mockResolvedValue({ ...initialHeroState(), revision: 1, draft: originalHomeHero() })
    const response = await publicGET()
    expect(await response.json()).toEqual({ hidden: false, content: null })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('does not reveal database errors or silently return original content on read failure', async () => {
    mocks.read.mockRejectedValue(new Error('Internal database detail'))
    const response = await publicGET()
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('Internal database detail')
  })
})
