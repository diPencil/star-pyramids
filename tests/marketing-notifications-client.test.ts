import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as { deps: unknown[]; cleanup?: () => void }[], effect: 0, fetch: vi.fn(), invalidate: vi.fn() }))
vi.mock('react', () => ({
  useState: (initial: any) => { const slot = h.cursor++; if (!(slot in h.slots)) h.slots[slot] = typeof initial === 'function' ? initial() : initial; return [h.slots[slot], (next: any) => { h.slots[slot] = typeof next === 'function' ? next(h.slots[slot]) : next }] },
  useRef: (initial: any) => { const slot = h.cursor++; if (!(slot in h.slots)) h.slots[slot] = { current: initial }; return h.slots[slot] },
  useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => { const index = h.effect++, previous = h.effects[index]; if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) { previous?.cleanup?.(); h.effects[index] = { deps, cleanup: effect() } } },
}))
vi.mock('@/lib/customer-notifications', () => ({ invalidateNotifications: h.invalidate }))
import { useMarketingNotifications } from '@/lib/marketing-notifications-client'
const item = (letter = 'a') => ({ id: 'marketing:offer:' + letter.repeat(32), type: 'offer_available', title: 'Current offer', message: 'Real offer', href: '/special-offers/current', readAt: null, expiresAt: null, createdAt: '2026-10-28T00:00:00Z', localized: {} })
const render = (owner: string | null | undefined) => { h.cursor = 0; h.effect = 0; return useMarketingNotifications(owner) }
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
beforeEach(() => {
  h.slots = []; h.effects = []; h.cursor = 0; h.effect = 0; vi.clearAllMocks()
  const events = new EventTarget()
  vi.stubGlobal('window', Object.assign(events, { setInterval: vi.fn(() => 1), clearInterval: vi.fn() }))
  const stored = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) })
  vi.stubGlobal('fetch', h.fetch)
})
afterEach(() => { h.effects.forEach(effect => effect.cleanup?.()); vi.unstubAllGlobals() })
it('does not fetch until auth settles and loads only real guest offers without caching', async () => {
  h.fetch.mockResolvedValue(Response.json({ notifications: [item()] }))
  expect(render(undefined).items).toEqual([]); expect(h.fetch).not.toHaveBeenCalled()
  render(null); await settle()
  const state = render(null)
  expect(state.items).toHaveLength(1)
  expect(h.fetch).toHaveBeenCalledWith('/api/marketing-notifications', expect.objectContaining({ cache: 'no-store' }))
  await state.markRead(item().id)
  expect(render(null).unreadCount).toBe(0)
  expect(h.fetch).toHaveBeenCalledTimes(1)
})
it('rejects old responses when a session changes and never exposes prior guest/customer state', async () => {
  let finish!: (response: Response) => void
  h.fetch.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve })).mockResolvedValueOnce(Response.json({ notifications: [{ ...item('b'), readAt: '2026-10-28T01:00:00Z' }] }))
  render(null); expect(render('customer-b').items).toEqual([])
  await settle(); finish(Response.json({ notifications: [item('a')] })); await settle()
  expect(render('customer-b').items.map(row => row.id)).toEqual([item('b').id])
  expect(render('customer-b').unreadCount).toBe(0)
})
it('uses authenticated owner read marking and never marks personal notifications from the public bell', async () => {
  h.fetch.mockResolvedValueOnce(Response.json({ notifications: [item(), { id: 'booking', title: 'Private booking' }] })).mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(Response.json({ notifications: [{ ...item(), readAt: '2026-10-28T01:00:00Z' }] }))
  render('customer-a'); await settle()
  expect(render('customer-a').items).toHaveLength(1)
  await render('customer-a').markAllRead()
  expect(h.fetch).toHaveBeenCalledWith('/api/account/notifications', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ action: 'read-offers' }) }))
  expect(h.invalidate).toHaveBeenCalledTimes(1)
  expect(render('customer-a').unreadCount).toBe(0)
})
it('excludes expired items, refreshes on focus and clears stale content on failure', async () => {
  h.fetch.mockResolvedValueOnce(Response.json({ notifications: [item(), { ...item('b'), expiresAt: '2000-01-01T00:00:00Z' }] })).mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
  render(null); await settle()
  expect(render(null).items).toHaveLength(1)
  window.dispatchEvent(new Event('focus')); await settle()
  expect(render(null).items).toEqual([])
  expect(render(null).error).toBeTruthy()
})

it('revalidates after a successful read even when an intervening poll returned an unread snapshot', async () => {
  let finishPatch!: (response: Response) => void
  h.fetch.mockResolvedValueOnce(Response.json({ notifications: [item()] }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finishPatch = resolve }))
    .mockResolvedValueOnce(Response.json({ notifications: [item()] }))
    .mockResolvedValueOnce(Response.json({ notifications: [{ ...item(), readAt: '2026-10-28T01:00:00Z' }] }))
  render('customer-a'); await settle()
  const reading = render('customer-a').markRead(item().id)
  window.dispatchEvent(new Event('focus')); await settle()
  expect(render('customer-a').unreadCount).toBe(1)
  finishPatch(Response.json({ ok: true })); await reading
  expect(render('customer-a').unreadCount).toBe(0)
  expect(h.invalidate).toHaveBeenCalledTimes(1)
})
