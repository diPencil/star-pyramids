import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

type Row = Record<string, any>
const shared = vi.hoisted(() => {
  const state = { bookings: [] as Record<string, any>[], payments: [] as Record<string, any>[], tail: Promise.resolve() }
  const db = {
    booking: { findUnique: vi.fn(), create: vi.fn() },
    payment: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    paymentEvent: { findFirst: vi.fn() }, user: { findUnique: vi.fn(async () => null) },
    $queryRaw: vi.fn(), $executeRaw: vi.fn(),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      let release!: () => void
      const previous = state.tail
      state.tail = new Promise<void>((resolve) => { release = resolve })
      await previous
      const snapshot = structuredClone(state.payments)
      try { return await fn(db) } catch (error) { state.payments = snapshot; throw error } finally { release() }
    },
  }
  return { state, db }
})
vi.mock('@/lib/server/db', () => ({ db: shared.db }))
vi.mock('@/lib/server/notifications', () => ({ notifyUser: vi.fn(), notifyStaff: vi.fn() }))
vi.mock('@/lib/server/email', () => ({ sendCustomerEmailSafe: vi.fn(), sendStaffEmailSafe: vi.fn() }))
vi.mock('@/lib/server/booking-access', () => ({ guestBookingPath: vi.fn(), issueGuestBookingToken: vi.fn(), revokeGuestBookingTokens: vi.fn(), resolveGuestBookingToken: vi.fn() }))
import { initiateCustomerPayment, recordOfflinePayment, recordOfflineRefund } from '@/lib/server/payments'
import { createBookingRecord, type ValidatedBookingDraft } from '@/lib/server/bookings'
import { notifyStaff } from '@/lib/server/notifications'

const { db, state } = shared
const date = new Date('2026-01-01T00:00:00Z')
function booking(overrides: Row = {}): Row {
  return { id: 'b1', reference: 'SP-BK-ABC123', userId: 'u1', currency: 'USD', status: 'CONFIRMED',
    total: '500.00', subtotal: '500.00', discount: '0.00', contactName: 'Tester', contactEmail: 'test@example.com',
    contactPhone: '123', paymentStatus: 'PENDING', notes: null, items: [], activities: [], payments: [], user: null,
    createdAt: date, updatedAt: date, ...overrides }
}
function payment(overrides: Row = {}): Row {
  return { id: 'p1', bookingId: 'b1', reference: 'SP-PAY-ABC123', currency: 'USD', provider: 'pending',
    status: 'PENDING', amount: '500.00', amountPaid: '0.00', amountRefunded: '0.00', events: [],
    initiatedAt: date, createdAt: date, updatedAt: date, ...overrides }
}
const join = (row: Row) => ({ ...structuredClone(row), booking: structuredClone(state.bookings.find((b) => b.id === row.bookingId)) })
const intent = { bookingReference: 'SP-BK-ABC123', idempotencyKey: 'submission-key-123' }
const refund = { paymentReference: 'SP-PAY-ABC123', amount: 100, method: 'cash', externalReference: 'OUT-123', confirmReturned: true }
const receipt = { bookingReference: 'SP-BK-ABC123', amount: 100, currency: 'USD', method: 'cash', idempotencyKey: 'receipt-key-123', referenceNote: 'IN-123' }
const draft: ValidatedBookingDraft = { lines: [], subtotalCents: 50000, totalCents: 50000, discountCents: 0,
  contactName: 'Tester', contactEmail: 'test@example.com', contactPhone: '123', notes: '', idempotencyKey: intent.idempotencyKey }
const uniqueConflict = () => new Prisma.PrismaClientKnownRequestError('unique key', { code: 'P2002', clientVersion: 'test', meta: { target: ['idempotencyKey'] } })

