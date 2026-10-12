// Customer offline payment-proof tests (Phase 3: reference-only review).
// All DB/mail boundaries mocked — no production records touched.
//
// A proof submission appends ONE harmless BookingActivity row for staff
// review. It NEVER creates or settles a Payment row, accepts no files,
// and exposes no public URL (the media architecture serves public
// files only, so reference-only is the safe design).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const shared = vi.hoisted(() => {
  type Row = Record<string, any>
  const store = {
    bookings: new Map<string, Row>(),
    activities: [] as Row[],
    accessTokens: new Map<string, Row>(),
    paymentCreates: 0,
  }
  const matchesActivityWhere = (row: Row, where: Record<string, any>): boolean => {
    if (where.bookingId !== undefined && row.bookingId !== where.bookingId) return false
    if (where.action !== undefined && row.action !== where.action) return false
    if (where.createdAt?.gte !== undefined && !(row.createdAt >= where.createdAt.gte)) return false
    return true
  }
  const db: Record<string, any> = {
    booking: {
      findUnique: async (args: { where: { reference?: string; id?: string } }) => {
        const row = [...shared.store.bookings.values()].find((b) =>
          args.where.reference ? b.reference === args.where.reference : b.id === args.where.id,
        )
        if (!row) return null
        return {
          id: row.id,
          userId: row.userId,
          status: row.status,
          contactName: row.contactName,
          contactEmail: row.contactEmail,
        }
      },
    },
    bookingActivity: {
      count: async (args: { where: Record<string, any> }) =>
        shared.store.activities.filter((a) => matchesActivityWhere(a, args.where)).length,
      findFirst: async (args: { where: Record<string, any>; orderBy?: unknown }) => {
        const rows = shared.store.activities
          .filter((a) => matchesActivityWhere(a, args.where))
          .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())
        const first = rows[0]
        return first ? { createdAt: first.createdAt } : null
      },
      findMany: async (args: { where: Record<string, any> }) =>
        shared.store.activities
          .filter((a) => matchesActivityWhere(a, args.where))
          .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())
          .map((a) => ({ action: a.action, note: a.note, createdAt: a.createdAt })),
      create: async (args: { data: Record<string, any>; select?: unknown }) => {
        const row = {
          id: `act-${shared.store.activities.length + 1}`,
          isInternal: false,
          createdAt: new Date(),
          ...structuredClone(args.data),
        }
        // Preserve a real Date for createdAt (structuredClone of data has none).
        row.createdAt = new Date()
        shared.store.activities.push(row)
        return args.select ? { createdAt: row.createdAt } : structuredClone(row)
      },
    },
    bookingAccessToken: {
      findUnique: async () => {
        const row = [...shared.store.accessTokens.values()][0]
        if (!row) return null
        return { bookingRef: row.bookingRef, revokedAt: null, expiresAt: new Date(Date.now() + 3600_000) }
      },
      updateMany: async () => ({ count: 1 }),
    },
    payment: {
      // Any money write here is a test failure: proofs must never move money.
      create: vi.fn(async () => {
        throw new Error('proofs must never create payments')
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    // Interactive transactions run against the same in-memory store
    // (single-threaded: no real lock contention under mocks — the
    // serialized-race path is covered against the real database in
    // payment-proofs-concurrency.test.ts).
    $queryRaw: async () => [],
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(shared.db),
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

import { GuestBookingAccessError } from '@/lib/server/booking-access'
import {
  acknowledgePaymentProof,
  submitCustomerPaymentProof,
  submitGuestPaymentProof,
  validateProofInput,
} from '@/lib/server/payment-proofs'
import { bookingOfflinePaymentLabel } from '@/lib/payment'
import { derivePaymentProofs, formatPaymentProofNote, parsePaymentProofNote } from '@/lib/booking'
import { notifyStaff, notifyUser } from '@/lib/server/notifications'
import { sendCustomerEmailSafe, sendStaffEmailSafe } from '@/lib/server/email'

const GUEST_TOKEN = 'a'.repeat(43)

function seedAccountBooking(overrides: Record<string, any> = {}) {
  const row = {
    id: 'bk-1',
    reference: 'SP-BK-TEST01',
    userId: 'user-1',
    status: 'PENDING',
    contactName: 'Test Guest',
    contactEmail: 'guest@example.com',
    ...overrides,
  }
  shared.store.bookings.set(row.id, row)
  return row
}

function seedGuestBooking() {
  const row = seedAccountBooking({ id: 'bk-guest', reference: 'SP-BK-GUEST1', userId: null })
  shared.store.accessTokens.set('token-1', { bookingRef: row.reference })
  return row
}

const proofInput = (overrides: Record<string, any> = {}) => ({
  reference: 'BANK-REF-123',
  method: 'bank_transfer' as const,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  shared.store.bookings.clear()
  shared.store.activities = []
  shared.store.accessTokens.clear()
})

describe('validateProofInput', () => {
  it('accepts a reference with an optional offline method', () => {
    expect(validateProofInput({ reference: 'BANK-REF-1', method: 'cash' })).toEqual({
      reference: 'BANK-REF-1',
      method: 'cash',
    })
    expect(validateProofInput({ reference: 'BANK-REF-1' })).toEqual({
      reference: 'BANK-REF-1',
      method: null,
    })
  })

  it('rejects unknown keys, short references, and bad methods', () => {
    expect(() => validateProofInput({ reference: 'AB' })).toThrow('3-128')
    expect(() => validateProofInput({ reference: 'BANK-REF-1', amount: 5 })).toThrow('Invalid request')
    expect(() => validateProofInput({ reference: 'BANK-REF-1', method: 'crypto' })).toThrow('valid payment method')
    expect(() => validateProofInput({ reference: 'BANK-REF-1', file: 'x.png' })).toThrow('Invalid request')
  })
})

describe('submitCustomerPaymentProof', () => {
  it('stores one customer activity row and confirms receipt, not payment', async () => {
    seedAccountBooking()
    const submitted = (await submitCustomerPaymentProof('user-1', 'SP-BK-TEST01', proofInput()))!
    expect(submitted.created).toBe(true)
    expect(submitted.duplicate).toBe(false)
    expect(submitted.reviewed).toBe(false)
    expect(submitted.reference).toBe('BANK-REF-123')
    // Reference-only: no URL, file, or media handle anywhere in the payload.
    expect(JSON.stringify(submitted)).not.toMatch(/url|file|media|storageKey|https?:/i)
    expect(Object.keys(submitted).sort()).toEqual(
      ['created', 'duplicate', 'method', 'reference', 'reviewed', 'submittedAt'].sort(),
    )
    const rows = shared.store.activities.filter((a) => a.action === 'Payment proof submitted')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ actorRole: 'customer', bookingId: 'bk-1' })
    expect(rows[0].isInternal).not.toBe(true)
    // Receipt confirmation only: the customer is told review is pending.
    expect(vi.mocked(notifyUser)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(notifyUser).mock.calls[0][1].type).toBe('payment_proof_submitted')
    expect(vi.mocked(notifyStaff)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(notifyStaff).mock.calls[0][0].type).toBe('admin_payment_proof_submitted')
    expect(vi.mocked(sendCustomerEmailSafe).mock.calls[0][0]).toBe('payment_proof_received')
    expect(vi.mocked(sendStaffEmailSafe).mock.calls[0][0]).toBe('admin_payment_proof_submitted')
  })

  it('resolves duplicate references idempotently without re-notifying', async () => {
    seedAccountBooking()
    const first = (await submitCustomerPaymentProof('user-1', 'SP-BK-TEST01', proofInput()))!
    const second = (await submitCustomerPaymentProof('user-1', 'SP-BK-TEST01', proofInput({ reference: '  bank-ref-123 ' })))!
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.duplicate).toBe(true)
    expect(second.reference).toBe(first.reference)
    expect(shared.store.activities.filter((a) => a.action === 'Payment proof submitted')).toHaveLength(1)
    // Notification idempotency: exactly one fan-out per real submission.
    expect(vi.mocked(notifyUser)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(notifyStaff)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendCustomerEmailSafe)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendStaffEmailSafe)).toHaveBeenCalledTimes(1)
  })

  it('rejects foreign and guest bookings without an ownership oracle', async () => {
    seedAccountBooking()
    expect(await submitCustomerPaymentProof('user-2', 'SP-BK-TEST01', proofInput())).toBeNull()
    expect(await submitCustomerPaymentProof('user-1', 'SP-BK-NOPE01', proofInput())).toBeNull()
    expect(shared.store.activities).toHaveLength(0)
    expect(vi.mocked(notifyStaff)).not.toHaveBeenCalled()
  })

  it('never creates or touches a Payment row', async () => {
    seedAccountBooking()
    await submitCustomerPaymentProof('user-1', 'SP-BK-TEST01', proofInput())
    await submitCustomerPaymentProof('user-1', 'SP-BK-TEST01', proofInput({ reference: 'CASH-9', method: 'cash' }))
    expect(shared.db.payment.create).not.toHaveBeenCalled()
    expect(shared.db.payment.updateMany).not.toHaveBeenCalled()
    const booking = shared.store.bookings.get('bk-1')!
    expect(booking.status).toBe('PENDING')
  })
})

