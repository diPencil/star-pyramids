import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ db: { siteSetting: mock } }))
import { changeHero, HeroConflictError } from '@/lib/server/website-heroes'
import { initialHeroState, originalHomeHero } from '@/lib/website-heroes'
beforeEach(() => { mock.findUnique.mockReset().mockResolvedValue(null); mock.updateMany.mockReset().mockResolvedValue({ count: 1 }); mock.create.mockReset().mockResolvedValue({}) })
describe('hero compare-and-swap persistence with mocked database', () => {
  it('inserts only after an explicit draft action', async () => {
    const state = await changeHero('save-draft', 0, originalHomeHero())
    expect(state.revision).toBe(1)
    expect(mock.create).toHaveBeenCalledOnce()
    expect(mock.updateMany).not.toHaveBeenCalled()
  })
  it('rejects stale editors before writing', async () => {
    mock.findUnique.mockResolvedValue({ value: JSON.stringify({ ...initialHeroState(), revision: 4 }) })
    await expect(changeHero('save-draft', 3, originalHomeHero())).rejects.toBeInstanceOf(HeroConflictError)
    expect(mock.create).not.toHaveBeenCalled()
    expect(mock.updateMany).not.toHaveBeenCalled()
  })
  it('detects a concurrent update between reading and saving', async () => {
    mock.findUnique.mockResolvedValue({ value: JSON.stringify(initialHeroState()) })
    mock.updateMany.mockResolvedValue({ count: 0 })
    await expect(changeHero('save-draft', 0, originalHomeHero())).rejects.toBeInstanceOf(HeroConflictError)
    expect(mock.updateMany.mock.calls[0][0].where.value).toBe(JSON.stringify(initialHeroState()))
  })
  it('turns a simultaneous first insert into a conflict instead of overwriting', async () => {
    mock.create.mockRejectedValue({ code: 'P2002' })
    await expect(changeHero('save-draft', 0, originalHomeHero())).rejects.toBeInstanceOf(HeroConflictError)
  })
})
