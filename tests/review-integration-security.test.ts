import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ user: vi.fn(), permission: vi.fn(), origin: vi.fn(), get: vi.fn(), save: vi.fn(), load: vi.fn(), audit: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: mocks.user, hasPermission: mocks.permission }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: mocks.origin }))
vi.mock('@/lib/server/review-integrations', () => ({ getReviewIntegrations: mocks.get, saveReviewIntegration: mocks.save, loadReviewFeed: mocks.load }))
vi.mock('@/lib/server/db', () => ({ db: { staffActionAudit: { create: mocks.audit } } }))
import { GET, POST } from '@/app/api/admin/review-integrations/route'
beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ id: 'staff' }); mocks.permission.mockReturnValue(true); mocks.origin.mockReturnValue(true); mocks.get.mockResolvedValue([]); mocks.audit.mockResolvedValue({}) })
const request = (body: string) => new Request('http://localhost:3000/api/admin/review-integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
describe('Review settings authorization', () => {
  it('requires authentication for reads and mutations', async () => { mocks.user.mockResolvedValue(null); expect((await GET()).status).toBe(401); expect((await POST(request('{}'))).status).toBe(401); expect(mocks.save).not.toHaveBeenCalled() })
  it('enforces settings.edit and same origin', async () => { mocks.permission.mockReturnValue(false); expect((await POST(request('{}'))).status).toBe(403); mocks.permission.mockReturnValue(true); mocks.origin.mockReturnValue(false); expect((await POST(request('{}'))).status).toBe(403); expect(mocks.save).not.toHaveBeenCalled() })
  it.each(['', 'null', '[]', '{'])('handles malformed JSON safely %s', async body => { const r = await POST(request(body)); expect(r.status).toBe(400); expect((await r.json()).error).toBeTruthy(); expect(mocks.save).not.toHaveBeenCalled() })
  it('rejects unsupported providers and actions', async () => { expect((await POST(request('{"provider":"evil","action":"save"}'))).status).toBe(400); expect((await POST(request('{"provider":"google","action":"delete"}'))).status).toBe(400) })
  it('audits only action and provider, not credential values', async () => {
    const r = await POST(request(JSON.stringify({ provider: 'google', action: 'save', config: {}, secret: 'private-key', clearSecret: false })))
    expect(r.status).toBe(200); expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('private-key'); expect(JSON.stringify(await r.json())).not.toContain('private-key')
  })
  it('does not report a persisted save as failed if audit is unavailable', async () => {
    mocks.audit.mockRejectedValueOnce(Error('Audit unavailable'))
    const r = await POST(request(JSON.stringify({ provider: 'google', action: 'save', config: {}, secret: '', clearSecret: false })))
    expect(r.status).toBe(200); expect(mocks.save).toHaveBeenCalledOnce()
  })
})
