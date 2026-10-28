import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as { deps: unknown[]; cleanup?: () => void }[], effect: 0, fetch: vi.fn() }))
vi.mock('react', () => ({
  useState: (initial: any) => { const slot = h.cursor++; if (!(slot in h.slots)) h.slots[slot] = typeof initial === 'function' ? initial() : initial; return [h.slots[slot], (next: any) => { h.slots[slot] = typeof next === 'function' ? next(h.slots[slot]) : next }] },
  useRef: (initial: any) => { const slot = h.cursor++; if (!(slot in h.slots)) h.slots[slot] = { current: initial }; return h.slots[slot] },
  useCallback: (fn: any, deps: unknown[]) => { const slot = h.cursor++; const previous = h.slots[slot]; if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) h.slots[slot] = { value: fn, deps }; return h.slots[slot].value },
  useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => { const index = h.effect++, previous = h.effects[index]; if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) { previous?.cleanup?.(); h.effects[index] = { deps, cleanup: effect() } } },
}))
import { useCustomerNotifications } from '@/lib/customer-notifications'
const personal = { id: 'booking-event', type: 'booking_created', title: 'Real booking', message: 'Received', createdAt: '2026-10-28T00:00:00Z', href: '/account/bookings', readAt: null }
const render = () => { h.cursor = 0; h.effect = 0; return useCustomerNotifications() }
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
const resetState = () => { h.effects.forEach(effect => effect.cleanup?.()); h.slots = []; h.effects = []; h.cursor = 0; h.effect = 0 }
beforeEach(() => {
  resetState(); vi.clearAllMocks()
  vi.stubGlobal('window', Object.assign(new EventTarget(), { setInterval: vi.fn(() => 1), clearInterval: vi.fn() }))
  vi.stubGlobal('fetch', h.fetch)
})
afterEach(() => { resetState(); vi.unstubAllGlobals() })
it('keeps personal read success when optional marketing is unavailable', async () => {
  h.fetch.mockResolvedValueOnce(Response.json({ notifications: [personal], unreadCount: 1, marketingUnavailable: true }))
    .mockResolvedValueOnce(Response.json({ ok: true, marketingUnavailable: true }))
    .mockResolvedValueOnce(Response.json({ notifications: [{ ...personal, readAt: '2026-10-28T01:00:00Z' }], unreadCount: 0, marketingUnavailable: true }))
  render(); await settle()
  expect(render().notifications[0].id).toBe('booking-event')
  expect(await render().markRead('booking-event')).toBe(true)
  await settle()
  expect(render().unreadCount).toBe(0)
  expect(render().loadError).toBe('')
})
it('reports partial read-all failures without fabricating successful marketing reads', async () => {
  h.fetch.mockResolvedValueOnce(Response.json({ notifications: [personal], unreadCount: 1 }))
    .mockResolvedValueOnce(Response.json({ ok: true, marketingUnavailable: true }))
    .mockResolvedValueOnce(Response.json({ notifications: [], unreadCount: 0, marketingUnavailable: true }))
  render(); await settle()
  expect(await render().markAllRead()).toBe(false)
})
it('never seeds a new session with the previous customer cache or accepts a late old response', async () => {
  let old!: (response: Response) => void
  h.fetch.mockImplementationOnce(() => new Promise<Response>(resolve => { old = resolve }))
    .mockResolvedValueOnce(Response.json({ notifications: [], unreadCount: 0 }))
  render()
  resetState()
  expect(render().notifications).toEqual([])
  await settle()
  old(Response.json({ notifications: [personal], unreadCount: 1 })); await settle()
  expect(render().notifications).toEqual([])
})
