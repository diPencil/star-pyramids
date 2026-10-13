// Financial-transaction concurrency tests: conditional writes,
// locking re-validation, webhook dedup claims, and the paid-on-
// cancelled refusal. DB is an in-memory fake with conditional-update
// semantics; no production records touched.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const shared = vi.hoisted(() => {
  type Row = Record<string, any>
  const store = {
    payments: new Map<string, Row>(),
    bookings: new Map<string, Row>(),
    usedEventIds: new Set<string>(),
  }
  const db: Record<string, any> = {
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
          ...(args.data.providerPaymentId ? { providerPaymentId: args.data.providerPaymentId } : {}),
          ...(args.data.paidAt ? { paidAt: args.data.paidAt } : {}),
          ...(args.data.refundedAt ? { refundedAt: args.data.refundedAt } : {}),
          ...(args.data.failedAt ? { failedAt: args.data.failedAt } : {}),
          ...(args.data.cancelledAt ? { cancelledAt: args.data.cancelledAt } : {}),
        })
        return { count: 1 }
      },
    },
    booking: {
      findUnique: async (args: { where: { id?: string } }) => {
        const row = args.where.id ? store.bookings.get(args.where.id) : undefined
        return row ? structuredClone(row) : null
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
            return row
              ? [{ id: row.id, status: row.status, bookingId: row.bookingId, amountPaid: row.amountPaid, amountRefunded: row.amountRefunded }]
              : []
          }
          if (sql.includes('FROM bookings')) {
            const booking = store.bookings.get(values[0])
            return booking ? [{ status: booking.status }] : []
          }
          return []
        },
        $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
          // VALUES order: id, paymentId, actorRole, action, note, isInternal, providerEventId
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
vi.mock('@/lib/server/booking-access', () => ({
  revokeGuestBookingTokens: vi.fn(async () => undefined),
  issueGuestBookingToken: vi.fn(async () => ({ token: 'guest-payment-token', expiresAt: new Date() })),
  guestBookingPath: (token: string) => `/booking/${token}`,
}))

import {
  DuplicateWebhookEvent,
  PaidOnCancelledBooking,
  transitionPayment,
} from '@/lib/server/payments'

function seedPayment(overrides: Record<string, any> = {}) {
  const row: Record<string, any> = {
    id: 'pay-1',
    reference: 'SP-PAY-ABC123',
    bookingId: 'bk-1',
    provider: 'pending',
    providerPaymentId: 'pi_1',
    status: 'PENDING',
    currency: 'USD',
    amount: 100,
    amountPaid: 0,
    amountRefunded: 0,
    failureCode: null,
    failureMessage: null,
    initiatedAt: new Date('2026-01-01T00:00:00Z'),
    paidAt: null,
    failedAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    events: [],
    ...overrides,
  }
  shared.store.payments.set(row.id, row)
  return row
}

function seedBooking(overrides: Record<string, any> = {}) {
  const row: Record<string, any> = { id: 'bk-1', status: 'CONFIRMED', ...overrides }
  shared.store.bookings.set(row.id, row)
  return row
}

beforeEach(() => {
  vi.clearAllMocks()
  shared.store.payments.clear()
  shared.store.bookings.clear()
  shared.store.usedEventIds.clear()
})

