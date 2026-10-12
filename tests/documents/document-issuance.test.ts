// Phase C: admin document issuance endpoint tests (real database).
//
// POST /api/admin/bookings/[ref]/documents is the ONLY writer of
// document rows in this phase: explicit, permission-gated
// (`bookings.edit`), CSRF-guarded, idempotent per caller key, and
// fully revalidating (type, booking, payment, key) on the server.
// Covered here:
// - 401 without session; 403 without same-origin headers; 403 for
//   staff holding only view permissions;
// - 400 for unknown/disabled types, missing payment, and bad keys;
// - 404 for unknown bookings; 400/409 for ineligible payments and
//   premature confirmations (stable machine codes);
// - success for all three issuable types with frozen snapshots;
// - idempotent retries return the original document (no duplicates,
//   no second audit row); distinct keys mint distinct documents;
// - every creation writes a staffActionAudit row; nothing else in this
//   phase creates documents.
//
// Safety: session auth is mocked at the getCurrentUser boundary; probe
// rows (bookings, payments, documents, audits) are deleted in `finally`.

import { describe, it, expect, vi, afterAll } from 'vitest'

vi.mock('@/lib/server/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/auth')>()
  return { ...actual, getCurrentUser: vi.fn(async () => null) }
})

import { getCurrentUser } from '@/lib/server/auth'
import { db } from '@/lib/server/db'
import { POST as issue } from '@/app/api/admin/bookings/[ref]/documents/route'

const reachable: boolean = await db
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

afterAll(async () => {
  if (reachable) await db.$disconnect().catch(() => undefined)
})

const mockGetCurrentUser = vi.mocked(getCurrentUser)

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function mintSuffix(): string {
  let suffix = ''
  for (let i = 0; i < 6; i += 1) {
    suffix += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]
  }
  return suffix
}

function staffUser(permissions: string[], id = 'staff-issue-probe') {
  return { id, publicId: 'p', email: 'staff@example.com', roles: ['STAFF'], permissions } as never
}

function ctx(ref: string) {
  return { params: Promise.resolve({ ref }) }
}

const ORIGIN_HEADERS = {
  'content-type': 'application/json',
  origin: 'http://localhost:3000',
  'x-forwarded-host': 'localhost:3000',
}

function post(ref: string, body: unknown, headers: Record<string, string> = ORIGIN_HEADERS) {
  return issue(
    new Request(`http://localhost/api/admin/bookings/${ref}/documents`, {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    ctx(ref),
  )
}

async function createProbeBooking(tag: string, status: 'PENDING' | 'CONFIRMED' = 'PENDING') {
  const reference = `SP-BK-${mintSuffix()}`
  return db.booking.create({
    data: {
      reference,
      userId: null,
      contactName: 'Issue Probe',
      contactEmail: `doc-issue-${tag}-${Date.now()}@example.com`,
      contactPhone: '+10000000000',
      currency: 'USD',
      subtotal: '200.00',
      discount: '0.00',
      total: '200.00',
      status,
      paymentStatus: 'PENDING',
      idempotencyKey: `doc-issue-${tag}-${Date.now()}-${reference}`,
    },
  })
}

async function createProbePayment(bookingId: string, amountPaid: string, status: 'PAID' | 'PENDING' = 'PAID') {
  const reference = `SP-PAY-${mintSuffix()}`
  return db.payment.create({
    data: {
      reference,
      bookingId,
      provider: 'offline',
      status,
      currency: 'USD',
      amount: amountPaid,
      amountPaid: status === 'PAID' ? amountPaid : '0.00',
      amountRefunded: '0.00',
      ...(status === 'PAID' ? { paidAt: new Date() } : {}),
      idempotencyKey: `doc-issue-pay-${Date.now()}-${reference}`,
    },
  })
}

async function cleanup(bookingIds: string[], bookingRefs: string[]) {
  await db.bookingDocument.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined)
  await db.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined)
  await db.bookingItem.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined)
  await db.booking.deleteMany({ where: { id: { in: bookingIds } } }).catch(() => undefined)
  await db.staffActionAudit
    .deleteMany({ where: { action: 'booking.document_issued', entityId: { in: bookingRefs } } })
    .catch(() => undefined)
}

