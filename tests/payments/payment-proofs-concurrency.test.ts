// Real-database proof-submission concurrency (Phase 3.1).
//
// Fires two IDENTICAL proof submissions simultaneously against the real
// MySQL database and asserts database-enforced idempotency: exactly one
// activity row, one created + one duplicate response, one staff
// notification, zero payment writes.
//
// Safety:
// - Only notification/email boundaries are mocked (no staff inboxes or
//   mailboxes are touched). The database handle is real.
// - Every run uses a freshly created booking with a unique reference;
//   the test deletes its own activities, tokens, and booking in a
//   `finally` block — nothing else is read or written.
// - The suite skips cleanly when the database is unreachable.
// - No migration, no reset, no schema change: the production code
//   serializes per booking (`SELECT ... FOR UPDATE` + in-transaction
//   re-check), which is exactly what this test exercises.

import { describe, it, expect, vi, afterAll } from 'vitest'

vi.mock('@/lib/server/email', () => ({
  sendCustomerEmailSafe: vi.fn(async () => undefined),
  sendStaffEmailSafe: vi.fn(async () => undefined),
}))
vi.mock('@/lib/server/notifications', () => ({
  notifyUser: vi.fn(async () => undefined),
  notifyStaff: vi.fn(async () => undefined),
}))

import { db } from '@/lib/server/db'
import { issueGuestBookingToken } from '@/lib/server/booking-access'
import { acknowledgePaymentProof, submitGuestPaymentProof } from '@/lib/server/payment-proofs'
import { notifyStaff } from '@/lib/server/notifications'

const reachable: boolean = await db
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

afterAll(async () => {
  if (reachable) await db.$disconnect().catch(() => undefined)
})

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function mintBookingReference(): string {
  let suffix = ''
  for (let i = 0; i < 6; i += 1) {
    suffix += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]
  }
  return `SP-BK-${suffix}`
}

describe.runIf(reachable)('concurrent identical proof submissions (real database)', () => {
  it('stores exactly one row and notifies exactly once', async () => {
    const reference = mintBookingReference()
    const booking = await db.booking.create({
      data: {
        reference,
        userId: null,
        contactName: 'Concurrency Probe',
        contactEmail: 'concurrency-probe@example.com',
        contactPhone: '+200000000000',
        currency: 'USD',
        subtotal: '100.00',
        discount: '0.00',
        total: '100.00',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        idempotencyKey: `proof-concurrency-${Date.now()}-${reference}`,
      },
      select: { id: true, reference: true },
    })
    const issued = await issueGuestBookingToken(booking.reference)
    expect(issued).not.toBeNull()
    const token = issued!.token

    try {
      const proof = { reference: 'BANK-CONC-1', method: 'bank_transfer' as const }
      // Same submission twice, simultaneously: the serialized-race path.
      const [first, second] = await Promise.all([
        submitGuestPaymentProof(token, proof),
        submitGuestPaymentProof(token, proof),
      ])
      const created = [first, second].filter((r) => r.created)
      const duplicates = [first, second].filter((r) => r.duplicate && !r.created)
      expect(created).toHaveLength(1)
      expect(duplicates).toHaveLength(1)
      expect(created[0].reference).toBe('BANK-CONC-1')

      const rows = await db.bookingActivity.findMany({
        where: { bookingId: booking.id, action: 'Payment proof submitted' },
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].note).toContain('BANK-CONC-1')

      const payments = await db.payment.findMany({ where: { bookingId: booking.id } })
      expect(payments).toHaveLength(0)

      // One notification fan-out for the single real submission.
      expect(vi.mocked(notifyStaff)).toHaveBeenCalledTimes(1)
    } finally {
      await db.bookingActivity.deleteMany({ where: { bookingId: booking.id } }).catch(() => undefined)
      await db.bookingAccessToken.deleteMany({ where: { bookingRef: booking.reference } }).catch(() => undefined)
      await db.booking.delete({ where: { id: booking.id } }).catch(() => undefined)
    }
  })

  it('stores exactly one review row for simultaneous acknowledgements', async () => {
    const reference = mintBookingReference()
    const booking = await db.booking.create({
      data: {
        reference,
        userId: null,
        contactName: 'Concurrency Probe',
        contactEmail: 'concurrency-probe@example.com',
        contactPhone: '+200000000000',
        currency: 'USD',
        subtotal: '100.00',
        discount: '0.00',
        total: '100.00',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        idempotencyKey: `proof-concurrency-${Date.now()}-${reference}`,
      },
      select: { id: true, reference: true },
    })
    const issued = await issueGuestBookingToken(booking.reference)
    const token = issued!.token

    try {
      const submitted = await submitGuestPaymentProof(token, {
        reference: 'BANK-ACK-1',
        method: 'bank_transfer',
      })
      expect(submitted.created).toBe(true)
      // Same acknowledgement twice, simultaneously: the serialized-race path.
      const [first, second] = await Promise.all([
        acknowledgePaymentProof(booking.reference, 'BANK-ACK-1'),
        acknowledgePaymentProof(booking.reference, 'BANK-ACK-1'),
      ])
      expect(first?.reviewed).toBe(true)
      expect(second?.reviewed).toBe(true)
      const reviews = await db.bookingActivity.findMany({
        where: { bookingId: booking.id, action: 'Payment proof reviewed' },
      })
      expect(reviews).toHaveLength(1)
      const payments = await db.payment.findMany({ where: { bookingId: booking.id } })
      expect(payments).toHaveLength(0)
    } finally {
      await db.bookingActivity.deleteMany({ where: { bookingId: booking.id } }).catch(() => undefined)
      await db.bookingAccessToken.deleteMany({ where: { bookingRef: booking.reference } }).catch(() => undefined)
      await db.booking.delete({ where: { id: booking.id } }).catch(() => undefined)
    }
  })

  it('treats different transfer references as distinct submissions', async () => {
    const reference = mintBookingReference()
    const booking = await db.booking.create({
      data: {
        reference,
        userId: null,
        contactName: 'Concurrency Probe',
        contactEmail: 'concurrency-probe@example.com',
        contactPhone: '+200000000000',
        currency: 'USD',
        subtotal: '100.00',
        discount: '0.00',
        total: '100.00',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        idempotencyKey: `proof-concurrency-${Date.now()}-${reference}`,
      },
      select: { id: true, reference: true },
    })
    const issued = await issueGuestBookingToken(booking.reference)
    const token = issued!.token

    try {
      const [first, second] = await Promise.all([
        submitGuestPaymentProof(token, { reference: 'BANK-A-1', method: 'bank_transfer' }),
        submitGuestPaymentProof(token, { reference: 'BANK-B-2', method: 'bank_transfer' }),
      ])
      // Different legitimate transfers are NOT duplicates: both create.
      expect(first.created).toBe(true)
      expect(second.created).toBe(true)
      const rows = await db.bookingActivity.findMany({
        where: { bookingId: booking.id, action: 'Payment proof submitted' },
      })
      expect(rows).toHaveLength(2)
    } finally {
      await db.bookingActivity.deleteMany({ where: { bookingId: booking.id } }).catch(() => undefined)
      await db.bookingAccessToken.deleteMany({ where: { bookingRef: booking.reference } }).catch(() => undefined)
      await db.booking.delete({ where: { id: booking.id } }).catch(() => undefined)
    }
  })
})

if (!reachable) {
  describe.skip('concurrent identical proof submissions (real database)', () => {
    it('skipped: database unreachable', () => {
      expect(true).toBe(true)
    })
  })
}
