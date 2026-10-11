// Cancellation financial-safety tests: paid bookings can never be
// cancelled without a verified refund; in-flight attempts are voided
// atomically; duplicates resolve to the settled view. DB and mail
// boundaries are fully mocked — no production records touched.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  BOOKING_FINANCIAL_REVIEW_CODE,
  bookingCancelExposure,
} from '@/lib/booking'

type Row = Record<string, any>

const helpers = vi.hoisted(() => {
  type Row = Record<string, any>
  const store = {
    bookings: new Map<string, Row>(),
    payments: [] as Row[],
  }

  function snapshot() {
    return {
      bookings: new Map([...store.bookings].map(([k, v]) => [k, structuredClone(v)])),
      payments: structuredClone(store.payments),
    }
  }

  function restore(snap: { bookings: Map<string, Row>; payments: Row[] }) {
    store.bookings = snap.bookings
    store.payments = snap.payments
  }

  function joinBooking(row: Row): Row {
    return {
      ...structuredClone(row),
      items: structuredClone(row.items ?? []),
      activities: structuredClone(row.activities ?? []),
      payments: structuredClone(store.payments.filter((p) => p.bookingId === row.id)),
    }
  }

  function project(row: Row, select?: Record<string, boolean>): Row {
    if (!select) return row
    const out: Row = {}
    for (const key of Object.keys(select)) if (select[key]) out[key] = row[key]
    return out
  }

  const bookingApi: Record<string, any> = {
    findUnique: async (args: { where: { reference?: string; id?: string }; select?: any }) => {
      const row = [...store.bookings.values()].find((b) =>
        args.where.reference ? b.reference === args.where.reference : b.id === args.where.id,
      )
      if (!row) return null
      if (args.select) return project(row, args.select)
      return joinBooking(row)
    },
    update: async (args: { where: { id: string; status?: { in: string[] } }; data: any }) => {
      const row = store.bookings.get(args.where.id)
      if (!row) throw { code: 'P2025' }
      if (args.where.status?.in && !args.where.status.in.includes(row.status)) throw { code: 'P2025' }
      if (args.data.status) row.status = args.data.status
      const activity = args.data.activities?.create
      if (activity) {
        row.activities.push({ ...activity, note: activity.note ?? null, createdAt: new Date() })
      }
      return joinBooking(row)
    },
  }

  const paymentApi = {
    findMany: async (args: { where: { bookingId?: string; status?: { in: string[] } }; select?: any }) => {
      let rows = store.payments.filter((p) => (args.where.bookingId ? p.bookingId === args.where.bookingId : true))
      if (args.where.status?.in) rows = rows.filter((p) => args.where.status.in.includes(p.status))
      if (!args.select) return structuredClone(rows)
      return rows.map((p) => project(p, args.select))
    },
    update: async (args: { where: { id: string }; data: any }) => {
      const row = store.payments.find((p) => p.id === args.where.id)
      if (!row) throw { code: 'P2025' }
      if (args.data.status) row.status = args.data.status
      if (args.data.cancelledAt) row.cancelledAt = args.data.cancelledAt
      const event = args.data.events?.create
      if (event) {
        row.events = row.events ?? []
        row.events.push({ ...event, createdAt: new Date() })
      }
      return structuredClone(row)
    },
  }

  const fakeDb = {
    booking: bookingApi,
    payment: paymentApi,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const snap = snapshot()
      try {
        return await fn(fakeDb)
      } catch (error) {
        restore(snap)
        throw error
      }
    },
  }

  return { store, bookingApi, fakeDb }
})
const { store, bookingApi } = helpers

vi.mock('@/lib/server/db', () => ({ db: helpers.fakeDb }))
vi.mock('@/lib/server/notifications', () => ({
  notifyUser: vi.fn(),
  notifyStaff: vi.fn(),
}))
vi.mock('@/lib/server/email', () => ({
  sendCustomerEmailSafe: vi.fn(),
  sendStaffEmailSafe: vi.fn(),
}))
vi.mock('@/lib/server/booking-access', () => ({
  ownerBookingLink: vi.fn(async () => ({ detailUrl: '/x', accessNote: '' })),
}))

import {
  BookingFinancialReviewError,
  cancelCustomerBooking,
  transitionStaffBooking,
} from '@/lib/server/bookings'
import { notifyUser } from '@/lib/server/notifications'

