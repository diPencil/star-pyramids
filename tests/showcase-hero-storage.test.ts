import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ db: { siteSetting: mock } }))
import { readShowcaseState, changeShowcaseHero, readPublicShowcase } from '@/lib/server/showcase-heroes'
import { initialShowcaseState, originalShowcaseHero, SHOWCASE_HERO_IDS } from '@/lib/showcase-heroes'
beforeEach(() => { mock.findUnique.mockReset().mockResolvedValue(null); mock.updateMany.mockReset().mockResolvedValue({ count: 1 }); mock.create.mockReset().mockResolvedValue({}) })
describe('showcase persistence with mocked Prisma only', () => {
  it('does not insert defaults on reads for any hero', async () => {
    for (const id of SHOWCASE_HERO_IDS) expect(await readShowcaseState(id)).toEqual(initialShowcaseState())
    expect(mock.create).not.toHaveBeenCalled(); expect(mock.updateMany).not.toHaveBeenCalled()
  })
  it('uses separate stable keys and never writes another page', async () => {
    for (const id of SHOWCASE_HERO_IDS) await changeShowcaseHero(id, 'save-draft', 0, originalShowcaseHero(id))
    expect(new Set(mock.create.mock.calls.map(([arg]) => arg.data.key)).size).toBe(SHOWCASE_HERO_IDS.length)
    expect(mock.create.mock.calls[0][0].data.key).toBe('cms.hero.showcase.about.v1')
  })
  it('rejects stale revisions and concurrent updates', async () => {
    mock.findUnique.mockResolvedValue({ value: JSON.stringify({ ...initialShowcaseState(), revision: 2 }) })
    await expect(changeShowcaseHero('about', 'save-draft', 1, originalShowcaseHero('about'))).rejects.toThrow('Reload')
    expect(mock.updateMany).not.toHaveBeenCalled()
    mock.updateMany.mockResolvedValue({ count: 0 })
    await expect(changeShowcaseHero('about', 'save-draft', 2, originalShowcaseHero('about'))).rejects.toThrow('Reload')
  })
  it('preserves another editor first insert', async () => {
    mock.create.mockRejectedValue({ code: 'P2002' })
    await expect(changeShowcaseHero('about', 'save-draft', 0, originalShowcaseHero('about'))).rejects.toThrow('Reload')
  })
  it('does not substitute hardcoded content after a database failure', async () => {
    mock.findUnique.mockRejectedValue(new Error('Internal details'))
    expect(await readPublicShowcase('about')).toEqual({ hidden: false, content: null, unavailable: true })
  })
})
