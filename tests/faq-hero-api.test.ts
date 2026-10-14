import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ user: { id: 'staff' } as { id: string } | null, allowed: true, origin: true, read: vi.fn(), change: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => mock.user, hasPermission: () => mock.allowed }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => mock.origin }))
vi.mock('@/lib/server/faq-hero', () => ({ readFaqHeroState: mock.read, changeFaqHero: mock.change }))
import { GET, PATCH } from '@/app/api/admin/website-cms/faq-hero/route'
import { initialFaqHeroState } from '@/lib/faq-hero'
beforeEach(() => { mock.user = { id: 'staff' }; mock.allowed = true; mock.origin = true; mock.read.mockReset().mockResolvedValue(initialFaqHeroState()); mock.change.mockReset().mockResolvedValue(initialFaqHeroState()) })
describe('FAQ admin API with mocked persistence', () => {
  it('requires authentication before reading drafts', async () => {
    mock.user = null
    expect((await GET()).status).toBe(401)
    expect(mock.read).not.toHaveBeenCalled()
  })
  it('requires permissions for reading and writing', async () => {
    mock.allowed = false
    expect((await GET()).status).toBe(403)
    expect((await PATCH(new Request('https://example.com', { method: 'PATCH' }))).status).toBe(403)
    expect(mock.read).not.toHaveBeenCalled(); expect(mock.change).not.toHaveBeenCalled()
  })
  it('rejects foreign origin and invalid actions before persistence', async () => {
    mock.origin = false
    expect((await PATCH(new Request('https://example.com', { method: 'PATCH' }))).status).toBe(403)
    mock.origin = true
    expect((await PATCH(new Request('https://example.com', { method: 'PATCH', body: JSON.stringify({ action: 'delete', revision: 0 }) }))).status).toBe(400)
    expect(mock.change).not.toHaveBeenCalled()
  })
  it('does not reveal internal database failures', async () => {
    mock.read.mockRejectedValue(new Error('Database secret details'))
    const response = await GET()
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('Database secret details')
  })
  it('returns private uncached state to authorized staff', async () => {
    const response = await GET()
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ state: initialFaqHeroState(), canEdit: true })
  })
})
