// Offline (manual) refund tests: staff-recorded returns of captured
// money. All DB/mail boundaries mocked — no production records touched.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const shared = vi.hoisted(() => {
  type Row = Record<string, any>
  const store = {
    payments: new Map<string, Row>(),
    bookings: new Map<string, Row>(),
    usedEventIds: new Set<string>(),
  }
  const db: Record<string, any> = {
    booking: {
      findUnique: async (args: { where: { reference?: string; id?: string } }) => {
        const row = [...store.bookings.values()].find((b) =>
          args.where.reference ? b.reference === args.where.reference : b.id === args.where.id,
        )
        return row ? structuredClone(row) : null
      },
    },
    payment: {
      findUnique: async (args: { where: { reference?: string; id?: string } }) => {
        const row = [...store.payments.values()].find((p) =>
          args.where.reference ? p.reference === args.where.reference : p.id === args.where.id,
        )
        if (!row) return null
        const full = structuredClone(row)
        full.booking = { reference: 'SP-BK-TEST01', user: null }
        full.events = (full.events ?? []).map((e: any) => ({ createdAt: new Date(), ...e }))
        return full
      },
      updateMany: async (args: { where: { id?: string; status?: string }; data: any }) => {
        const row = args.where.id ? store.payments.get(args.where.id) : undefined
        if (!row) return { count: 0 }
        if (args.where.status !== undefined && row.status !== args.where.status) return { count: 0 }
        Object.assign(row, {
          ...(args.data.status ? { status: args.data.status } : {}),
          ...(args.data.amountPaid !== undefined ? { amountPaid: args.data.amountPaid } : {}),
          ...(args.data.amountRefunded !== undefined ? { amountRefunded: args.data.amountRefunded } : {}),
          ...(args.data.refundedAt ? { refundedAt: args.data.refundedAt } : {}),
        })
        return { count: 1 }
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const snap = {
        payments: new Map([...store.payments].map(([k, v]) => [k, structuredClone(v)])),
        usedEventIds: new Set(store.usedEventIds),
      }
      const tx = {
        ...db,
        $queryRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
          const sql = strings.join('?')
          if (sql.includes('FROM payments')) {
            const row = [...store.payments.values()].find((p) => p.reference === values[0])
            return row ? [{ id: row.id, status: row.status, bookingId: row.bookingId }] : []
          }
          if (sql.includes('FROM bookings')) {
            const booking = store.bookings.get(values[0])
            return booking ? [{ status: booking.status }] : []
          }
          return []
        },
        $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
          const eventId = values[6] as string | null
          if (eventId) {
            if (store.usedEventIds.has(eventId)) throw { code: 'P2002' }
            store.usedEventIds.add(eventId)
          }
          const payment = store.payments.get(values[1] as string)
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
        store.payments = snap.payments
        store.usedEventIds = snap.usedEventIds
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

import { recordOfflineRefund, deriveBookingPaymentSummary } from '@/lib/server/payments'
import { bookingCancelExposure } from '@/lib/booking'
import { notifyStaff } from '@/lib/server/notifications'

function seedPaidPayment(overrides: Record<string, any> = {}) {
  const row: Record<string, any> = {
    id: 'pay-1',
    reference: 'SP-PAY-ABC123',
    bookingId: 'bk-1',
    provider: 'offline',
    providerPaymentId: null,
    status: 'PAID',
    currency: 'USD',
    amount: 500,
    amountPaid: 500,
    amountRefunded: 0,
    failureCode: null,
    failureMessage: null,
    initiatedAt: new Date('2026-01-01T00:00:00Z'),
    paidAt: new Date('2026-01-02T00:00:00Z'),
    failedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    events: [],
    ...overrides,
  }
  shared.store.payments.set(row.id, row)
  shared.store.bookings.set('bk-1', { id: 'bk-1', status: 'CONFIRMED' })
  return row
}

const refund = (overrides: Record<string, any> = {}) => ({
  paymentReference: 'SP-PAY-ABC123',
  amount: 500,
  method: 'bank_transfer',
  externalReference: 'BANK-OUT-1',
  note: '',
  confirmReturned: true,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  shared.store.payments.clear()
  shared.store.bookings.clear()
  shared.store.usedEventIds.clear()
})

describe('recordOfflineRefund', () => {
  it('records a full refund with history and staff notice', async () => {
    seedPaidPayment()
    const result = await recordOfflineRefund(refund())
    expect(result.created).toBe(true)
    expect(result.payment.status).toBe('refunded')
    expect(result.payment.amountRefunded).toBe(500)
    const stored = shared.store.payments.get('pay-1')!
    expect(stored.refundedAt).not.toBeNull()
    expect(stored.events.map((e: any) => e.action)).toContain('Payment refunded')
    expect(vi.mocked(notifyStaff)).toHaveBeenCalledTimes(1)
  })

  it('records a partial refund without claiming full settlement', async () => {
    seedPaidPayment()
    const result = await recordOfflineRefund(refund({ amount: 200, externalReference: 'BANK-OUT-2' }))
    expect(result.created).toBe(true)
    expect(result.payment.status).toBe('partially_refunded')
    expect(result.payment.amountRefunded).toBe(200)
    expect(result.payment.amountPaid).toBe(500)
  })

  it('rejects over-refunds beyond the remaining refundable balance', async () => {
    seedPaidPayment()
    await expect(recordOfflineRefund(refund({ amount: 600 }))).rejects.toThrow(
      'exceeds the remaining refundable balance',
    )
    expect(shared.store.payments.get('pay-1')!.amountRefunded).toBe(0)
    await recordOfflineRefund(refund({ amount: 200, externalReference: 'BANK-OUT-3' }))
    await expect(recordOfflineRefund(refund({ amount: 400, externalReference: 'BANK-OUT-4' }))).rejects.toThrow(
      'exceeds the remaining refundable balance',
    )
  })

  it('rejects refunds with no captured money', async () => {
    seedPaidPayment({ status: 'PENDING', amountPaid: 0 })
    await expect(recordOfflineRefund(refund())).rejects.toThrow('no captured money')
    expect(shared.store.payments.get('pay-1')!.events).toHaveLength(0)
  })

  it('returns the existing record on duplicate submission (same triple)', async () => {
    seedPaidPayment()
    const first = await recordOfflineRefund(refund())
    expect(first.created).toBe(true)
    const second = await recordOfflineRefund(refund())
    expect(second.created).toBe(false)
    expect(second.payment.reference).toBe(first.payment.reference)
    const refundEvents = shared.store
      .payments.get('pay-1')!
      .events.filter((e: any) => e.action === 'Payment refunded')
    expect(refundEvents).toHaveLength(1)
  })

  it('keeps concurrent refunds within captured money', async () => {
    seedPaidPayment()
    // Two $400 refunds race on $500 captured: at most one records, the
    // loser fails retryable (stale pre-read vs locked state) without
    // ever exceeding the captured total.
    const outcomes = await Promise.allSettled([
      recordOfflineRefund(refund({ amount: 400, externalReference: 'BANK-A' })),
      recordOfflineRefund(refund({ amount: 400, externalReference: 'BANK-B' })),
    ])
    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled')
    expect(fulfilled.length).toBeLessThanOrEqual(1)
    // Whatever interleaving wins, captured money is never exceeded and
    // the ledger stays internally consistent (status/amounts/events
    // agree). NOTE: the in-memory mock rolls back by restoring a
    // snapshot, which — unlike per-transaction InnoDB rollback — can
    // clobber a concurrent commit; production isolation is stronger
    // than this mock, so only invariants are asserted here.
    const stored = shared.store.payments.get('pay-1')!
    expect(Number(stored.amountRefunded)).toBeLessThanOrEqual(Number(stored.amountPaid))
    const settled = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(stored.status)
    expect(settled).toBe(true)
  })

  it('requires method, confirmation, and external reference', async () => {
    seedPaidPayment()
    await expect(recordOfflineRefund(refund({ method: 'crypto' }))).rejects.toThrow('valid refund method')
    await expect(recordOfflineRefund(refund({ confirmReturned: false }))).rejects.toThrow(
      'actually been returned',
    )
    await expect(recordOfflineRefund(refund({ externalReference: '' }))).rejects.toThrow(
      'external bank',
    )
    await expect(recordOfflineRefund(refund({ amount: 10.999 }))).rejects.toThrow('2 decimals')
    expect(shared.store.payments.get('pay-1')!.amountRefunded).toBe(0)
  })

  it('allows refunds on cancelled bookings (money was captured)', async () => {
    seedPaidPayment()
    shared.store.bookings.set('bk-1', { id: 'bk-1', status: 'CANCELLED' })
    const result = await recordOfflineRefund(refund())
    expect(result.created).toBe(true)
    expect(result.payment.status).toBe('refunded')
  })

  it('makes a fully refunded booking cancellable under the existing guard', async () => {
    seedPaidPayment()
    await recordOfflineRefund(refund())
    const rows = [...shared.store.payments.values()].map((p) => ({
      status: String(p.status).toLowerCase(),
      amountPaidCents: Math.round(Number(p.amountPaid) * 100),
      amountRefundedCents: Math.round(Number(p.amountRefunded) * 100),
    }))
    expect(bookingCancelExposure(rows)).toBe('none')
    const summary = deriveBookingPaymentSummary(
      rows.map((r) => ({
        status: String(r.status).toLowerCase() as 'refunded',
        amountPaidCents: r.amountPaidCents,
        amountRefundedCents: r.amountRefundedCents,
        reference: 'SP-PAY-ABC123',
        createdAt: new Date(),
      })),
      50000,
    )
    expect(summary.state).toBe('refunded')
  })
})

describe('POST /api/admin/payments/[ref]/refund authorization', () => {
  it('rejects staff without payments.edit with 403', async () => {
    vi.resetModules()
    vi.doMock('@/lib/server/auth', () => ({
      getCurrentUser: vi.fn(async () => ({ id: 's1', roles: ['STAFF'], permissions: [] })),
      hasPermission: (user: any, key: string) => user.roles.includes('SUPER_ADMIN') || user.permissions.includes(key),
    }))
    const { POST } = await import('@/app/api/admin/payments/[ref]/refund/route')
    const res = await POST(
      new Request('http://localhost:3000/api/admin/payments/x/refund', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          'x-forwarded-host': 'localhost:3000',
        },
        body: JSON.stringify({ amount: 1, method: 'cash', externalReference: 'R', confirmReturned: true }),
      }),
      { params: Promise.resolve({ ref: 'SP-PAY-ABC123' }) },
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden.' })
  })
})