describe('submitGuestPaymentProof', () => {
  it('accepts a valid private-link token without a session', async () => {
    seedGuestBooking()
    const submitted = await submitGuestPaymentProof(GUEST_TOKEN, proofInput({ reference: 'CASH-42', method: 'cash' }))
    expect(submitted.created).toBe(true)
    expect(submitted.method).toBe('cash')
    expect(JSON.stringify(submitted)).not.toMatch(/url|file|media|storageKey|https?:/i)
    expect(shared.db.payment.create).not.toHaveBeenCalled()
    // Guests have no account inbox: only staff notify + contact email fire.
    expect(vi.mocked(notifyStaff)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendCustomerEmailSafe)).toHaveBeenCalledTimes(1)
  })

  it('rejects unknown tokens with the uniform access error', async () => {
    seedAccountBooking({ id: 'bk-guest', reference: 'SP-BK-GUEST1', userId: null })
    // No access-token row seeded: the token resolves to nothing.
    await expect(submitGuestPaymentProof(GUEST_TOKEN, proofInput())).rejects.toBeInstanceOf(
      GuestBookingAccessError,
    )
    expect(shared.store.activities).toHaveLength(0)
  })
})

describe('acknowledgePaymentProof (staff review)', () => {
  it('marks a pending proof reviewed without settling money', async () => {
    seedAccountBooking()
    await submitCustomerPaymentProof('user-1', 'SP-BK-TEST01', proofInput())
    const reviewed = (await acknowledgePaymentProof('SP-BK-TEST01', 'BANK-REF-123'))!
    expect(reviewed.reviewed).toBe(true)
    expect(reviewed.reference).toBe('BANK-REF-123')
    expect(shared.db.payment.create).not.toHaveBeenCalled()
    expect(shared.db.payment.updateMany).not.toHaveBeenCalled()
    // Staff review is visible in the derived proof list (pending clears).
    const proofs = derivePaymentProofs(
      shared.store.activities.map((a) => ({ action: a.action, note: a.note ?? '', at: a.createdAt.toISOString() })),
    )
    expect(proofs).toHaveLength(1)
    expect(proofs[0].reviewed).toBe(true)
  })

  it('throws when nothing matches and nulls unknown bookings', async () => {
    seedAccountBooking()
    await expect(acknowledgePaymentProof('SP-BK-TEST01', 'BANK-REF-123')).rejects.toThrow(
      'No pending payment proof',
    )
    expect(await acknowledgePaymentProof('SP-BK-NOPE01', 'BANK-REF-123')).toBeNull()
  })

  it('treats a repeated acknowledgement as idempotent (no second row)', async () => {
    seedAccountBooking()
    await submitCustomerPaymentProof('user-1', 'SP-BK-TEST01', proofInput())
    const first = (await acknowledgePaymentProof('SP-BK-TEST01', 'BANK-REF-123'))!
    const second = (await acknowledgePaymentProof('SP-BK-TEST01', 'bank-ref-123'))!
    expect(first.reviewed).toBe(true)
    expect(second.reviewed).toBe(true)
    expect(shared.store.activities.filter((a) => a.action === 'Payment proof reviewed')).toHaveLength(1)
    expect(shared.db.payment.create).not.toHaveBeenCalled()
  })
})

