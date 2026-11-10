import { beforeEach, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { LiveChatError } from '@/lib/support/live-chat-contract'
const mocks = vi.hoisted(() => ({ owner: vi.fn(), read: vi.fn(), revision: vi.fn(), write: vi.fn(), budget: vi.fn(), ip: vi.fn() }))
vi.mock('@/lib/server/support/live-chat-session', () => ({ chatOwner: mocks.owner, chatBudget: mocks.budget, ipChatBudget: mocks.ip }))
vi.mock('@/lib/server/support/live-chat', () => ({ readLiveThread: mocks.read, liveThreadRevision: mocks.revision, writeLiveThread: mocks.write }))
import { GET, POST } from '@/app/api/live-chat/route'
import { POST as bootstrap } from '@/app/api/live-chat/session/route'
const request = (body: unknown, origin = 'https://fixture.invalid') => new Request('https://fixture.invalid/api/live-chat', { method: 'POST', headers: { host: 'fixture.invalid', origin }, body: JSON.stringify(body) })
beforeEach(() => { vi.resetAllMocks(); mocks.owner.mockResolvedValue({ guestSessionId: 'server-owner' }); mocks.read.mockResolvedValue(null); mocks.revision.mockResolvedValue('"fixture"'); mocks.write.mockResolvedValue({ messages: [] }) })
it('keeps preview forbidden on reads and bootstrap with a safe actionable code', async () => {
  mocks.owner.mockRejectedValue(new LiveChatError(403, 'Customer chat is unavailable in staff preview.', 'preview_read_only'))
  for (const response of [await GET(new Request('https://fixture.invalid/api/live-chat')), await bootstrap(request({}))]) {
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('preview_read_only')
  }
  expect(mocks.read).not.toHaveBeenCalled()
  expect(mocks.write).not.toHaveBeenCalled()
})
it('uses only the cookie-derived owner and never accepts forged ownership', async () => {
  const response = await POST(request({ action: 'message', body: 'fixture', locale: 'en', requestId: randomUUID(), conversationId: 'foreign' }))
  expect(response.status).toBe(400); expect(mocks.write).not.toHaveBeenCalled()
  const valid = await POST(request({ action: 'message', body: 'fixture', locale: 'en', requestId: randomUUID() }))
  expect(valid.status).toBe(201)
  expect(mocks.write.mock.calls[0][0]).toEqual({ guestSessionId: 'server-owner' })
})
it('requires a same-origin request and an established guest session before messages', async () => {
  expect((await POST(request({}, 'https://foreign.invalid'))).status).toBe(403)
  expect(mocks.owner).not.toHaveBeenCalled()
  mocks.owner.mockResolvedValue(null)
  expect((await POST(request({}))).status).toBe(401)
  expect(mocks.write).not.toHaveBeenCalled()
  expect((await bootstrap(request({}))).status).toBe(200)
  expect(mocks.owner).toHaveBeenLastCalledWith(true)
})
it('bounds request size and never leaks persistence errors', async () => {
  expect((await POST(request({ body: 'x'.repeat(5000) }))).status).toBe(413)
  mocks.write.mockRejectedValue(Error('SQL secret fixture@example.invalid'))
  const response = await POST(request({ action: 'message', body: 'fixture', locale: 'en', requestId: randomUUID() }))
  expect(response.status).toBe(503)
  expect(await response.text()).not.toMatch(/SQL|secret|example/)
})
it('returns uncached, owner-scoped history and an empty state without creating guest records', async () => {
  const response = await GET(new Request('https://fixture.invalid/api/live-chat'))
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(mocks.read).toHaveBeenCalledWith({ guestSessionId: 'server-owner' })
  expect(mocks.owner).toHaveBeenCalledWith()
  mocks.owner.mockResolvedValue(null)
  expect(await (await GET(new Request('https://fixture.invalid/api/live-chat'))).json()).toEqual({ thread: null })
})
it('checks ownership before returning 304, without loading unchanged message history', async () => {
  const response = await GET(new Request('https://fixture.invalid/api/live-chat', { headers: { 'If-None-Match': '"fixture"' } }))
  expect(response.status).toBe(304)
  expect(mocks.owner).toHaveBeenCalled()
  expect(mocks.revision).toHaveBeenCalledWith({ guestSessionId: 'server-owner' })
  expect(mocks.read).not.toHaveBeenCalled()
})
