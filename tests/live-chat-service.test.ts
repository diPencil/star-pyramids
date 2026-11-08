import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseLiveAction } from '@/lib/live-chat-contract'

const mock = vi.hoisted(() => ({ db: {} as Record<string, any>, notify: vi.fn(), failBot: false, rows: [] as any[], messages: [] as any[], sequence: 0,
  tours: [] as { slug: string; title: string; status: string; location: string; duration: string }[] }))
vi.mock('@/lib/server/db', () => ({ db: mock.db }))
vi.mock('@/lib/server/notifications', () => ({ notifyStaff: mock.notify, notifyUser: vi.fn(), adminSupportHref: (r: string) => `/admin/inbox?conversation=${r}`, customerSupportHref: (r: string) => `/account/messages?conversation=${r}` }))
vi.mock('@/lib/server/email', () => ({ sendCustomerEmailSafe: vi.fn(), sendStaffEmailSafe: vi.fn() }))
import { readLiveThread, writeLiveThread } from '@/lib/server/live-chat'
import { countStaffUnread, getCustomerThread, getStaffConversation, listStaffConversations, sendCustomerMessage, sendStaffMessage } from '@/lib/server/support-chat'

function hydrated(row: any) {
  return row && { ...row, customer: row.customerId ? { email: 'fixture@example.invalid', firstName: 'Fixture', lastName: 'Customer' } : null, assignee: null, messages: mock.messages.filter(m => m.conversationId === row.id).sort((a, b) => a.createdAt - b.createdAt) }
}
function matches(row: any, where: any = {}) {
  return Object.entries(where).every(([k, v]) => row[k] === v)
}
const action = (body = 'hello') => parseLiveAction({ action: 'message', body, locale: 'en', requestId: randomUUID() })
const a = { guestSessionId: 'guest-a' }, b = { guestSessionId: 'guest-b' }

beforeEach(() => {
  vi.useFakeTimers()
  mock.rows = []; mock.messages = []; mock.sequence = 0; mock.failBot = false; mock.notify.mockReset(); mock.tours = []
  Object.assign(mock.db, {
    tour: { findMany: vi.fn(async () => mock.tours) },
    $queryRaw: vi.fn(async () => [{ id: 'locked-owner' }]),
    $transaction: vi.fn(async (fn: (db: any) => Promise<any>) => {
      const rows = structuredClone(mock.rows), messages = structuredClone(mock.messages)
      try { return await fn(mock.db) } catch (error) { mock.rows = rows; mock.messages = messages; throw error }
    }),
    user: { findUnique: vi.fn(async () => ({ email: 'fixture@example.invalid', firstName: 'Fixture', lastName: 'Customer' })) },
    supportConversation: {
      findFirst: vi.fn(async ({ where }: any) => hydrated(mock.rows.filter(r => matches(r, where)).at(-1))),
      findUnique: vi.fn(async ({ where }: any) => hydrated(mock.rows.find(r => matches(r, where)))),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => { const row = hydrated(mock.rows.find(r => matches(r, where))); if (!row) throw Error('not found'); return row }),
      findMany: vi.fn(async () => mock.rows.map(hydrated)),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `thread-${++mock.sequence}`, customerId: null, guestSessionId: null, subject: null, guestName: null, guestPhone: null, agentRequestedAt: null, status: 'OPEN', channel: 'account', needsStaffReply: true, createdAt: new Date(), updatedAt: new Date(), lastMessageAt: new Date(), closedAt: null, ...data }
        mock.rows.push(row); return hydrated(row)
      }),
      update: vi.fn(async ({ where, data }: any) => { const row = mock.rows.find(r => matches(r, where)); Object.assign(row, data, { updatedAt: new Date() }); return hydrated(row) }),
    },
    supportMessage: {
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        const rows = mock.messages.filter(m => matches(m, where))
        if (orderBy?.createdAt === 'desc') rows.sort((a, b) => b.createdAt - a.createdAt)
        return rows[0] ?? null
      }),
      create: vi.fn(async ({ data }: any) => {
        if (mock.failBot && data.senderRole === 'bot') throw Error('fixture persistence failure')
        const row = { id: `message-${++mock.sequence}`, senderId: null, readAt: null, createdAt: new Date(), ...data }; mock.messages.push(row); vi.setSystemTime(Date.now() + 100); return row
      }),
      findUnique: vi.fn(async ({ where, include }: any) => { const row = mock.messages.find(m => matches(m, where)); return row && { ...row, ...(include?.conversation ? { conversation: mock.rows.find(r => r.id === row.conversationId) } : {}) } }),
      count: vi.fn(async () => mock.messages.filter(m => m.senderRole === 'customer' && m.readAt === null && mock.rows.some(r => r.id === m.conversationId && (r.channel === 'account' || r.needsStaffReply))).length),
    },
  })
})
afterEach(() => vi.useRealTimers())