describe.runIf(reachable)('POST issuance authorization (real database)', () => {
  it('rejects anonymous, cross-site, and view-only staff callers', async () => {
    const booking = await createProbeBooking('auth')
    try {
      mockGetCurrentUser.mockResolvedValue(null)
      expect((await post(booking.reference, { type: 'BOOKING_REQUEST', idempotencyKey: 'key-auth-01' })).status).toBe(401)

      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.view', 'bookings.edit']))
      const crossSite = await post(
        booking.reference,
        { type: 'BOOKING_REQUEST', idempotencyKey: 'key-auth-02' },
        { 'content-type': 'application/json' },
      )
      expect(crossSite.status).toBe(403)

      // View permissions are not issuance permissions.
      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.view', 'payments.view']))
      const viewer = await post(booking.reference, { type: 'BOOKING_REQUEST', idempotencyKey: 'key-auth-03' })
      expect(viewer.status).toBe(403)
      expect(await viewer.json()).toEqual({ error: 'Forbidden.' })

      // Nothing was created by the refused calls.
      expect(await db.bookingDocument.count({ where: { bookingId: booking.id } })).toBe(0)
    } finally {
      mockGetCurrentUser.mockResolvedValue(null)
      await cleanup([booking.id], [booking.reference])
    }
  })
})

describe.runIf(reachable)('POST issuance validation (real database)', () => {
  it('rejects unknown bookings, unknown types, and malformed bodies', async () => {
    const booking = await createProbeBooking('valid')
    try {
      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.edit']))

      const unknown = await post('SP-BK-NOPE02', { type: 'BOOKING_REQUEST', idempotencyKey: 'key-valid-01' })
      expect(unknown.status).toBe(404)
      expect(await unknown.json()).toEqual({ error: 'Booking not found.', code: 'unknown-booking' })

      // Phase D completed the set: only truly unknown types are refused
      // here. INVOICE / BOOKING_VOUCHER / REFUND_NOTE carry their own
      // eligibility rules, covered in the commercial-document tests.
      const bogus = await post(booking.reference, { type: 'BOGUS', idempotencyKey: 'key-valid-BOGUS' })
      expect(bogus.status).toBe(400)
      expect(await bogus.json()).toEqual({
        error: 'This document type is not available.',
        code: 'not-issuable-yet',
      })

      const shortKey = await post(booking.reference, { type: 'BOOKING_REQUEST', idempotencyKey: 'short' })
      expect(shortKey.status).toBe(400)
      expect((await shortKey.json()) as { code: string }).toMatchObject({ code: 'invalid-input' })

      const missingReceiptPayment = await post(booking.reference, {
        type: 'PAYMENT_RECEIPT',
        idempotencyKey: 'key-valid-receiptless',
      })
      expect(missingReceiptPayment.status).toBe(400)

      const strayPayment = await post(booking.reference, {
        type: 'BOOKING_REQUEST',
        paymentReference: 'SP-PAY-XXXXXX',
        idempotencyKey: 'key-valid-straypay',
      })
      expect(strayPayment.status).toBe(400)

      expect(await db.bookingDocument.count({ where: { bookingId: booking.id } })).toBe(0)
    } finally {
      mockGetCurrentUser.mockResolvedValue(null)
      await cleanup([booking.id], [booking.reference])
    }
  })

  it('revalidates payment eligibility and booking status', async () => {
    const booking = await createProbeBooking('elig')
    const other = await createProbeBooking('elig-other')
    try {
      const paid = await createProbePayment(booking.id, '80.00')
      const unpaid = await createProbePayment(booking.id, '70.00', 'PENDING')
      const foreign = await createProbePayment(other.id, '30.00')
      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.edit']))

      // Premature confirmation: PENDING bookings cannot take confirmations.
      const premature = await post(booking.reference, {
        type: 'BOOKING_CONFIRMATION',
        idempotencyKey: 'key-elig-premature',
      })
      expect(premature.status).toBe(409)
      expect(await premature.json()).toEqual({
        error: 'Booking confirmations require a confirmed booking.',
        code: 'status-mismatch',
      })

      const unknownPay = await post(booking.reference, {
        type: 'PAYMENT_RECEIPT',
        paymentReference: 'SP-PAY-NOPE01',
        idempotencyKey: 'key-elig-unknownpay',
      })
      expect(unknownPay.status).toBe(400)
      expect((await unknownPay.json()) as { code: string }).toMatchObject({ code: 'unknown-payment' })

      const foreignPay = await post(booking.reference, {
        type: 'PAYMENT_RECEIPT',
        paymentReference: foreign.reference,
        idempotencyKey: 'key-elig-foreignpay',
      })
      expect(foreignPay.status).toBe(400)
      expect((await foreignPay.json()) as { code: string }).toMatchObject({ code: 'payment-not-on-booking' })

      const unpaidPay = await post(booking.reference, {
        type: 'PAYMENT_RECEIPT',
        paymentReference: unpaid.reference,
        idempotencyKey: 'key-elig-unpaidpay',
      })
      expect(unpaidPay.status).toBe(400)
      expect((await unpaidPay.json()) as { code: string }).toMatchObject({ code: 'no-verified-money' })

      // None of the refusals created anything.
      expect(await db.bookingDocument.count({ where: { bookingId: booking.id } })).toBe(0)

      // The exact verified payment receipts cleanly.
      const receipt = await post(booking.reference, {
        type: 'PAYMENT_RECEIPT',
        paymentReference: paid.reference,
        idempotencyKey: 'key-elig-receipt',
      })
      expect(receipt.status).toBe(201)
      const receiptBody = (await receipt.json()) as {
        created: boolean
        document: { type: string; number: string; amountCents: number; paymentReference: string | null }
      }
      expect(receiptBody.created).toBe(true)
      expect(receiptBody.document.type).toBe('PAYMENT_RECEIPT')
      expect(receiptBody.document.number).toMatch(/^SP-RCPT-\d{4}-\d{6}$/)
      expect(receiptBody.document.amountCents).toBe(8000)
      expect(receiptBody.document.paymentReference).toBe(paid.reference)
    } finally {
      mockGetCurrentUser.mockResolvedValue(null)
      await cleanup([booking.id, other.id], [booking.reference, other.reference])
    }
  })
})

