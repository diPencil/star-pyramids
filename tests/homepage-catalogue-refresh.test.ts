import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const effects = vi.hoisted(() => [] as Array<() => void | (() => void)>)
vi.mock('react', () => ({ useState: () => [0, vi.fn()], useEffect: (effect: () => void | (() => void)) => { effects.push(effect) }, useMemo: (fn: () => unknown) => fn() }))
vi.mock('@/lib/catalogue/use-catalogue-language', () => ({ useCatalogueLanguage: (rows: unknown) => rows }))
beforeEach(() => { vi.resetModules(); effects.length = 0 })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

const kinds = ['destinations', 'blogs', 'offers'] as const
async function client(kind: typeof kinds[number]) {
  if (kind === 'destinations') {
    const module = await import('@/lib/catalogue/catalogue-client')
    return { read: () => module.useDbDestinations([]), invalidate: module.invalidateCatalogueCache }
  }
  const module = await import('@/lib/catalogue/offers-blogs-client')
  return { read: () => kind === 'blogs' ? module.useDbBlogs([]) : module.useDbOffers([]), invalidate: module.invalidateOffersBlogsCache }
}
const makeRow = (slug: string) => ({ slug, title: slug, image: '', copy: 'Source copy', isPublished: true, detail: {}, content: {} })
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)) }

describe.each(kinds)('%s catalogue freshness', kind => {
  it('does not install an in-flight public refresh after entering an editor', async () => {
    const win = Object.assign(new EventTarget(), { location: { pathname: '/' } })
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    vi.stubGlobal('window', win); vi.stubGlobal('document', doc)
    let finish!: (response: Response) => void
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ [kind]: [makeRow('current-editor-snapshot')] }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', fetcher)
    const cache = await client(kind)
    cache.read(); const release = effects[0]()!
    await vi.waitFor(() => expect(cache.read()).toHaveLength(1))
    win.dispatchEvent(new Event('focus'))
    win.location.pathname = '/admin/example/new'
    finish(Response.json({ [kind]: [makeRow('background-replacement')] })); await settle()
    expect(cache.read()[0]?.slug).toBe('current-editor-snapshot')
    release()
  })
  it('does not background-refresh editor snapshots and overwrite unsaved form input', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
    const win = Object.assign(new EventTarget(), { location: { pathname: '/admin/example/new' } })
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    vi.stubGlobal('window', win); vi.stubGlobal('document', doc)
    const fetcher = vi.fn(async () => Response.json({ [kind]: [makeRow('editing')] }))
    vi.stubGlobal('fetch', fetcher)
    const cache = await client(kind)
    cache.read(); const release = effects[0]()!
    await vi.waitFor(() => expect(cache.read()).toHaveLength(1))
    clock.mockReturnValue(60_000)
    win.dispatchEvent(new Event('focus')); doc.dispatchEvent(new Event('visibilitychange'))
    cache.read(); const releaseOther = effects[effects.length - 1]()!
    expect(fetcher).toHaveBeenCalledTimes(1)
    release(); releaseOther()
  })
  it('refreshes on foreground, retains data on failure and removes the subscription after the last consumer', async () => {
    const win = new EventTarget(), doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    vi.stubGlobal('window', win); vi.stubGlobal('document', doc)
    let rows = [makeRow('original')], offline = false
    const fetcher = vi.fn(async () => { if (offline) throw Error('Offline'); return Response.json({ [kind]: rows }) })
    vi.stubGlobal('fetch', fetcher)
    const cache = await client(kind)
    cache.read(); const releaseFirst = effects[0]()!
    cache.read(); const releaseSecond = effects[1]()!
    await vi.waitFor(() => expect(cache.read()).toHaveLength(1))
    expect(fetcher).toHaveBeenCalledTimes(1)
    releaseFirst()
    rows = [makeRow('newly-published')]
    win.dispatchEvent(new Event('focus')); doc.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(cache.read()[0]?.slug).toBe('newly-published'))
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher).toHaveBeenLastCalledWith('/api/' + kind, expect.objectContaining({ cache: 'no-store' }))
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); win.dispatchEvent(new Event('focus'))
    expect(fetcher).toHaveBeenCalledTimes(2)
    doc.visibilityState = 'visible'; offline = true; win.dispatchEvent(new Event('focus')); await settle()
    expect(cache.read()[0]?.slug).toBe('newly-published')
    releaseSecond()
    const count = fetcher.mock.calls.length
    win.dispatchEvent(new Event('focus')); doc.dispatchEvent(new Event('visibilitychange'))
    expect(fetcher).toHaveBeenCalledTimes(count)
  })
  it('revalidates a stale cache on mounting without replacing fresh data with bootstrap rows', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
    let rows = [makeRow('first')]
    const fetcher = vi.fn(async () => Response.json({ [kind]: rows }))
    vi.stubGlobal('fetch', fetcher)
    const cache = await client(kind)
    cache.read(); effects[0]()
    await vi.waitFor(() => expect(cache.read()).toHaveLength(1))
    rows = [makeRow('new')]
    cache.read(); effects[effects.length - 1]()
    expect(fetcher).toHaveBeenCalledTimes(1)
    clock.mockReturnValue(31_001)
    cache.read(); effects[effects.length - 1]()
    await vi.waitFor(() => expect(cache.read()[0]?.slug).toBe('new'))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('discards a response from before invalidation instead of resurrecting an unavailable record', async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve })).mockResolvedValueOnce(Response.json({ [kind]: [] }))
    vi.stubGlobal('fetch', fetcher)
    const cache = await client(kind)
    cache.read(); effects[0]()
    cache.invalidate(); await settle()
    finish(Response.json({ [kind]: [makeRow('unpublished-since-request')] })); await settle()
    expect(cache.read()).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