describe('persistent guest chat, using a transaction double and no database', () => {
  it('persists actual fresh catalogue answers alongside visitor history without making staff claims', async () => {
    mock.tours = [{ slug: 'new-cairo-tour', title: 'New Cairo Tour', status: 'published', location: 'Cairo', duration: '1 day' }]
    const first = await writeLiveThread(a, action('All trips'))
    expect(first!.messages.at(-1)?.body).toContain('/egypt-tours/new-cairo-tour')
    mock.tours = [{ slug: 'new-luxor-tour', title: 'New Luxor Tour', status: 'published', location: 'Luxor', duration: '2 days' }]
    const next = await writeLiveThread(a, action('All trips'))
    expect(next!.messages.at(-1)?.body).toContain('/egypt-tours/new-luxor-tour')
    expect(next!.reference).toBe(first!.reference)
    expect(mock.notify).not.toHaveBeenCalled()
    expect(next!.needsStaffReply).toBe(false)
  })
  it('persists greeting, first visitor message and server-generated bot reply, and restores the same history', async () => {
    const saved = await writeLiveThread(a, action())
    expect(saved!.messages.map(m => m.senderRole)).toEqual(['bot', 'customer', 'bot'])
    expect(await readLiveThread(a)).toEqual(saved)
    expect(await readLiveThread(b)).toBeNull()
    expect(mock.db.$queryRaw).toHaveBeenCalled()
    expect(mock.notify).not.toHaveBeenCalled()
    expect(await countStaffUnread()).toBe(0)
    expect((await listStaffConversations())[0].channel).toBe('live')
  })
  it('does not confirm or retain partial writes when persistence fails', async () => {
    mock.failBot = true
    await expect(writeLiveThread(a, action())).rejects.toThrow('persistence failure')
    expect(mock.messages).toEqual([]); expect(mock.rows).toEqual([])
  })
  it('replays once, rejects cross-owner replay and rejects changed payloads with the same request ID', async () => {
    const input = action()
    const first = await writeLiveThread(a, input)
    expect(await writeLiveThread(a, input)).toEqual(first)
    expect(mock.messages).toHaveLength(3)
    await expect(writeLiveThread(b, input)).rejects.toMatchObject({ status: 409 })
    await expect(writeLiveThread(a, { ...input, body: 'changed' })).rejects.toMatchObject({ status: 409 })
    expect(mock.rows).toHaveLength(1)
  })
  it('updates the same thread on handoff, keeps contact details staff-only and restores staff replies', async () => {
    const initial = await writeLiveThread(a, action('price'))
    const handoff = parseLiveAction({ action: 'handoff', body: 'Please help', locale: 'en', name: 'Guest Fixture', phone: '+1 202 555 0123', requestId: randomUUID() })
    const result = await writeLiveThread(a, handoff)
    expect(result!.reference).toBe(initial!.reference)
    expect(mock.rows).toHaveLength(1)
    expect(result!.needsStaffReply).toBe(true)
    expect(JSON.stringify(result)).not.toContain('Guest Fixture')
    expect(JSON.stringify(result)).not.toContain('+1 202')
    expect((await getStaffConversation(result!.reference))!.conversation).toMatchObject({ guestName: 'Guest Fixture', guestPhone: '+1 202 555 0123', agentRequestedAt: expect.any(String) })
    expect(await countStaffUnread()).toBe(1)
    await writeLiveThread(a, handoff)
    expect(mock.notify).toHaveBeenCalledOnce()
    const id = randomUUID()
    const staff = await sendStaffMessage(result!.reference, 'staff-1', 'Confirmed staff reply', id)
    await sendStaffMessage(result!.reference, 'staff-1', 'Confirmed staff reply', id)
    expect(mock.messages.filter(m => m.senderRole === 'staff')).toHaveLength(1)
    expect((await readLiveThread(a))!.messages.at(-1)).toMatchObject({ body: staff.message.body, senderRole: 'staff' })
    expect(await countStaffUnread()).toBe(0)
    const followup = await writeLiveThread(a, action('Another question'))
    expect(followup!.needsStaffReply).toBe(true)
    expect(followup!.messages.at(-1)!.senderRole).toBe('customer')
  })
  it('reuses authenticated account threads and preserves the existing customer send/read architecture', async () => {
    const account = { customerId: 'customer-a' }
    const created = await sendCustomerMessage(account.customerId, 'Account support question')
    const live = await writeLiveThread(account, action('Follow-up from widget'))
    expect(live!.reference).toBe(created.conversation.reference)
    expect(live!.messages.filter(m => m.senderRole === 'bot')).toEqual([])
    expect((await getCustomerThread(account.customerId)).messages.at(-1)!.body).toBe('Follow-up from widget')
    expect(await readLiveThread({ customerId: 'customer-b' })).toBeNull()
    expect(await readLiveThread(a)).toBeNull()
  })
  it('replays a delivered request after closure without opening a duplicate, while a new request creates a fresh thread', async () => {
    const input = action()
    await writeLiveThread(a, input)
    mock.rows[0].status = 'CLOSED'
    expect((await writeLiveThread(a, input))!.status).toBe('CLOSED')
    expect(mock.rows).toHaveLength(1)
    await writeLiveThread(a, action('New question'))
    expect(mock.rows).toHaveLength(2)
  })
})
