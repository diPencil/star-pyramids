// Offline (manual) payment tests: staff-recorded cash/bank receipts.
// All DB/mail boundaries mocked — no production records touched.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const shared = vi.hoisted(() => {
  type Row = Record<string, any>
  const store = {
    bookings: new Map<string, Row>(),
    payments: [] as Row[],
    usedEventIds: new Set<string>(),
    bookingStatusForRaw: 'CONFIRMED' as string,
  }
  const db: Record<string, any> = {
    booking: {
      findUnique: async (args: { where: { reference?: string; id?: string } }) => {
        const row = [...shared.store.bookings.values()].find((b) =>
          args.where.reference ? b.reference === args.where.reference : b.id === args.where.id,
        )
        return row ? structuredClone(row) : null
      },
    },
    payment: {
      findUnique: async (args: { where: { reference?: string; id?: string; idempotencyKey?: string } }) => {
        const row = shared.store.payments.find((p) =>
          args.where.reference
            ? p.reference === args.where.reference
            : args.where.id
              ? p.id === args.where.id
              : p.idempotencyKey === args.where.idempotencyKey,
        )
        if (!row) return null
        const full = structuredClone(row)
        full.booking = { reference: 'SP-BK-TEST01', user: null }
        full.events = (full.events ?? []).map((e: any) => ({ createdAt: new Date(), ...e }))
        return full
      },
      findMany: async (args: { where: { bookingId?: string } }) =>
        structuredClone(shared.store.payments.filter((p) => p.bookingId === args.where.bookingId)),
      create: async (args: { data: any }) => {
        if (
          args.data.idempotencyKey &&
          shared.store.payments.some((p) => p.idempotencyKey === args.data.idempotencyKey)
        ) {
          throw { code: 'P2002', meta: { target: ['idempotencyKey'] } }
        }
        const { events: _nestedEvents, ...scalarData } = structuredClone(args.data)
        const row = {
          id: `pay-${shared.store.payments.length + 1}`,
          events: [],
          providerPaymentId: null,
          currency: 'USD',
          failureCode: null,
          failureMessage: null,
          initiatedAt: new Date(),
          paidAt: null,
          failedAt: null,
          cancelledAt: null,
          refundedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
          ...scalarData,
        }
        const nested = args.data.events?.create
        if (nested) {
          row.events.push({ ...nested, id: `ev-${row.id}`, createdAt: new Date() })
        }
        shared.store.payments.push(row)
        return structuredClone(row)
      },
      updateMany: async (args: { where: { id?: string; status?: string }; data: any }) => {
        const row = args.where.id ? shared.store.payments.find((p) => p.id === args.where.id) : undefined
        if (!row) return { count: 0 }
        if (args.where.status !== undefined && row.status !== args.where.status) return { count: 0 }
        Object.assign(row, {
          ...(args.data.status ? { status: args.data.status } : {}),
          ...(args.data.amountPaid !== undefined ? { amountPaid: args.data.amountPaid } : {}),
          ...(args.data.amountRefunded !== undefined ? { amountRefunded: args.data.amountRefunded } : {}),
          ...(args.data.providerPaymentId ? { providerPaymentId: args.data.providerPaymentId } : {}),
          ...(args.data.paidAt ? { paidAt: args.data.paidAt } : {}),
          ...(args.data.refundedAt ? { refundedAt: args.data.refundedAt } : {}),
          ...(args.data.failedAt ? { failedAt: args.data.failedAt } : {}),
          ...(args.data.cancelledAt ? { cancelledAt: args.data.cancelledAt } : {}),
        })
        return { count: 1 }
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const snap = {
        payments: structuredClone(shared.store.payments),
        usedEventIds: new Set(shared.store.usedEventIds),
      }
      const tx = {
        ...db,
        $queryRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
          const sql = strings.join('?')
          if (sql.includes('FROM payments')) {
            const row = shared.store.payments.find((p) => p.reference === values[0])
            return row ? [{ id: row.id, status: row.status, bookingId: row.bookingId }] : []
          }
          if (sql.includes('FROM bookings')) {
            return [{ status: shared.store.bookingStatusForRaw }]
          }
          return []
        },
        $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
          const eventId = values[6] as string | null
          if (eventId) {
            if (shared.store.usedEventIds.has(eventId)) throw { code: 'P2002' }
            shared.store.usedEventIds.add(eventId)
          }
          const payment = shared.store.payments.find((p) => p.id === (values[1] as string))
          if (payment) {
            payment.events = payment.events ?? []
            payment.events.push({
              id: values[0],
              actorRole: values[2],
              action: values[3],
              note: values[4],
              isInternal: values[5],
              createdAt: new Date(),
            })
          }
          return 1
        },
      }
      try {
        return await fn(tx)
      } catch (error) {
        shared.store.payments = snap.payments
        shared.store.usedEventIds = snap.usedEventIds
        throw error
      }
    },
  }
  return { store, db }
})
const { store } = shared

vi.mock('@/lib/server/db', () => ({ db: shared.db }))
vi.mock('@/lib/server/email', () => ({
  sendCustomerEmailSafe: vi.fn(async () => undefined),
  sendStaffEmailSafe: vi.fn(async () => undefined),
}))
vi.mock('@/lib/server/notifications', () => ({
  notifyUser: vi.fn(async () => undefined),
  notifyStaff: vi.fn(async () => undefined),
}))

import { recordOfflinePayment, deriveBookingPaymentSummary } from '@/lib/server/payments'
import { notifyStaff } from '@/lib/server/notifications'

