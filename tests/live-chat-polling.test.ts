import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, values: [] as unknown[], effects: [] as Array<() => void>, cleanups: new Map<number, () => void>() }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState(initial: unknown) { const i = hooks.index++; if (!(i in hooks.values)) hooks.values[i] = initial; return [hooks.values[i], (next: unknown) => { hooks.values[i] = next }] },
  useRef(initial: unknown) { const i = hooks.index++; return hooks.values[i] ??= { current: initial } },
  useEffect(effect: () => (() => void) | void, deps: unknown[]) {
    const i = hooks.index++, old = hooks.values[i] as unknown[] | undefined
    if (old && old.length === deps.length && deps.every((d, j) => d === old[j])) return
    hooks.values[i] = deps
    hooks.effects.push(() => { hooks.cleanups.get(i)?.(); const cleanup = effect(); if (cleanup) hooks.cleanups.set(i, cleanup); else hooks.cleanups.delete(i) })
  },
}))
import { useLiveChat } from '@/lib/live-chat-client'
const fetchMock = vi.fn<typeof fetch>()
let doc: EventTarget & { hidden: boolean }
function render(open = true) { hooks.index = 0; const result = useLiveChat(open); for (const run of hooks.effects.splice(0)) run(); return result }
beforeEach(() => {
  hooks.index = 0; hooks.values = []; hooks.effects = []; hooks.cleanups.clear()
  fetchMock.mockReset(); vi.useFakeTimers()
  doc = Object.assign(new EventTarget(), { hidden: false })
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', { setInterval, clearInterval })
  vi.stubGlobal('navigator', {})
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { for (const cleanup of hooks.cleanups.values()) cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
it('opens and polls with a receiver-sensitive browser fetch without showing a connection error', async () => {
  fetchMock.mockImplementation(function (this: unknown) {
    if (this !== globalThis) throw new TypeError('Illegal invocation')
    return Promise.resolve(Response.json({ thread: null }))
  })
  render()
  await vi.advanceTimersByTimeAsync(0)
  expect(render().error).toBe(false)
  await vi.advanceTimersByTimeAsync(10000)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(render().error).toBe(false)
})
it('polls only an open visible chat, restores staff replies and cleans up when closed', async () => {
  const reply = { reference: 'fixture', messages: [{ id: 'reply', senderRole: 'staff', body: 'Saved reply', createdAt: new Date().toISOString() }] }
  fetchMock.mockImplementation(async () => Response.json({ thread: reply }))
  render(false)
  await vi.advanceTimersByTimeAsync(20000)
  expect(fetchMock).not.toHaveBeenCalled()
  render(true)
  await vi.advanceTimersByTimeAsync(0)
  expect(render().thread).toEqual(reply)
  expect(fetchMock).toHaveBeenCalledOnce()
  doc.hidden = true
  await vi.advanceTimersByTimeAsync(20000)
  expect(fetchMock).toHaveBeenCalledOnce()
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(0)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  render(false)
  await vi.advanceTimersByTimeAsync(20000)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('does not let a stale history response overwrite a newly persisted message', async () => {
  let finishRead!: (response: Response) => void
  const read = new Promise<Response>(resolve => { finishRead = resolve })
  const latest = { reference: 'fixture', messages: [{ id: 'new', body: 'persisted' }] }
  fetchMock.mockImplementation(async (url, init) => init?.method === 'POST' ? Response.json(url === '/api/live-chat/session' ? { ok: true } : { thread: latest }) : read)
  const chat = render()
  expect(await chat.send({ action: 'message', body: 'fixture', locale: 'en' })).toBe(true)
  finishRead(Response.json({ thread: null }))
  await vi.advanceTimersByTimeAsync(0)
  expect(render().thread).toEqual(latest)
})
