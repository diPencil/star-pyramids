import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('public tour catalogue freshness', () => {
  it('reuses a fresh catalogue but reloads it after its freshness window', async () => {
    vi.resetModules()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
    let rows = [{ slug: 'original', title: 'Original', status: 'published' }]
    const request = vi.fn(async () => ({ ok: true, json: async () => ({ tours: rows }) }))
    vi.stubGlobal('fetch', request)
    const { fetchDbTours } = await import('@/lib/tours/tours-client')
    expect((await fetchDbTours())?.size).toBe(1)
    rows = [...rows, { slug: 'newly-published', title: 'New', status: 'published' }]
    expect((await fetchDbTours())?.size).toBe(1)
    expect(request).toHaveBeenCalledTimes(1)
    clock.mockReturnValue(31_001)
    expect((await fetchDbTours())?.size).toBe(2)
    expect(request).toHaveBeenCalledTimes(2)
  })
  it('preserves loaded records when a revalidation fails', async () => {
    vi.resetModules()
    const request = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ tours: [{ slug: 'saved', status: 'published' }] }) }).mockRejectedValueOnce(new Error('Offline'))
    vi.stubGlobal('fetch', request)
    const { fetchDbTours } = await import('@/lib/tours/tours-client')
    expect((await fetchDbTours())?.size).toBe(1)
    expect(await fetchDbTours({ force: true })).toBeNull()
    expect((await fetchDbTours())?.has('saved')).toBe(true)
  })
  it('refreshes newly published records without losing the current catalogue during the request', async () => {
    vi.resetModules()
    let rows = Array.from({ length: 9 }, (_, i) => ({ slug: `tour-${i}`, title: `Tour ${i}`, category: 'one-day-tours', status: 'published', price: '90', detail: null, dayDetail: { overview: 'Description' } }))
    const request = vi.fn(async () => ({ ok: true, json: async () => ({ tours: rows }) }))
    vi.stubGlobal('fetch', request)
    const { fetchDbTours } = await import('@/lib/tours/tours-client')
    expect((await fetchDbTours())?.size).toBe(9)
    rows = [...rows, ...Array.from({ length: 3 }, (_, i) => ({ ...rows[0], slug: `new-${i}` }))]
    expect((await fetchDbTours({ force: true }))?.size).toBe(12)
    expect(request).toHaveBeenLastCalledWith('/api/tours?full=1', expect.objectContaining({ cache: 'no-store' }))
  })
})
