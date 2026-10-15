import { beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
const mock = vi.hoisted(() => ({ user: { id: 'staff-owner' } as { id: string } | null, allowed: true, findMany: vi.fn(), count: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => mock.user, hasPermission: () => mock.allowed }))
vi.mock('@/lib/server/db', () => ({ db: { notification: { findMany: mock.findMany, count: mock.count } } }))
import { GET } from '@/app/api/admin/notifications/history/route'
beforeEach(() => { mock.user = { id: 'staff-owner' }; mock.allowed = true; mock.findMany.mockReset().mockResolvedValue([]); mock.count.mockReset().mockResolvedValue(101) })
it('paginates the full history by recipient, without the bell limit', async () => {
  const response = await GET(new Request('https://example.com/api/admin/notifications/history?page=3&pageSize=20&status=unread'))
  expect(response.status).toBe(200); expect((await response.json()).total).toBe(101)
  expect(mock.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'staff-owner', readAt: null }, skip: 40, take: 20 }))
  expect(mock.count).toHaveBeenCalledWith({ where: { userId: 'staff-owner', readAt: null } })
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
})
it('rejects unauthorized and invalid requests without reading records', async () => {
  mock.user = null; expect((await GET(new Request('https://example.com/api/admin/notifications/history'))).status).toBe(401)
  mock.user = { id: 'staff-owner' }; mock.allowed = false; expect((await GET(new Request('https://example.com/api/admin/notifications/history'))).status).toBe(403)
  mock.allowed = true
  for (const query of ['page=-1', 'pageSize=1000', 'page=1.5', 'status=bad']) expect((await GET(new Request('https://example.com/api/admin/notifications/history?' + query))).status).toBe(400)
  expect(mock.findMany).not.toHaveBeenCalled()
})
it('registers the link in Communication with the existing support permission', () => {
  const shell = readFileSync('components/admin/admin-shell.tsx', 'utf8')
  expect(shell).toContain("'/admin/notifications': ['support.view']")
  expect(shell).toMatch(/labelEn: 'COMMUNICATION',[\s\S]*?href: '\/admin\/notifications'/)
})