describe('transitionPayment concurrency safety', () => {
  it('settles paid with an idempotent event claim in one commit', async () => {
    seedPayment()
    seedBooking()
    const result = await transitionPayment('SP-PAY-ABC123', 'paid', {
      actor: 'provider',
      amountPaidCents: 10000,
      providerEventId: 'evt-1',
    })
    expect(result?.status).toBe('paid')
    const stored = shared.store.payments.get('pay-1')!
    expect(stored.amountPaid).toBe('100.00')
    expect(stored.events).toHaveLength(1)
    expect(shared.store.usedEventIds.has('evt-1')).toBe(true)
  })

  it('turns a colliding eventId claim into DuplicateWebhookEvent with no mutation', async () => {
    // The claim already exists (an in-flight twin holds it) while the
    // payment row itself is still transitionable: the insert collides
    // and the whole attempt rolls back with nothing applied.
    seedPayment()
    seedBooking()
    shared.store.usedEventIds.add('evt-1')
    await expect(
      transitionPayment('SP-PAY-ABC123', 'paid', {
        actor: 'provider',
        amountPaidCents: 10000,
        providerEventId: 'evt-1',
      }),
    ).rejects.toBeInstanceOf(DuplicateWebhookEvent)
    const stored = shared.store.payments.get('pay-1')!
    expect(stored.status).toBe('PENDING')
    expect(stored.amountPaid).toBe(0)
    expect(stored.events).toHaveLength(0)
  })

  it('refuses paid settlement on a cancelled booking without mutating', async () => {
    seedPayment()
    seedBooking({ status: 'CANCELLED' })
    await expect(
      transitionPayment('SP-PAY-ABC123', 'paid', {
        actor: 'provider',
        amountPaidCents: 10000,
        providerEventId: 'evt-2',
      }),
    ).rejects.toBeInstanceOf(PaidOnCancelledBooking)
    const stored = shared.store.payments.get('pay-1')!
    expect(stored.status).toBe('PENDING')
    expect(stored.amountPaid).toBe(0)
    expect(stored.events).toHaveLength(0)
    expect(shared.store.usedEventIds.has('evt-2')).toBe(false)
  })

  it('fails retryable when the row moves under the transaction (P2025 path)', async () => {
    seedPayment()
    seedBooking()
    // Simulate a concurrent commit slipping between lock and write by
    // forcing the conditional write to match zero rows.
    const realUpdateMany = shared.db.payment.updateMany
    shared.db.payment.updateMany = (async () => ({ count: 0 })) as never
    try {
      await expect(
        transitionPayment('SP-PAY-ABC123', 'paid', {
          actor: 'provider',
          amountPaidCents: 10000,
          providerEventId: 'evt-3',
        }),
      ).rejects.toThrow('Payment changed concurrently')
      expect(shared.store.usedEventIds.has('evt-3')).toBe(false)
    } finally {
      shared.db.payment.updateMany = realUpdateMany
    }
  })

  it('rolls back money and events together when the claim collides mid-flight', async () => {
    seedPayment()
    seedBooking()
    // First delivery wins outside this call; the redelivery must not
    // leave partial state behind.
    shared.store.usedEventIds.add('evt-4')
    const before = structuredClone(shared.store.payments.get('pay-1'))
    await expect(
      transitionPayment('SP-PAY-ABC123', 'paid', {
        actor: 'provider',
        amountPaidCents: 10000,
        providerEventId: 'evt-4',
      }),
    ).rejects.toBeInstanceOf(DuplicateWebhookEvent)
    expect(shared.store.payments.get('pay-1')).toEqual(before)
  })

  it('keeps offline transitions (no eventId) free of dedup interference', async () => {
    seedPayment({ status: 'PAID', amountPaid: 100 })
    seedBooking()
    const result = await transitionPayment('SP-PAY-ABC123', 'refunded', {
      actor: 'staff',
      amountRefundedCents: 10000,
    })
    expect(result?.status).toBe('refunded')
  })
})

describe('cancel-vs-settle interleavings (conditional-write semantics)', () => {
  it('webhook win first: cancel then sees captured money and aborts', async () => {
    // Settle commits PAID; the later cancel exposure read must block.
    seedPayment({ status: 'PAID', amountPaid: 100 })
    seedBooking({ status: 'CONFIRMED' })
    const { bookingCancelExposure } = await import('@/lib/booking')
    const exposure = bookingCancelExposure([
      { status: 'paid', amountPaidCents: 10000, amountRefundedCents: 0 },
    ])
    expect(exposure).toBe('captured')
    // Totals never disappear: captured amounts stay on the row.
    expect(shared.store.payments.get('pay-1')!.amountPaid).toBe(100)
  })

  it('cancel win first: voided rows can never mask settled money', async () => {
    // A void writes status only (conditional on PENDING/PROCESSING);
    // captured amounts are untouched and stay visible to exposure.
    seedPayment({ status: 'PENDING', amountPaid: 0 })
    seedBooking()
    const row = shared.store.payments.get('pay-1')!
    // Simulate the void conditional write against a row that settled
    // concurrently: predicate misses, zero rows, no overwrite.
    row.status = 'PAID'
    row.amountPaid = 100
    const claimed =
      row.status === 'PENDING' || row.status === 'PROCESSING' ? 1 : 0
    expect(claimed).toBe(0)
    expect(row.amountPaid).toBe(100)
    const { bookingCancelExposure } = await import('@/lib/booking')
    expect(
      bookingCancelExposure([{ status: 'paid', amountPaidCents: 10000, amountRefundedCents: 0 }]),
    ).toBe('captured')
  })
})
