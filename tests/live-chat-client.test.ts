import { beforeEach, expect, it, vi } from 'vitest'
import { LiveChatTransport } from '@/lib/live-chat-client'
import { parseLiveAction } from '@/lib/live-chat-contract'
import { randomUUID } from 'node:crypto'
const input = { action: 'message' as const, body: 'Hello fixture', locale: 'en' as const }
it('recognizes only the safe preview code on 403 and never exposes raw server diagnostics', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ code: 'preview_read_only', error: 'private diagnostic' }, { status: 403 }))
    .mockResolvedValueOnce(new Response('private SQL diagnostic', { status: 403 }))
  const transport = new LiveChatTransport(request)
  await expect(transport.read()).rejects.toMatchObject({ status: 403, code: 'preview_read_only', message: 'unavailable' })
  await expect(transport.read()).rejects.toMatchObject({ status: 403, code: undefined, message: 'unavailable' })
})
const store = new Map<string, string>()
const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } }
beforeEach(() => { store.clear() })
it('loads history with the global receiver required by browser fetch', async () => {
  const request = vi.fn(function (this: unknown, _url: RequestInfo | URL, _init?: RequestInit) {
    if (this !== globalThis) throw new TypeError('Illegal invocation')
    return Promise.resolve(Response.json({ thread: null }))
  })
  await expect(new LiveChatTransport(request).read()).resolves.toBeNull()
  expect(request).toHaveBeenCalledOnce()
})
it('preserves the browser fetch receiver for session bootstrap and message delivery', async () => {
  const request = vi.fn(function (this: unknown, url: RequestInfo | URL, _init?: RequestInit) {
    if (this !== globalThis) throw new TypeError('Illegal invocation')
    return Promise.resolve(Response.json(url === '/api/live-chat/session' ? { ok: true } : { thread: null }))
  })
  await expect(new LiveChatTransport(request, storage).submit(input)).resolves.toBeNull()
  expect(request.mock.calls.map(([url]) => url)).toEqual(['/api/live-chat/session', '/api/live-chat'])
  expect(store.size).toBe(0)
})
it('bootstraps before submission and reuses the retry ID after lost acknowledgement and reload', async () => {
  const request = vi.fn<typeof fetch>()
  request.mockResolvedValueOnce(Response.json({ ok: true })).mockRejectedValueOnce(new Error('lost response'))
  await expect(new LiveChatTransport(request, storage).submit(input)).rejects.toThrow('lost response')
  const first = JSON.parse(request.mock.calls[1][1]!.body as string)
  expect(request.mock.calls[0][0]).toBe('/api/live-chat/session')
  expect([...store.values()].join()).not.toContain(input.body)
  request.mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(Response.json({ thread: { reference: 'fixture', messages: [] } }))
  await new LiveChatTransport(request, storage).submit(input)
  expect(JSON.parse(request.mock.calls[3][1]!.body as string).requestId).toBe(first.requestId)
  expect(store.size).toBe(0)
})
it('does not send a message if session bootstrap fails', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: 'unavailable' }, { status: 503 }))
  await expect(new LiveChatTransport(request).submit(input)).rejects.toThrow('unavailable')
  expect(request).toHaveBeenCalledOnce()
})
it('can restore messages without creating a session and fails explicitly on non-successful reads', async () => {
  const thread = { messages: [{ id: 'fixture', senderRole: 'staff', body: 'Saved reply', createdAt: new Date().toISOString() }] }
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ thread })).mockResolvedValueOnce(new Response(null, { status: 429 }))
  const client = new LiveChatTransport(request)
  expect(await client.read()).toEqual(thread)
  expect(request.mock.calls[0][1]).toMatchObject({ cache: 'no-store', credentials: 'same-origin' })
  await expect(client.read()).rejects.toThrow('rate')
})
it('uses conditional polling without losing the last confirmed transcript', async () => {
  const thread = { messages: [] }
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ thread }, { headers: { ETag: '"revision"' } })).mockResolvedValueOnce(new Response(null, { status: 304 }))
  const client = new LiveChatTransport(request)
  expect(await client.read()).toEqual(thread)
  expect(await client.read()).toEqual(thread)
  expect(request.mock.calls[1][1]!.headers).toEqual({ 'If-None-Match': '"revision"' })
})
it('keeps retries working when session storage is unavailable', async () => {
  const request = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ thread: null }))
  const blocked = { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') }, removeItem: () => { throw Error('blocked') } }
  await expect(new LiveChatTransport(request, blocked).submit(input)).resolves.toBeNull()
})
it('requires an explicit retry after an ownership conflict and then uses a fresh ID', async () => {
  const request = vi.fn<typeof fetch>()
  request.mockImplementation(async url => url === '/api/live-chat/session' ? Response.json({ ok: true }) : new Response(null, { status: 409 }))
  const client = new LiveChatTransport(request, storage)
  await expect(client.submit(input)).rejects.toThrow('unavailable')
  const first = JSON.parse(request.mock.calls[1][1]!.body as string).requestId
  expect(request).toHaveBeenCalledTimes(2)
  expect(store.size).toBe(0)
  request.mockImplementation(async () => Response.json({ thread: null }))
  await client.submit(input)
  expect(JSON.parse(request.mock.calls[3][1]!.body as string).requestId).not.toBe(first)
})
it.each([
  { senderId: 'forged' }, { conversationId: 'foreign' }, { senderRole: 'staff' },
  { body: '' }, { body: 'x'.repeat(501) }, { body: '\uD800' }, { body: 'bad\u0000text' },
  { action: 'handoff', name: '', phone: '123456789' },
  { action: 'handoff', name: 'Fixture', phone: 'not-a-phone' },
])('rejects invalid payloads or client-supplied authority: %o', change => {
  expect(() => parseLiveAction({ ...input, requestId: randomUUID(), ...change })).toThrow()
})
