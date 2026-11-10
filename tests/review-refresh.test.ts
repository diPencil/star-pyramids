import { afterEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ setup: null as null | (() => () => void), ref: { current: () => {} } }))
vi.mock('react', () => ({ useRef: () => hooks.ref, useEffect: (setup: () => () => void) => { hooks.setup ??= setup } }))
import { useReviewRefresh } from '@/lib/reviews/use-review-refresh'
afterEach(() => { hooks.setup = null; vi.unstubAllGlobals() })
it('reloads published reviews on visible return, uses the latest callback and cleans up listeners', () => {
  const win = new EventTarget(), doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  vi.stubGlobal('window', win); vi.stubGlobal('document', doc)
  const first = vi.fn(), latest = vi.fn()
  useReviewRefresh(first); const release = hooks.setup!()
  win.dispatchEvent(new Event('focus')); expect(first).toHaveBeenCalledOnce()
  doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); expect(first).toHaveBeenCalledOnce()
  useReviewRefresh(latest, false); doc.visibilityState = 'visible'; win.dispatchEvent(new Event('focus'))
  expect(latest).not.toHaveBeenCalled() // An open writing form must not be unmounted by a feed reload.
  useReviewRefresh(latest); doc.dispatchEvent(new Event('visibilitychange'))
  expect(latest).toHaveBeenCalledOnce(); expect(first).toHaveBeenCalledOnce()
  release(); win.dispatchEvent(new Event('focus')); doc.dispatchEvent(new Event('visibilitychange'))
  expect(latest).toHaveBeenCalledOnce()
})
