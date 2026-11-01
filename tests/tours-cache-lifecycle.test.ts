import { afterEach, expect, it, vi } from 'vitest'

const effects = vi.hoisted(() => [] as Array<() => void | (() => void)>)
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => [initial, vi.fn()],
  useMemo: (fn: () => unknown) => fn(),
  useEffect: (effect: () => void | (() => void)) => { effects.push(effect) },
}))
afterEach(() => { vi.unstubAllGlobals(); effects.length = 0 })

it('revalidates on foreground/focus with one shared subscription and removes listeners after the last consumer', async () => {
  const win = new EventTarget()
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  vi.stubGlobal('window', win); vi.stubGlobal('document', doc)
  let rows = [{ slug: 'first', status: 'published' }]
  const request = vi.fn(async () => ({ ok: true, json: async () => ({ tours: rows }) }))
  vi.stubGlobal('fetch', request)
  const { useDbTours, fetchDbTours } = await import('@/lib/tours-client')
  useDbTours([], { includeNew: true })
  const releaseFirst = effects[0]()!
  useDbTours([], { includeNew: true })
  const releaseSecond = effects[1]()!
  await vi.waitFor(async () => expect((await fetchDbTours())?.size).toBe(1))
  expect(request).toHaveBeenCalledTimes(1)
  releaseFirst()
  rows = [...rows, { slug: 'published-in-another-tab', status: 'published' }]
  win.dispatchEvent(new Event('focus'))
  await vi.waitFor(async () => expect((await fetchDbTours())?.size).toBe(2))
  expect(request).toHaveBeenCalledTimes(2)
  doc.visibilityState = 'hidden'
  doc.dispatchEvent(new Event('visibilitychange')); win.dispatchEvent(new Event('focus'))
  expect(request).toHaveBeenCalledTimes(2)
  doc.visibilityState = 'visible'
  doc.dispatchEvent(new Event('visibilitychange'))
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(3))
  releaseSecond()
  win.dispatchEvent(new Event('focus')); doc.dispatchEvent(new Event('visibilitychange'))
  expect(request).toHaveBeenCalledTimes(3)
})