describe('proof note helpers', () => {
  it('round-trips method + reference through the stored note', () => {
    expect(parsePaymentProofNote(formatPaymentProofNote('ABC-1', 'bank_transfer'))).toEqual({
      reference: 'ABC-1',
      method: 'bank_transfer',
    })
    expect(parsePaymentProofNote(formatPaymentProofNote('C-2', 'cash'))).toEqual({
      reference: 'C-2',
      method: 'cash',
    })
    expect(parsePaymentProofNote(formatPaymentProofNote('LEGACY', null))).toEqual({
      reference: 'LEGACY',
      method: null,
    })
  })
})

describe('bookingOfflinePaymentLabel', () => {
  const base = { state: 'unpaid' as const, paidTotal: 0, refundedTotal: 0, total: 500 }
  it('distinguishes awaiting / partial / full payment', () => {
    expect(bookingOfflinePaymentLabel(base, 'en')).toBe('Awaiting payment')
    expect(bookingOfflinePaymentLabel({ ...base, state: 'pending', paidTotal: 200 }, 'en')).toBe(
      'Partially paid',
    )
    expect(bookingOfflinePaymentLabel({ ...base, state: 'paid', paidTotal: 500 }, 'en')).toBe(
      'Fully paid',
    )
  })

  it('distinguishes partial / full refunds', () => {
    expect(
      bookingOfflinePaymentLabel(
        { ...base, state: 'partially_refunded', paidTotal: 500, refundedTotal: 200 },
        'en',
      ),
    ).toBe('Partially refunded')
    expect(
      bookingOfflinePaymentLabel({ ...base, state: 'refunded', paidTotal: 500, refundedTotal: 500 }, 'en'),
    ).toBe('Fully refunded')
  })

  it('localizes across EN/ES/IT/AR', () => {
    expect(bookingOfflinePaymentLabel(base, 'ar')).toBe('بانتظار الدفع')
    expect(bookingOfflinePaymentLabel({ ...base, state: 'paid', paidTotal: 500 }, 'es')).toBe(
      'Pagado en su totalidad',
    )
    expect(bookingOfflinePaymentLabel({ ...base, state: 'pending', paidTotal: 200 }, 'it')).toBe(
      'Pagato parzialmente',
    )
    expect(
      bookingOfflinePaymentLabel(
        { ...base, state: 'partially_refunded', paidTotal: 500, refundedTotal: 200 },
        'ar',
      ),
    ).toBe('مسترد جزئيًا')
  })
})

describe('POST /api/account/bookings/[ref]/proof authorization', () => {
  it('rejects unauthenticated callers with 401', async () => {
    vi.resetModules()
    vi.doMock('@/lib/server/auth', () => ({
      getCurrentUser: vi.fn(async () => null),
      hasPermission: () => false,
    }))
    const { POST } = await import('@/app/api/account/bookings/[ref]/proof/route')
    const res = await POST(
      new Request('http://localhost:3000/api/account/bookings/SP-BK-TEST01/proof', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          'x-forwarded-host': 'localhost:3000',
        },
        body: JSON.stringify({ reference: 'BANK-REF-1', method: 'bank_transfer' }),
      }),
      { params: Promise.resolve({ ref: 'SP-BK-TEST01' }) },
    )
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized.' })
  })
})
