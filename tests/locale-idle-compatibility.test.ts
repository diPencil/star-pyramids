import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const effects = vi.hoisted(() => [] as Array<() => void | (() => void)>)
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useContext: () => ({ locale: 'en', preview: false }),
  useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, vi.fn()],
  useCallback: (callback: unknown) => callback,
  useEffect: (callback: () => void | (() => void)) => { effects.push(callback) },
  startTransition: (callback: () => void) => callback(),
}))
vi.mock('@/lib/storefront-settings', () => ({ ensureStorefrontSettings: vi.fn(), getDbCurrency: () => null, getDbLocalization: () => null }))
import { LocaleProvider } from '@/components/locale'
const addEventListener = vi.fn(); const removeEventListener = vi.fn()
beforeEach(() => {
  effects.length = 0; vi.useFakeTimers(); addEventListener.mockReset(); removeEventListener.mockReset()
  vi.stubGlobal('window', { setTimeout, clearTimeout, addEventListener, removeEventListener, location: { protocol: 'https:' }, localStorage: { getItem: () => null } })
  vi.stubGlobal('document', { cookie: '', documentElement: {} })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('mounts and cleans up language/currency initialization without Safari idle APIs', () => {
  LocaleProvider({ children: null })
  let cleanup: void | (() => void)
  expect(() => { cleanup = effects[0]() }).not.toThrow()
  expect(addEventListener).toHaveBeenCalledWith('sp-currency', expect.any(Function))
  expect(() => vi.runAllTimers()).not.toThrow()
  expect(() => cleanup!()).not.toThrow()
  expect(removeEventListener).toHaveBeenCalledWith('sp-l10n', expect.any(Function))
})
it('keeps native idle scheduling when both APIs are supported', () => {
  const request = vi.fn().mockReturnValue(42); const cancel = vi.fn()
  Object.assign(window, { requestIdleCallback: request, cancelIdleCallback: cancel })
  LocaleProvider({ children: null })
  const cleanup = effects[0]()
  expect(request).toHaveBeenCalledWith(expect.any(Function))
  expect(() => request.mock.calls[0][0]()).not.toThrow()
  expect(typeof cleanup).toBe('function'); if (cleanup) cleanup()
  expect(cancel).toHaveBeenCalledWith(42)
})
it('cancels deferred initialization if the provider unmounts first', () => {
  LocaleProvider({ children: null })
  const cleanup = effects[0]()
  expect(vi.getTimerCount()).toBe(1)
  if (cleanup) cleanup()
  expect(vi.getTimerCount()).toBe(0)
})
it('uses the fallback for partial idle API implementations', () => {
  const request = vi.fn()
  Object.assign(window, { requestIdleCallback: request })
  LocaleProvider({ children: null })
  const cleanup = effects[0]()
  expect(request).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(1)
  if (cleanup) cleanup()
})
