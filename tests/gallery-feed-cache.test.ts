import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const sample = (id: string) => ({ id, mediaUrl: `/${id}.jpg`, mediaType: 'IMAGE', title: id, isPublished: true, showOnHomepage: true })
beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())
it('coalesces concurrent reads and retains real successful gallery results', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [sample('saved')] }))
  vi.stubGlobal('fetch', fetcher)
  const { fetchHomepage } = await import('@/lib/journey-gallery-client')
  const [a, b] = await Promise.all([fetchHomepage(), fetchHomepage()])
  expect(a).toEqual(b); expect(a[0].id).toBe('saved'); await fetchHomepage(); expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][1].cache).toBe('no-store')
})
it('never caches backend-unavailable or network errors as a successful empty gallery', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ items: [], unavailable: true })).mockResolvedValueOnce(Response.json({ items: [sample('recovered')] }))
  vi.stubGlobal('fetch', fetcher)
  const { fetchHomepage } = await import('@/lib/journey-gallery-client')
  expect(await fetchHomepage()).toEqual([]); expect((await fetchHomepage())[0].id).toBe('recovered'); expect(fetcher).toHaveBeenCalledTimes(2)
})
it('does not let a pre-invalidation response overwrite freshly published data', async () => {
  let finishOld!: (value: Response) => void
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finishOld = resolve })).mockResolvedValueOnce(Response.json({ items: [sample('new')] }))
  vi.stubGlobal('fetch', fetcher)
  const { fetchHomepage, invalidateJourneyGalleryCache } = await import('@/lib/journey-gallery-client')
  const old = fetchHomepage(); invalidateJourneyGalleryCache()
  expect((await fetchHomepage())[0].id).toBe('new')
  finishOld(Response.json({ items: [sample('stale')] })); await old
  expect((await fetchHomepage())[0].id).toBe('new'); expect(fetcher).toHaveBeenCalledTimes(2)
})
