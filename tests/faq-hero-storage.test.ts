import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ db: { siteSetting: mock } }))
import { changeFaqHero, readFaqHeroState } from '@/lib/server/faq-hero'
import { FAQ_HERO_KEY, initialFaqHeroState, originalFaqHero } from '@/lib/faq-hero'
import { originalEditorialHero } from '@/lib/editorial-hero-definitions'
beforeEach(() => { mock.findUnique.mockReset().mockResolvedValue(null); mock.updateMany.mockReset().mockResolvedValue({ count: 1 }); mock.create.mockReset().mockResolvedValue({}) })
describe('FAQ persistence with mocked Prisma only', () => {
  it('keeps destination storage and restore independent from FAQ', async () => {
    const state = await changeFaqHero('restore', 0, undefined, 'destinations')
    expect(mock.findUnique.mock.calls[0][0].where.key).toBe('cms.hero.destinations.v1')
    expect(mock.create.mock.calls[0][0].data.key).toBe('cms.hero.destinations.v1')
    expect(state.published).toEqual(originalEditorialHero('destinations'))
    expect(state.published).not.toEqual(originalFaqHero())
  })
  it('does not initialize records while reading original content', async () => {
    expect(await readFaqHeroState()).toEqual(initialFaqHeroState())
    expect(mock.create).not.toHaveBeenCalled()
    expect(mock.updateMany).not.toHaveBeenCalled()
  })
  it('creates only the private FAQ key on explicit save', async () => {
    await changeFaqHero('save-draft', 0, originalFaqHero())
    expect(mock.create.mock.calls[0][0].data.key).toBe(FAQ_HERO_KEY)
  })
  it('rejects stale and concurrent edits', async () => {
    mock.findUnique.mockResolvedValue({ value: JSON.stringify({ ...initialFaqHeroState(), revision: 2 }) })
    await expect(changeFaqHero('save-draft', 1, originalFaqHero())).rejects.toThrow('Reload')
    expect(mock.updateMany).not.toHaveBeenCalled()
    mock.updateMany.mockResolvedValue({ count: 0 })
    await expect(changeFaqHero('save-draft', 2, originalFaqHero())).rejects.toThrow('Reload')
  })
  it('does not overwrite a simultaneous first insert', async () => {
    mock.create.mockRejectedValue({ code: 'P2002' })
    await expect(changeFaqHero('save-draft', 0, originalFaqHero())).rejects.toThrow('Reload')
  })
})
