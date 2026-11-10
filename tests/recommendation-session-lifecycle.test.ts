import { afterEach, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({ state: undefined as unknown, effects: [] as Array<() => void> }))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    if (hooks.state === undefined) hooks.state = typeof initial === 'function' ? initial() : initial
    return [hooks.state, (value: unknown) => { hooks.state = value }]
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void) => { hooks.effects.push(effect) },
}))
afterEach(() => { vi.unstubAllGlobals(); hooks.state = undefined; hooks.effects.length = 0 })

it('stores only session randomness and selected slugs, restoring choices immediately on a client remount', async () => {
  vi.resetModules()
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
  vi.stubGlobal('window', { sessionStorage: storage, crypto: { getRandomValues: (value: Uint32Array) => { value[0] = 73; return value } } })
  const { useRecommendationSession, RECOMMENDATION_SESSION_KEY, readRecommendationSession } = await import('@/lib/home/homepage-recommendation-session')
  expect(useRecommendationSession().session).toBeNull()
  hooks.effects[0]()
  const ready = useRecommendationSession()
  expect(ready.session?.seed).toBe(73)
  ready.remember(['one', 'two', 'three', 'four', 'five', 'six'])
  const saved = JSON.parse(values.get(RECOMMENDATION_SESSION_KEY)!)
  expect(Object.keys(saved).sort()).toEqual(['seed', 'slugs'])
  expect(saved.slugs).toEqual(['one', 'two', 'three', 'four', 'five', 'six'])
  // A new mount gets memory immediately; a fresh JS load can read the same storage.
  hooks.state = undefined
  expect(useRecommendationSession().session).toEqual(saved)
  expect(readRecommendationSession(storage, () => 999)).toEqual(saved)
})

it('keeps the same in-memory choices when storage reads work but writes are blocked', async () => {
  vi.resetModules()
  const random = vi.fn((value: Uint32Array) => { value[0] = 123; return value })
  vi.stubGlobal('window', { sessionStorage: { getItem: () => null, setItem: () => { throw Error('Quota exceeded') } }, crypto: { getRandomValues: random } })
  const { useRecommendationSession } = await import('@/lib/home/homepage-recommendation-session')
  useRecommendationSession(); hooks.effects[0]()
  useRecommendationSession().remember(['saved-tour'])
  hooks.state = undefined
  const restored = useRecommendationSession()
  hooks.effects[hooks.effects.length - 1]()
  expect(restored.session).toEqual({ seed: 123, slugs: ['saved-tour'] })
  expect(random).toHaveBeenCalledTimes(1)
})