// ---- Fixtures ----
let seq = 0
function seedBooking(overrides: Partial<Row> = {}): Row {
  seq += 1
  const row: Row = {
    id: `bk-${seq}`,
    reference: `SP-BK-TEST${String(seq).padStart(2, '0')}`,
    userId: 'user-1',
    status: 'CONFIRMED',
    paymentStatus: 'PENDING',
    contactName: 'Test Guest',
    contactEmail: 'guest@example.com',
    contactPhone: '+200000000000',
    notes: null,
    subtotal: 500,
    discount: 0,
    total: 500,
    items: [],
    activities: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
  store.bookings.set(row.id, row)
  return row
}

function seedPayment(bookingId: string, overrides: Partial<Row> = {}): Row {
  seq += 1
  const row: Row = {
    id: `pay-${seq}`,
    bookingId,
    reference: `SP-PAY-T${String(seq).padStart(4, '0')}`,
    status: 'PENDING',
    amount: 500,
    amountPaid: 0,
    amountRefunded: 0,
    events: [],
    createdAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  }
  store.payments.push(row)
  return row
}

beforeEach(() => {
  store.bookings.clear()
  store.payments = []
  vi.clearAllMocks()
})

describe('bookingCancelExposure (pure)', () => {
  it('reports none for no payments, failed-only, cancelled-only, or fully refunded rows', () => {
    expect(bookingCancelExposure([])).toBe('none')
    expect(
      bookingCancelExposure([
        { status: 'failed', amountPaidCents: 0, amountRefundedCents: 0 },
        { status: 'cancelled', amountPaidCents: 0, amountRefundedCents: 0 },
      ]),
    ).toBe('none')
    expect(
      bookingCancelExposure([{ status: 'paid', amountPaidCents: 50000, amountRefundedCents: 50000 }]),
    ).toBe('none')
    expect(
      bookingCancelExposure([{ status: 'refunded', amountPaidCents: 50000, amountRefundedCents: 50000 }]),
    ).toBe('none')
  })

  it('reports captured for any net-positive settled money', () => {
    expect(bookingCancelExposure([{ status: 'paid', amountPaidCents: 50000, amountRefundedCents: 0 }])).toBe('captured')
    expect(
      bookingCancelExposure([{ status: 'partially_refunded', amountPaidCents: 50000, amountRefundedCents: 20000 }]),
    ).toBe('captured')
    expect(
      bookingCancelExposure([{ status: 'refunded', amountPaidCents: 50000, amountRefundedCents: 10000 }]),
    ).toBe('captured')
  })

  it('reports inflight for pending/processing attempts only', () => {
    expect(bookingCancelExposure([{ status: 'pending', amountPaidCents: 0, amountRefundedCents: 0 }])).toBe('inflight')
    expect(
      bookingCancelExposure([{ status: 'processing', amountPaidCents: 0, amountRefundedCents: 0 }]),
    ).toBe('inflight')
  })

  it('prefers captured over inflight when both exist', () => {
    expect(
      bookingCancelExposure([
        { status: 'pending', amountPaidCents: 0, amountRefundedCents: 0 },
        { status: 'paid', amountPaidCents: 50000, amountRefundedCents: 0 },
      ]),
    ).toBe('captured')
  })
})

describe('cancelCustomerBooking financial guard', () => {
  it('cancels an unpaid booking normally', async () => {
    const booking = seedBooking({ status: 'PENDING' })
    const result = await cancelCustomerBooking('user-1', booking.reference)
    expect(result?.status).toBe('cancelled')
    expect(store.bookings.get(booking.id)?.status).toBe('CANCELLED')
    expect(store.bookings.get(booking.id)?.activities).toHaveLength(1)
  })

  it('blocks a paid booking with a stable code and preserves all history', async () => {
    const booking = seedBooking({ status: 'CONFIRMED' })
    seedPayment(booking.id, { status: 'PAID', amountPaid: 500, amountRefunded: 0 })
    const before = structuredClone(store.payments)

    await expect(cancelCustomerBooking('user-1', booking.reference)).rejects.toMatchObject({
      name: 'BookingFinancialReviewError',
      code: BOOKING_FINANCIAL_REVIEW_CODE,
    })
    expect(store.bookings.get(booking.id)?.status).toBe('CONFIRMED')
    expect(store.bookings.get(booking.id)?.activities).toHaveLength(0)
    expect(store.payments).toEqual(before)
  })

  it('blocks a partially refunded booking (net captured remains)', async () => {
    const booking = seedBooking({ status: 'CONFIRMED' })
    seedPayment(booking.id, { status: 'PARTIALLY_REFUNDED', amountPaid: 500, amountRefunded: 200 })
    await expect(cancelCustomerBooking('user-1', booking.reference)).rejects.toMatchObject({
      code: BOOKING_FINANCIAL_REVIEW_CODE,
    })
    expect(store.bookings.get(booking.id)?.status).toBe('CONFIRMED')
  })

  it('cancels a fully refunded booking normally (nothing at stake)', async () => {
    const booking = seedBooking({ status: 'CONFIRMED' })
    seedPayment(booking.id, { status: 'REFUNDED', amountPaid: 500, amountRefunded: 500 })
    const result = await cancelCustomerBooking('user-1', booking.reference)
    expect(result?.status).toBe('cancelled')
  })

  it('voids a pending payment attempt atomically with the cancellation', async () => {
    const booking = seedBooking({ status: 'CONFIRMED' })
    const attempt = seedPayment(booking.id, { status: 'PENDING' })
    const result = await cancelCustomerBooking('user-1', booking.reference)
    expect(result?.status).toBe('cancelled')
    const stored = store.payments.find((p) => p.id === attempt.id)
    expect(stored?.status).toBe('CANCELLED')
    expect(stored?.events).toHaveLength(1)
    expect(stored?.events[0].actorRole).toBe('customer')
  })

  it('resolves a duplicate cancellation to the settled view without new activity', async () => {
    const booking = seedBooking({ status: 'CONFIRMED' })
    const first = await cancelCustomerBooking('user-1', booking.reference)
    expect(first?.status).toBe('cancelled')
    const second = await cancelCustomerBooking('user-1', booking.reference)
    expect(second?.status).toBe('cancelled')
    expect(store.bookings.get(booking.id)?.activities).toHaveLength(1)
  })

  it('returns the settled view when a concurrent cancellation wins (P2025 race)', async () => {
    const booking = seedBooking({ status: 'CONFIRMED' })
    // Simulate the winner committing between our pre-check and our tx:
    // pre-check still sees CONFIRMED, the commit loses, re-read settles.
    const realFind = bookingApi.findUnique
    const realUpdate = bookingApi.update
    let reads = 0
    bookingApi.findUnique = (async (args: any) => {
      reads += 1
      const row = await realFind(args)
      if (reads > 1 && row) return { ...row, status: 'CANCELLED' }
      return row
    }) as never
    bookingApi.update = (async () => {
      throw { code: 'P2025' }
    }) as never
    try {
      const result = await cancelCustomerBooking('user-1', booking.reference)
      expect(result?.status).toBe('cancelled')
      expect(store.bookings.get(booking.id)?.activities).toHaveLength(0)
    } finally {
      bookingApi.findUnique = realFind
      bookingApi.update = realUpdate
    }
  })

  it('never mutates payment rows without a verified refund', async () => {
    const booking = seedBooking({ status: 'CONFIRMED' })
    seedPayment(booking.id, { status: 'PAID', amountPaid: 500, amountRefunded: 0 })
    seedPayment(booking.id, { status: 'PENDING' })
    const before = structuredClone(store.payments)
    await expect(cancelCustomerBooking('user-1', booking.reference)).rejects.toBeInstanceOf(
      BookingFinancialReviewError,
    )
    expect(store.payments).toEqual(before)
  })
})

describe('transitionStaffBooking cancellation guard', () => {
  it('cancels an unpaid booking and notifies once', async () => {
    const booking = seedBooking({ status: 'CONFIRMED' })
    const result = await transitionStaffBooking(booking.reference, 'cancelled', '', true)
    expect(result?.status).toBe('cancelled')
    expect(vi.mocked(notifyUser)).toHaveBeenCalledTimes(1)
  })

  it('blocks a paid booking with the same stable code', async () => {
    const booking = seedBooking({ status: 'CONFIRMED' })
    seedPayment(booking.id, { status: 'PAID', amountPaid: 500, amountRefunded: 0 })
    await expect(transitionStaffBooking(booking.reference, 'cancelled', '', true)).rejects.toMatchObject({
      code: BOOKING_FINANCIAL_REVIEW_CODE,
    })
    expect(store.bookings.get(booking.id)?.status).toBe('CONFIRMED')
    expect(vi.mocked(notifyUser)).not.toHaveBeenCalled()
  })

  it('voids pending attempts with the staff actor and keeps other transitions intact', async () => {
    const booking = seedBooking({ status: 'PENDING' })
    const attempt = seedPayment(booking.id, { status: 'PROCESSING' })
    const confirmed = await transitionStaffBooking(booking.reference, 'confirmed', '', true)
    expect(confirmed?.status).toBe('confirmed')
    expect(store.payments.find((p) => p.id === attempt.id)?.status).toBe('PROCESSING')
    const cancelled = await transitionStaffBooking(booking.reference, 'cancelled', '', true)
    expect(cancelled?.status).toBe('cancelled')
    const stored = store.payments.find((p) => p.id === attempt.id)
    expect(stored?.status).toBe('CANCELLED')
    expect(stored?.events[0].actorRole).toBe('staff')
  })

  it('duplicate staff cancellation returns the view without re-notifying', async () => {
    const booking = seedBooking({ status: 'CONFIRMED' })
    await transitionStaffBooking(booking.reference, 'cancelled', '', true)
    expect(vi.mocked(notifyUser)).toHaveBeenCalledTimes(1)
    const second = await transitionStaffBooking(booking.reference, 'cancelled', '', true)
    expect(second?.status).toBe('cancelled')
    expect(vi.mocked(notifyUser)).toHaveBeenCalledTimes(1)
    expect(store.bookings.get(booking.id)?.activities).toHaveLength(1)
  })
})
