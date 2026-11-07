import { beforeEach, expect, it, vi } from 'vitest'
import { generateOpaqueToken, hashToken } from '@/lib/core/tokens'
const mock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), current: vi.fn(), account: vi.fn(), find: vi.fn(), create: vi.fn(), budget: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mock.get, set: mock.set }) }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: mock.current }))
vi.mock('@/lib/server/staff-preview', () => ({ getAccountWriteUser: mock.account }))
vi.mock('@/lib/server/db', () => ({ db: { chatGuestSession: { findUnique: mock.find, create: mock.create }, chatRateBucket: { upsert: mock.budget } } }))
import { chatOwner, chatBudget, GUEST_CHAT_COOKIE } from '@/lib/server/live-chat-session'
beforeEach(() => {
  vi.resetAllMocks()
  mock.current.mockResolvedValue(null)
  mock.create.mockImplementation(async ({ data }) => ({ id: 'guest-session', ...data }))
  mock.budget.mockResolvedValue({ count: 1 })
})
it('bootstraps an unpredictable HttpOnly credential and saves only its hash', async () => {
  expect(await chatOwner()).toBeNull()
  expect(mock.create).not.toHaveBeenCalled()
  expect(await chatOwner(true)).toEqual({ guestSessionId: 'guest-session' })
  const [name, token, options] = mock.set.mock.calls[0]
  expect(name).toBe(GUEST_CHAT_COOKIE)
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(options).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/', secure: process.env.NODE_ENV === 'production' })
  expect(mock.create.mock.calls[0][0].data.tokenHash).toBe(hashToken(token))
  expect(JSON.stringify(mock.create.mock.calls[0][0])).not.toContain(token)
})
it('restores only a valid unexpired session and never accepts a raw conversation ID as a credential', async () => {
  const token = generateOpaqueToken()
  mock.get.mockReturnValue({ value: token })
  mock.find.mockResolvedValue({ id: 'owner-a', expiresAt: new Date(Date.now() + 10000) })
  expect(await chatOwner()).toEqual({ guestSessionId: 'owner-a' })
  expect(mock.find).toHaveBeenCalledWith({ where: { tokenHash: hashToken(token) } })
  mock.find.mockResolvedValue({ id: 'owner-a', expiresAt: new Date(0) })
  expect(await chatOwner()).toBeNull()
  mock.get.mockReturnValue({ value: 'SP-CV-ABC123' })
  expect(await chatOwner()).toBeNull()
})
it('prefers server-authenticated customers and rejects staff/preview writes', async () => {
  mock.current.mockResolvedValue({ id: 'authenticated' })
  mock.account.mockResolvedValue({ id: 'authenticated' })
  expect(await chatOwner(true)).toEqual({ customerId: 'authenticated' })
  expect(mock.find).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled()
  mock.account.mockResolvedValue(null)
  await expect(chatOwner(true)).rejects.toMatchObject({ status: 403 })
})
it('enforces shared atomic budgets and hashes all identifying keys', async () => {
  await chatBudget('ip:192.0.2.1', 2, 300)
  expect(mock.budget.mock.calls[0][0].where.key).toMatch(/^[0-9a-f]{64}$/)
  expect(JSON.stringify(mock.budget.mock.calls[0][0])).not.toContain('192.0.2.1')
  mock.budget.mockResolvedValue({ count: 3 })
  await expect(chatBudget('ip:192.0.2.1', 2, 300)).rejects.toMatchObject({ status: 429 })
})
it('uses Secure and a host-only cookie name in production', async () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.resetModules()
  try {
    const production = await import('@/lib/server/live-chat-session')
    await production.chatOwner(true)
    expect(mock.set).toHaveBeenCalledWith('__Host-sp-chat', expect.any(String), expect.objectContaining({ secure: true, httpOnly: true, path: '/', sameSite: 'strict' }))
  } finally { vi.unstubAllEnvs() }
})
