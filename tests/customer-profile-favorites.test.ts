import { afterEach, expect, it, vi } from 'vitest'
import { fetchAccountFavoriteSlugs } from '@/lib/account/customer-account'

afterEach(() => vi.unstubAllGlobals())
it('loads account/preview favorites directly from the owner-scoped endpoint, never auth/me or local storage', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ favorites: ['cairo', 'giza'] }))
  vi.stubGlobal('fetch', fetch)
  vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('Must not read guest favorites') } } })
  expect(await fetchAccountFavoriteSlugs()).toEqual(['cairo', 'giza'])
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/account/favorites', { credentials: 'same-origin', cache: 'no-store' })
})
it.each([401, 403, 429, 503])('does not present local favorites or a false empty success on HTTP %i', async (status) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'private provider details' }, { status })))
  await expect(fetchAccountFavoriteSlugs()).rejects.toThrow('Could not load saved trips.')
})
it('allows retry after a network failure without caching a false guest verdict', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({ favorites: ['recovered'] }))
  vi.stubGlobal('fetch', fetch)
  await expect(fetchAccountFavoriteSlugs()).rejects.toThrow()
  expect(await fetchAccountFavoriteSlugs()).toEqual(['recovered'])
})
it.each([{ favorites: null }, { favorites: ['valid', 5] }, {}])('rejects malformed account data instead of returning a misleading empty list', async (payload) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)))
  await expect(fetchAccountFavoriteSlugs()).rejects.toThrow('Could not load saved trips.')
})
it('deduplicates simultaneous card loads but refetches after settlement for a fresh account context', async () => {
  let finish!: (response: Response) => void
  const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve }))
    .mockResolvedValueOnce(Response.json({ favorites: ['other-customer'] }))
  vi.stubGlobal('fetch', fetch)
  const first = fetchAccountFavoriteSlugs(), second = fetchAccountFavoriteSlugs()
  expect(first).toBe(second)
  finish(Response.json({ favorites: ['first-customer'] }))
  expect(await first).toEqual(['first-customer'])
  expect(await second).toEqual(['first-customer'])
  expect(await fetchAccountFavoriteSlugs()).toEqual(['other-customer'])
  expect(fetch).toHaveBeenCalledTimes(2)
})
