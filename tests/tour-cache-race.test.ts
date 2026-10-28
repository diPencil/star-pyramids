import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchDbTours, invalidateToursCache } from '@/lib/tours-client'
afterEach(() => { vi.unstubAllGlobals(); invalidateToursCache() })
describe('public tour catalogue cache generation', () => {
  it('never lets a late pre-unpublish response overwrite the refreshed catalogue', async () => {
    invalidateToursCache()
    let release!: (response: unknown) => void
    const old = new Promise(resolve => { release = resolve })
    const fetch = vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce({ ok: true, json: async () => ({ tours: [] }) })
    vi.stubGlobal('fetch', fetch)
    const previous = fetchDbTours()
    invalidateToursCache()
    expect((await fetchDbTours())?.size).toBe(0)
    release({ ok: true, json: async () => ({ tours: [{ slug: 'unpublished-tour', title: 'Old title', category: 'one-day-tours', price: 10, status: 'published' }] }) })
    expect(await previous).toBeNull()
    expect((await fetchDbTours())?.size).toBe(0)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