describe.runIf(reachable)('POST issuance success and idempotency (real database)', () => {
  it('issues requests and confirmations with snapshots and audits, retries deduplicate', async () => {
    const booking = await createProbeBooking('happy', 'CONFIRMED')
    // Audit rows reference a real actor: the mocked session carries a
    // genuine staff user id (the FK rejects phantom ids).
    const email = `doc-issue-staff-${Date.now()}@example.com`
    const staff = await db.user.create({
      data: { email, emailNormalized: email.toLowerCase(), status: 'ACTIVE' },
      select: { id: true },
    })
    try {
      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.edit'], staff.id))

      const first = await post(booking.reference, {
        type: 'BOOKING_REQUEST',
        idempotencyKey: 'key-happy-request',
      })
      expect(first.status).toBe(201)
      const firstBody = (await first.json()) as {
        created: boolean
        document: { id: string; type: string; number: string; amountCents: number; bookingReference: string }
      }
      expect(firstBody.created).toBe(true)
      expect(firstBody.document.number).toMatch(/^SP-BRQ-\d{4}-\d{6}$/)
      expect(firstBody.document.amountCents).toBe(20000)
      expect(firstBody.document.bookingReference).toBe(booking.reference)

      const confirm = await post(booking.reference, {
        type: 'BOOKING_CONFIRMATION',
        idempotencyKey: 'key-happy-confirm',
      })
      expect(confirm.status).toBe(201)
      const confirmBody = (await confirm.json()) as { created: boolean; document: { number: string } }
      expect(confirmBody.created).toBe(true)
      expect(confirmBody.document.number).toMatch(/^SP-BCF-\d{4}-\d{6}$/)

      // Idempotent retry: same key returns the ORIGINAL document.
      const retry = await post(booking.reference, {
        type: 'BOOKING_REQUEST',
        idempotencyKey: 'key-happy-request',
      })
      expect(retry.status).toBe(200)
      const retryBody = (await retry.json()) as { created: boolean; document: { id: string; number: string } }
      expect(retryBody.created).toBe(false)
      expect(retryBody.document.id).toBe(firstBody.document.id)
      expect(retryBody.document.number).toBe(firstBody.document.number)

      // Two documents total — the retry minted nothing.
      expect(await db.bookingDocument.count({ where: { bookingId: booking.id } })).toBe(2)

      // One audit row per creation; retries are not re-audited.
      expect(
        await db.staffActionAudit.count({
          where: { action: 'booking.document_issued', entityId: booking.reference },
        }),
      ).toBe(2)
    } finally {
      mockGetCurrentUser.mockResolvedValue(null)
      await cleanup([booking.id], [booking.reference])
      await db.user.deleteMany({ where: { id: staff.id } }).catch(() => undefined)
    }
  })
})