function seedBooking(overrides: Record<string, any> = {}) {
  const row: Record<string, any> = {
    id: 'bk-1',
    reference: 'SP-BK-TEST01',
    userId: 'user-1',
    status: 'CONFIRMED',
    total: 500,
    currency: 'USD',
    contactName: 'Test Guest',
    contactEmail: 'guest@example.com',
    contactPhone: '+200000000000',
    ...overrides,
  }
  shared.store.bookings.set(row.id, row)
  return row
}

const receipt = (overrides: Record<string, any> = {}) => ({
  bookingReference: 'SP-BK-TEST01',
  amount: 500,
  currency: 'USD',
  method: 'bank_transfer',
  referenceNote: 'BANK-REF-1',
  idempotencyKey: 'offline-key-1',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  shared.store.bookings.clear()
  shared.store.payments = []
  shared.store.usedEventIds.clear()
  shared.store.bookingStatusForRaw = 'CONFIRMED'
})

describe('recordOfflinePayment', () => {
  it('records a valid full offline payment as PAID with history', async () => {
    seedBooking()
    const result = await recordOfflinePayment(receipt())
    expect(result).not.toBeNull()
    expect(result!.created).toBe(true)
    expect(result!.payment.status).toBe('paid')
    expect(result!.payment.amountPaid).toBe(500)
    expect(result!.payment.provider).toBe('offline')
    const stored = shared.store.payments.find((p) => p.reference === result!.payment.reference)!
    expect(stored.provider).toBe('offline')
    expect(stored.events.map((e: any) => e.action)).toEqual(
      expect.arrayContaining(['Offline payment recorded', 'Payment completed']),
    )
    expect(vi.mocked(notifyStaff)).toHaveBeenCalledTimes(1)
  })

  it('returns the original receipt on duplicate idempotency key', async () => {
    seedBooking()
    const first = (await recordOfflinePayment(receipt()))!
    const second = (await recordOfflinePayment(receipt()))!
    expect(second.created).toBe(false)
    expect(second.payment.reference).toBe(first.payment.reference)
    expect(shared.store.payments).toHaveLength(1)
  })

  it('rejects wrong currency without creating anything', async () => {
    seedBooking()
    await expect(recordOfflinePayment(receipt({ currency: 'EUR' }))).rejects.toThrow(
      'recorded in USD only',
    )
    expect(shared.store.payments).toHaveLength(0)
  })

  it('rejects unknown methods, bad amounts, and missing keys', async () => {
    seedBooking()
    await expect(recordOfflinePayment(receipt({ method: 'crypto' }))).rejects.toThrow(
      'valid payment method',
    )
    await expect(recordOfflinePayment(receipt({ amount: 0 }))).rejects.toThrow('valid received amount')
    await expect(recordOfflinePayment(receipt({ amount: 10.999 }))).rejects.toThrow('2 decimals')
    await expect(recordOfflinePayment(receipt({ idempotencyKey: 'x' }))).rejects.toThrow()
    expect(shared.store.payments).toHaveLength(0)
  })

  it('rejects overpayment beyond the remaining balance', async () => {
    seedBooking()
    await expect(recordOfflinePayment(receipt({ amount: 600, idempotencyKey: 'offline-key-2' }))).rejects.toThrow(
      'exceeds the remaining balance',
    )
    expect(shared.store.payments).toHaveLength(0)
  })

  it('returns null for unknown bookings and throws for cancelled ones', async () => {
    expect(await recordOfflinePayment(receipt())).toBeNull()
    seedBooking({ status: 'CANCELLED' })
    await expect(recordOfflinePayment(receipt())).rejects.toThrow('Only pending or confirmed')
  })

  it('accumulates partial receipts honestly without faking full payment', async () => {
    seedBooking()
    const first = (await recordOfflinePayment(receipt({ amount: 200, idempotencyKey: 'offline-p1' })))!
    expect(first.payment.status).toBe('paid')
    const summary = deriveBookingPaymentSummary(
      shared.store.payments.map((p) => ({
        status: 'paid' as const,
        amountPaidCents: Math.round(Number(p.amountPaid) * 100),
        amountRefundedCents: 0,
        reference: p.reference,
        createdAt: new Date(),
      })),
      50000,
    )
    expect(summary.paidTotal).toBe(200)
    expect(summary.state).toBe('pending')
    const second = (await recordOfflinePayment(receipt({ amount: 300, idempotencyKey: 'offline-p2' })))!
    expect(second.created).toBe(true)
    expect(shared.store.payments).toHaveLength(2)
  })

  it('voids the orphan receipt when the booking cancels mid-recording', async () => {
    seedBooking()
    // The pre-check sees CONFIRMED, but the locked settlement read
    // observes CANCELLED: the receipt must be voided, never paid.
    shared.store.bookingStatusForRaw = 'CANCELLED'
    await expect(recordOfflinePayment(receipt())).rejects.toThrow('voided; no money was marked paid')
    const rows = shared.store.payments.filter((p) => p.reference.startsWith('SP-PAY-'))
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('CANCELLED')
    expect(rows[0].amountPaid).toBe('0.00')
  })
})

describe('POST /api/admin/payments/record authorization', () => {
  it('rejects staff without payments.edit with 403', async () => {
    vi.resetModules()
    vi.doMock('@/lib/server/auth', () => ({
      getCurrentUser: vi.fn(async () => ({ id: 's1', roles: ['STAFF'], permissions: [] })),
      hasPermission: (user: any, key: string) => user.roles.includes('SUPER_ADMIN') || user.permissions.includes(key),
    }))
    const { POST } = await import('@/app/api/admin/payments/record/route')
    const res = await POST(
      new Request('http://localhost:3000/api/admin/payments/record', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          'x-forwarded-host': 'localhost:3000',
        },
        body: JSON.stringify(receipt()),
      }),
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden.' })
  })
})