beforeEach(() => {
  vi.resetAllMocks()
  state.bookings = [booking()]; state.payments = []; state.tail = Promise.resolve()
  db.booking.findUnique.mockImplementation(async ({ where }) => state.bookings.find((b) => Object.entries(where).every(([k, v]) => b[k] === v)) ?? null)
  db.payment.findUnique.mockImplementation(async ({ where }) => { const row = state.payments.find((p) => Object.entries(where).every(([k, v]) => p[k] === v)); return row ? join(row) : null })
  db.payment.findFirst.mockImplementation(async ({ where }) => { const row = state.payments.find((p) => p.bookingId === where.bookingId && where.status.in.includes(p.status)); return row ? join(row) : null })
  db.payment.findMany.mockImplementation(async ({ where }) => structuredClone(state.payments.filter((p) => p.bookingId === where.bookingId)))
  db.payment.create.mockImplementation(async ({ data }) => {
    if (data.idempotencyKey && state.payments.some((p) => p.idempotencyKey === data.idempotencyKey)) throw uniqueConflict()
    const events = Array.isArray(data.events.create) ? data.events.create : [data.events.create]
    const row = payment({ ...data, id: `p${state.payments.length + 1}`, events: events.map((e: Row) => ({ ...e, createdAt: date })) })
    state.payments.push(row); return join(row)
  })
  db.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, value: unknown) => {
    if (strings.join('').includes('FROM payments')) return structuredClone(state.payments.filter((p) => p.reference === value))
    return structuredClone(state.bookings.filter((b) => b.id === value || b.reference === value))
  })
  db.payment.updateMany.mockImplementation(async ({ where, data }) => { const row = state.payments.find((p) => p.id === where.id && p.status === where.status); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 } })
  db.paymentEvent.findFirst.mockImplementation(async ({ where }) => {
    const row = state.payments.find((p) => p.id === where.paymentId)
    return row?.events.find((e: Row) => where.action.in.includes(e.action) && where.OR.some((identity: Row) => Object.entries(identity).every(([k, v]) => v == null ? e[k] == null : e[k] === v))) ?? null
  })
  db.$executeRaw.mockImplementation(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    state.payments.find((p) => p.id === values[1])!.events.push({ id: values[0], action: values[3], note: values[4], amountCents: values[7], method: values[8], externalReference: values[9], createdAt: date })
    return 1
  })
})

describe('payment replay ownership and initiation serialization', () => {
  it.each([
    ['another customer', { id: 'b2', reference: 'SP-BK-OTHER1', userId: 'u2' }],
    ['another booking of the same customer', { id: 'b2', reference: 'SP-BK-OTHER1' }],
    ['a guest booking', { id: 'b2', reference: 'SP-BK-OTHER1', userId: null }],
  ])('rejects a global key belonging to %s', async (_label, overrides) => {
    state.bookings.push(booking(overrides)); state.payments.push(payment({ bookingId: 'b2', idempotencyKey: intent.idempotencyKey }))
    await expect(initiateCustomerPayment('u1', intent)).rejects.toThrow(/different payment/)
    expect(db.payment.create).not.toHaveBeenCalled(); expect(notifyStaff).not.toHaveBeenCalled()
  })
  it('returns an owned same-booking replay without writing', async () => {
    state.payments.push(payment({ idempotencyKey: intent.idempotencyKey }))
    await expect(initiateCustomerPayment('u1', intent)).resolves.toMatchObject({ created: false, payment: { reference: 'SP-PAY-ABC123' } })
    expect(db.payment.create).not.toHaveBeenCalled()
  })
  it('rejects the foreign winner of a global key race', async () => {
    state.bookings.push(booking({ id: 'b2', userId: 'u2', reference: 'SP-BK-OTHER1' }))
    db.payment.create.mockImplementationOnce(async () => { state.payments.push(payment({ bookingId: 'b2', idempotencyKey: intent.idempotencyKey })); throw uniqueConflict() })
    // The concurrent winner commits outside our rolled-back transaction.
    db.payment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(join(payment({ bookingId: 'b2' })))
    await expect(initiateCustomerPayment('u1', intent)).rejects.toThrow(/different payment/)
    expect(notifyStaff).not.toHaveBeenCalled()
  })
  it('serializes concurrent different keys into one active intent and one notification', async () => {
    const results = await Promise.all([initiateCustomerPayment('u1', intent), initiateCustomerPayment('u1', { ...intent, idempotencyKey: 'another-key-123' })])
    expect(results.map((r) => r.created).sort()).toEqual([false, true])
    expect(db.payment.create).toHaveBeenCalledTimes(1); expect(notifyStaff).toHaveBeenCalledTimes(1)
  })
})

