import { randomUUID } from 'node:crypto'
import { PrismaClient, Prisma } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { parseLiveAction } from '@/lib/live-chat-contract'

// This verification is opt-in and never falls back to the application's .env.
// Every synthetic row is enclosed in one transaction which deliberately rolls back.
const enabled = process.env.LIVE_CHAT_LOCAL_DATABASE_VERIFY === 'STAR_PYRAMIDS_LOCAL_ROLLBACK_ONLY'
const state = vi.hoisted(() => ({ tx: null as import('@prisma/client').Prisma.TransactionClient | null }))
vi.mock('@/lib/server/db', () => ({ db: new Proxy({}, {
  get(_target, key) {
    if (!state.tx) throw new Error('No isolated rollback transaction is active.')
    if (key === '$transaction') return async (fn: (tx: typeof state.tx) => Promise<unknown>) => fn(state.tx)
    const value = Reflect.get(state.tx, key)
    return typeof value === 'function' ? value.bind(state.tx) : value
  },
}) }))
// Verification must never notify existing staff or send email.
vi.mock('@/lib/server/notifications', () => ({ notifyStaff: vi.fn(), notifyUser: vi.fn(), adminSupportHref: (ref: string) => `/admin/inbox?conversation=${ref}`, customerSupportHref: (ref: string) => `/account/messages?conversation=${ref}` }))
vi.mock('@/lib/server/email', () => ({ sendCustomerEmailSafe: vi.fn(), sendStaffEmailSafe: vi.fn() }))
import { readLiveThread, writeLiveThread } from '@/lib/server/live-chat'
import { getCustomerThread, getStaffConversation, sendCustomerMessage, sendStaffMessage } from '@/lib/server/support-chat'

describe.skipIf(!enabled)('authorized local chat database verification with rollback', () => {
  let client: PrismaClient
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || '')
    if (url.protocol !== 'mysql:' || url.hostname !== 'localhost' || url.port !== '3306' || url.pathname !== '/star_pyramids_production') throw new Error('Local database target guard failed.')
    client = new PrismaClient({ datasources: { db: { url: url.toString() } } })
    const rows = await client.$queryRaw<Array<{ name: string; version: string }>>`SELECT DATABASE() AS name, VERSION() AS version`
    if (rows[0]?.name !== 'star_pyramids_production' || !rows[0].version.startsWith('10.4.32-MariaDB')) throw new Error('Unexpected database identity.')
  })
  afterAll(async () => { state.tx = null; await client?.$disconnect() })

  it('verifies real guest persistence, isolation, handoff, staff replay and account compatibility without retaining test data', async () => {
    const rollback = new Error('ROLLBACK_LOCAL_CHAT_VERIFICATION')
    let completed = false
    try {
      await client.$transaction(async tx => {
        state.tx = tx
        const token = randomUUID()
        const firstGuest = await tx.chatGuestSession.create({ data: { tokenHash: (token.replaceAll('-', '') + token.replaceAll('-', '')).slice(0, 64), expiresAt: new Date(Date.now() + 600000) } })
        const secondGuest = await tx.chatGuestSession.create({ data: { tokenHash: randomUUID().replaceAll('-', '').repeat(2), expiresAt: new Date(Date.now() + 600000) } })
        const owner = { guestSessionId: firstGuest.id }, other = { guestSessionId: secondGuest.id }
        const input = parseLiveAction({ action: 'message', body: 'Hello rollback verification', locale: 'en', requestId: randomUUID() })
        const first = await writeLiveThread(owner, input)
        expect(first!.messages.map(m => m.senderRole)).toEqual(['bot', 'customer', 'bot'])
        expect(await readLiveThread(owner)).toEqual(first)
        expect(await readLiveThread(other)).toBeNull()
        const count = await tx.supportMessage.count({ where: { conversation: owner } })
        await writeLiveThread(owner, input)
        expect(await tx.supportMessage.count({ where: { conversation: owner } })).toBe(count)
        await expect(writeLiveThread(other, input)).rejects.toMatchObject({ status: 409 })

        const handoff = parseLiveAction({ action: 'handoff', body: 'Please help with planning', name: 'Rollback Verification', phone: '+12025550123', locale: 'en', requestId: randomUUID() })
        const requested = await writeLiveThread(owner, handoff)
        expect(requested!.reference).toBe(first!.reference)
        expect(await tx.supportConversation.count({ where: owner })).toBe(1)
        expect((await getStaffConversation(first!.reference))!.conversation).toMatchObject({ guestName: 'Rollback Verification', guestPhone: '+12025550123', needsStaffReply: true })
        expect(JSON.stringify(requested)).not.toContain('Rollback Verification')

        const fixture = (prefix: string) => ({ email: `${prefix}-${token}@example.invalid`, emailNormalized: `${prefix}-${token}@example.invalid`, status: 'ACTIVE' as const })
        const staff = await tx.user.create({ data: fixture('staff') })
        const requestId = randomUUID()
        await sendStaffMessage(first!.reference, staff.id, 'Verified staff response', requestId)
        await sendStaffMessage(first!.reference, staff.id, 'Verified staff response', requestId)
        expect(await tx.supportMessage.count({ where: { conversation: owner, senderRole: 'staff' } })).toBe(1)
        expect((await readLiveThread(owner))!.messages.at(-1)).toMatchObject({ senderRole: 'staff', body: 'Verified staff response' })

        const customer = await tx.user.create({ data: fixture('customer') })
        const account = await sendCustomerMessage(customer.id, 'Existing account support path')
        const followup = await writeLiveThread({ customerId: customer.id }, parseLiveAction({ action: 'message', body: 'Widget followup', locale: 'en', requestId: randomUUID() }))
        expect(followup!.reference).toBe(account.conversation.reference)
        expect((await getCustomerThread(customer.id)).messages.at(-1)!.body).toBe('Widget followup')
        completed = true
        throw rollback
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 })
    } catch (error) { if (error !== rollback) throw error }
    finally { state.tx = null }
    expect(completed).toBe(true)
  })
})
