// Real-database document-numbering tests (Phase A).
//
// Exercises collision-safe allocation, uniqueness, and idempotent
// issuance against the real MySQL database:
// - concurrent issuance never produces a duplicate number;
// - numbers match the `SP-<TYPE>-<year>-<seq>` format;
// - a repeated idempotency key returns the ORIGINAL document and never
//   mints or renumbers anything (sequential and racing retries);
// - booking rows and references are untouched by issuance.
//
// Safety: probe bookings use fresh unique references and are deleted
// with their documents in a `finally` block. Sequence counter rows are
// infrastructure (global per-year counters) and are deliberately left
// in place — advancing them is harmless and never duplicates numbers.
// The suite skips cleanly when the database is unreachable.

import { describe, it, expect, afterAll } from 'vitest'

import { db } from '@/lib/server/db'
import {
  DOCUMENT_CURRENCY,
  DOCUMENT_NUMBER_PATTERN,
  issueBookingDocument,
} from '@/lib/server/documents'

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

async function createProbeBooking(total = '123.45') {
  const reference = mintBookingReference()
  return db.booking.create({
    data: {
      reference,
      userId: null,
      contactName: 'Numbering Probe',
      contactEmail: `numbering-probe-${Date.now()}-${reference}@example.com`,
      contactPhone: '+200000000000',
      currency: 'USD',
      subtotal: total,
      discount: '0.00',
      total,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      idempotencyKey: `numbering-${Date.now()}-${reference}`,
    },
  })
}

async function cleanup(bookingIds: string[]): Promise<void> {
  await db.bookingDocument.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined)
  await db.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined)
  await db.bookingActivity.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined)
  await db.booking.deleteMany({ where: { id: { in: bookingIds } } }).catch(() => undefined)
}

describe.runIf(reachable)('document numbering (real database)', () => {
  it('allocates unique, sequential numbers under concurrency', async () => {
    const booking = await createProbeBooking()
    try {
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          issueBookingDocument({
            type: 'BOOKING_REQUEST',
            bookingReference: booking.reference,
            idempotencyKey: `concurrent-num-${Date.now()}-${i}`,
          }),
        ),
      )
      const documents = results.map((r) => {
        expect(r.ok).toBe(true)
        if (!r.ok) throw new Error('unreachable')
        expect(r.created).toBe(true)
        return r.document
      })

      const numbers = documents.map((d) => d.number)
      expect(new Set(numbers).size).toBe(8)
      for (const number of numbers) {
        expect(number).toMatch(DOCUMENT_NUMBER_PATTERN)
      }

      const year = new Date().getUTCFullYear()
      const sequences = numbers
        .map((n) => Number(n.split('-')[3]))
        .sort((a, b) => a - b)
      expect(sequences[0]).toBeGreaterThan(0)
      for (let i = 1; i < sequences.length; i += 1) {
        expect(sequences[i]).toBeGreaterThan(sequences[i - 1])
      }
      for (const number of numbers) {
        expect(number.startsWith(`SP-BRQ-${year}-`)).toBe(true)
      }

      const rows = await db.bookingDocument.findMany({ where: { bookingId: booking.id } })
      expect(rows).toHaveLength(8)
      for (const row of rows) {
        expect(row.currency).toBe(DOCUMENT_CURRENCY)
        expect(row.amountCents).toBe(12345)
      }
    } finally {
      await cleanup([booking.id])
    }
  })

  it('continues the counter across sequential issuances', async () => {
    const booking = await createProbeBooking()
    try {
      const first = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: booking.reference,
        idempotencyKey: `seq-first-${Date.now()}`,
      })
      const second = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: booking.reference,
        idempotencyKey: `seq-second-${Date.now()}`,
      })
      expect(first.ok && first.created).toBe(true)
      expect(second.ok && second.created).toBe(true)
      if (!first.ok || !second.ok) throw new Error('unreachable')
      const firstSeq = Number(first.document.number.split('-')[3])
      const secondSeq = Number(second.document.number.split('-')[3])
      expect(secondSeq).toBeGreaterThan(firstSeq)
    } finally {
      await cleanup([booking.id])
    }
  })

  it('returns the original document for a repeated idempotency key', async () => {
    const booking = await createProbeBooking()
    try {
      const idempotencyKey = `retry-key-${Date.now()}-abcdef`
      const first = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: booking.reference,
        idempotencyKey,
      })
      const retry = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: booking.reference,
        idempotencyKey,
      })
      expect(first.ok && first.created).toBe(true)
      expect(retry.ok && !retry.created).toBe(true)
      if (!first.ok || !retry.ok) throw new Error('unreachable')
      expect(retry.document.id).toBe(first.document.id)
      expect(retry.document.number).toBe(first.document.number)

      const rows = await db.bookingDocument.findMany({ where: { bookingId: booking.id } })
      expect(rows).toHaveLength(1)
    } finally {
      await cleanup([booking.id])
    }
  })

  it('absorbs racing identical-key issuance into one document', async () => {
    const booking = await createProbeBooking()
    try {
      const idempotencyKey = `race-key-${Date.now()}-abcdef`
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          issueBookingDocument({
            type: 'BOOKING_REQUEST',
            bookingReference: booking.reference,
            idempotencyKey,
          }),
        ),
      )
      for (const result of results) expect(result.ok).toBe(true)
      const created = results.filter((r) => r.ok && r.created)
      expect(created).toHaveLength(1)

      const rows = await db.bookingDocument.findMany({ where: { bookingId: booking.id } })
      expect(rows).toHaveLength(1)
      expect(rows[0].idempotencyKey).toBe(idempotencyKey)
    } finally {
      await cleanup([booking.id])
    }
  })

  it('never rewrites the booking or its reference', async () => {
    const booking = await createProbeBooking()
    try {
      const before = await db.booking.findUniqueOrThrow({ where: { id: booking.id } })
      const issued = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: booking.reference,
        idempotencyKey: `intact-key-${Date.now()}-abcdef`,
      })
      expect(issued.ok).toBe(true)
      const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id } })
      expect(after.reference).toBe(before.reference)
      expect(after.total).toEqual(before.total)
      expect(after.status).toBe(before.status)
      expect(after.paymentStatus).toBe(before.paymentStatus)
      expect(after.updatedAt).toEqual(before.updatedAt)
    } finally {
      await cleanup([booking.id])
    }
  })
})

if (!reachable) {
  describe.skip('document numbering (real database)', () => {
    it('skipped: database unreachable', () => {
      expect(true).toBe(true)
    })
  })
}