describe('booking replay ownership', () => {
  it.each(['u2', null])('never returns an account booking to %s', async (userId) => {
    state.bookings[0].idempotencyKey = intent.idempotencyKey
    await expect(createBookingRecord(userId, draft)).rejects.toThrow(/different booking/)
    expect(db.booking.create).not.toHaveBeenCalled()
  })
  it('rejects a foreign booking after a unique-key race', async () => {
    db.booking.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(booking({ userId: 'u2' }))
    db.booking.create.mockRejectedValueOnce(uniqueConflict())
    await expect(createBookingRecord('u1', draft)).rejects.toThrow(/different booking/)
  })
  it('allows an authenticated owner to replay their own booking', async () => {
    state.bookings[0].idempotencyKey = intent.idempotencyKey
    await expect(createBookingRecord('u1', draft)).resolves.toMatchObject({ created: false })
  })
  it('binds guest replay to the original request snapshot', async () => {
    state.bookings[0] = booking({ userId: null, idempotencyKey: intent.idempotencyKey })
    await expect(createBookingRecord(null, draft)).resolves.toMatchObject({ created: false, guestAccessUrl: null })
    await expect(createBookingRecord(null, { ...draft, contactEmail: 'other@example.com' })).rejects.toThrow(/different booking/)
    await expect(createBookingRecord(null, { ...draft, totalCents: 1 })).rejects.toThrow(/different booking/)
  })
})

describe('refund locking and structured idempotency', () => {
  beforeEach(() => { state.payments = [payment({ status: 'PAID', amountPaid: '500.00', provider: 'offline' })] })
  it.each(['payment', 'booking'])('rejects a %s currency change between preview and lock', async (target) => {
    const original = db.$queryRaw.getMockImplementation()!
    db.$queryRaw.mockImplementationOnce(async (...args) => {
      if (target === 'payment') state.payments[0].currency = 'EUR'; else state.bookings[0].currency = 'EUR'
      return original(...args)
    })
    await expect(recordOfflineRefund(refund)).rejects.toThrow(/currency does not match/)
    expect(db.payment.updateMany).not.toHaveBeenCalled(); expect(db.$executeRaw).not.toHaveBeenCalled()
  })
  it('locks booking before payment and preserves the USD check at the write boundary', async () => {
    await recordOfflineRefund(refund)
    expect(db.$queryRaw.mock.calls.map((args) => args[0].join(''))).toEqual([
      expect.stringMatching(/FROM bookings[\s\S]*FOR UPDATE/), expect.stringMatching(/currency[\s\S]*FROM payments[\s\S]*FOR UPDATE/),
    ])
  })
  it('changing only a free-text note cannot record the same refund twice', async () => {
    await recordOfflineRefund({ ...refund, note: 'first note' })
    await expect(recordOfflineRefund({ ...refund, note: 'edited note' })).resolves.toMatchObject({ created: false })
    expect(Number(state.payments[0].amountRefunded)).toBe(100); expect(db.payment.updateMany).toHaveBeenCalledTimes(1)
  })
  it('different refund amounts sharing a reference are distinct evidence', async () => {
    await recordOfflineRefund(refund)
    await expect(recordOfflineRefund({ ...refund, amount: 50 })).resolves.toMatchObject({ created: true })
    expect(Number(state.payments[0].amountRefunded)).toBe(150)
  })
  it('concurrent identical full refunds replay after the first settles', async () => {
    const results = await Promise.all([recordOfflineRefund({ ...refund, amount: 500 }), recordOfflineRefund({ ...refund, amount: 500 })])
    expect(results.map((r) => r.created).sort()).toEqual([false, true])
    expect(Number(state.payments[0].amountRefunded)).toBe(500); expect(db.payment.updateMany).toHaveBeenCalledTimes(1)
  })
  it('rejects a changed receipt method or reference on an existing key', async () => {
    state.payments = []
    await recordOfflinePayment(receipt)
    await expect(recordOfflinePayment({ ...receipt, method: 'bank_transfer' })).rejects.toThrow(/different payment/)
    await expect(recordOfflinePayment({ ...receipt, referenceNote: 'OTHER-IN' })).rejects.toThrow(/different payment/)
    expect(db.payment.create).toHaveBeenCalledTimes(1)
  })
  it.each([Number.MAX_VALUE, 1e14, 1e-12])('rejects unsafe refund input %s before writing', async (amount) => {
    await expect(recordOfflineRefund({ ...refund, amount })).rejects.toThrow(/Invalid payment amounts/)
    expect(db.payment.updateMany).not.toHaveBeenCalled()
  })
})
