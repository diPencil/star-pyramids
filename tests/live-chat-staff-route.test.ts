import { beforeEach, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
const mock = vi.hoisted(() => ({ current: vi.fn(), permission: vi.fn(), send: vi.fn(), log: vi.fn() }))
vi.mock('@/lib/server/auth/auth', () => ({ getCurrentUser: mock.current, hasPermission: mock.permission }))
vi.mock('@/lib/server/support/support-chat', () => ({ sendStaffMessage: mock.send, logSupportError: mock.log, supportFailure: () => ({ error: 'Support temporarily unavailable.', status: 503 }) }))
import { POST } from '@/app/api/admin/conversations/[ref]/messages/route'
const request = (body: unknown, origin = 'https://fixture.invalid') => new Request('https://fixture.invalid/api/admin/conversations/SP-CV-ABC123/messages', { method: 'POST', headers: { host: 'fixture.invalid', origin }, body: JSON.stringify(body) })
const context = () => ({ params: Promise.resolve({ ref: 'SP-CV-ABC123' }) })
beforeEach(() => { vi.resetAllMocks(); mock.current.mockResolvedValue({ id: 'server-staff' }); mock.permission.mockReturnValue(true); mock.send.mockResolvedValue({ message: {} }) })
it('keeps support.edit and same-origin requirements on staff replies', async () => {
  mock.permission.mockReturnValue(false)
  expect((await POST(request({ body: 'fixture' }), context())).status).toBe(401)
  expect(mock.permission).toHaveBeenCalledWith({ id: 'server-staff' }, 'support.edit')
  expect(mock.send).not.toHaveBeenCalled()
  mock.permission.mockReturnValue(true)
  expect((await POST(request({}, 'https://foreign.invalid'), context())).status).toBe(403)
})
it('uses authenticated staff identity and forwards only text and the optional retry ID', async () => {
  const requestId = randomUUID()
  expect((await POST(request({ body: 'fixture', requestId, senderId: 'forged', senderRole: 'bot' }), context())).status).toBe(201)
  expect(mock.send).toHaveBeenCalledWith('SP-CV-ABC123', 'server-staff', 'fixture', requestId)
})
it('does not echo unexpected database errors to staff API callers', async () => {
  mock.send.mockRejectedValue(Error('SQL contact fixture@example.invalid'))
  const response = await POST(request({ body: 'fixture' }), context())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toMatch(/SQL|contact|example/)
})
