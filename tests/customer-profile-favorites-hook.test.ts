import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ slots: [] as unknown[], index: 0, effects: [] as Array<() => void | (() => void)>, capture: true }))
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = h.index++
    if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial
    return [h.slots[index], (value: unknown) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value }]
  },
  useEffect: (effect: () => void | (() => void)) => { if (h.capture) h.effects.push(effect) },
}))
let cleanups: Array<() => void> = []
beforeEach(() => {
  vi.resetModules(); h.slots = []; h.index = 0; h.effects = []; h.capture = true; cleanups = []
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(), localStorage: { getItem: () => { throw new Error('Guest storage must not be used in an account') } } })
})
afterEach(() => { cleanups.forEach((cleanup) => cleanup()); vi.unstubAllGlobals() })
async function mount() {
  const { useCustomerFavorites } = await import('@/lib/customer-account')
  const render = () => { h.index = 0; return useCustomerFavorites({ accountOnly: true }) }
  render()
  for (const effect of h.effects.splice(0)) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup) }
  h.capture = false
  await vi.waitFor(() => expect(h.slots[1]).toBe(false))
  return { render }
}
it('actually loads the preview/account set even when auth/me would identify a staff-only account', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ favorites: ['preview-owned-tour'] }))
  vi.stubGlobal('fetch', fetch)
  const { render } = await mount()
  expect(render()).toMatchObject({ slugs: ['preview-owned-tour'], loading: false, error: '' })
  expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/account/favorites'])
})
it('settles an account API failure as an error, never as a successful guest-local set', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 503 })))
  const { render } = await mount()
  const result = render()
  expect(result.slugs).toEqual([])
  expect(result.error).toBe('Could not load saved trips.')
  expect(result.loading).toBe(false)
  result.retry()
  expect(h.slots[3]).toBe(1)
})
