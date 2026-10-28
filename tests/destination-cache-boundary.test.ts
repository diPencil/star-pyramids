import { afterEach, beforeEach, expect, it, vi } from 'vitest'

// Run the real cache through its hooks without a DOM or network.
vi.mock('react', () => ({ useState: () => [0, vi.fn()], useEffect: (effect: () => unknown) => { effect() }, useMemo: (factory: () => unknown) => factory() }))
vi.mock('@/lib/use-catalogue-language', () => ({ useCatalogueLanguage: (rows: unknown) => rows }))
const row = (slug: string) => ({ slug, title: slug, isPublished: slug !== 'draft', detail: '{}' })
beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

it('never substitutes bootstrap records when the public database is empty or fails', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ destinations: [] })).mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
  vi.stubGlobal('fetch', fetcher)
  const cache = await import('@/lib/catalogue-client')
  const bootstrap = [{ ...row('bootstrap'), image: '', copy: '', detail: { heroImage: '', heroAlt: '', eyebrow: '', intro: '', facts: [], bestFor: [], experiences: [], rhythm: [], practical: [], tourSlugs: [] } }]
  expect(cache.useDbDestinations(bootstrap)).toEqual([])
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(cache.useDbDestinations(bootstrap)).toEqual([])
  cache.invalidateCatalogueCache()
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(cache.useDbDestinations(bootstrap)).toEqual([])
})

it('keeps private destination rows separate when navigating to public content', async () => {
  const fetcher = vi.fn().mockImplementation(async (url: string) => Response.json({ destinations: url.includes('admin=1') ? [row('public'), row('draft')] : [row('public')] }))
  vi.stubGlobal('fetch', fetcher)
  const cache = await import('@/lib/catalogue-client')
  cache.useDbDestinationsStatus()
  await vi.waitFor(() => expect(cache.useDbDestinationsStatus().data).toHaveLength(2))
  cache.useDbDestinations([])
  await vi.waitFor(() => expect(cache.useDbDestinations([]).map(item => item.slug)).toEqual(['public']))
  expect(fetcher).toHaveBeenCalledWith('/api/destinations?admin=1', expect.objectContaining({ cache: 'no-store' }))
  expect(fetcher).toHaveBeenCalledWith('/api/destinations', expect.objectContaining({ cache: 'no-store' }))
})

it('ignores an old response after a publication change invalidates the catalogue', async () => {
  let finishOld!: (response: Response) => void
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finishOld = resolve }))
    .mockResolvedValueOnce(Response.json({ destinations: [] }))
  vi.stubGlobal('fetch', fetcher)
  const cache = await import('@/lib/catalogue-client')
  cache.useDbDestinations([])
  cache.invalidateCatalogueCache()
  cache.useDbDestinations([])
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  // Allow the post-invalidation response to settle before the stale response.
  await new Promise(resolve => setTimeout(resolve, 0))
  finishOld(Response.json({ destinations: [row('unpublished-since-request')] }))
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(cache.useDbDestinations([])).toEqual([])
  expect(fetcher).toHaveBeenCalledTimes(2)
})
