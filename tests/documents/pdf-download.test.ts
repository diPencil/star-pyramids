// Phase B: booking PDF download route tests (real database).
//
// Covers the authenticated download surface end to end:
// - authorized owner / staff / valid-guest-token downloads return real
//   PDFs with `application/pdf`, attachment filenames and
//   `Cache-Control: private, no-store` for all six document types;
// - missing session (401), missing staff permission (403), stranger
//   owner (404), invalid and expired guest tokens (404), cross-booking
//   access (404), and booking-reference mismatches (404) are refused
//   with the uniform not-found body;
// - INVOICE / REFUND_NOTE / BOOKING_VOUCHER rows render through the
//   same guarded download (Phase D completed the set);
// - receipts show the exact frozen amount of their own payment and
//   never unrelated payments; refunds appear only as "to date";
// - issued-document snapshots survive later booking-total changes;
// - downloads never issue documents and never create rows.
//
// Safety: session auth is mocked at the getCurrentUser boundary (the
// Phase-A gate still runs on real rows); probe rows are deleted in
// `finally`. No emails or notifications are involved in downloads.

import { describe, it, expect, vi, afterAll } from 'vitest'

vi.mock('@/lib/server/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/auth')>()
  return { ...actual, getCurrentUser: vi.fn(async () => null) }
})

import { getCurrentUser } from '@/lib/server/auth'
import { issueGuestBookingToken } from '@/lib/server/booking-access'
import { issueBookingDocument } from '@/lib/server/documents'
import { db } from '@/lib/server/db'
import { recordTestRefund } from './probe-helpers'
import { loadBookingDocumentPdfModel } from '@/lib/server/document-pdf'
import { GET as ownerPdf } from '@/app/api/account/bookings/[ref]/documents/[documentId]/pdf/route'
import { GET as staffPdf } from '@/app/api/admin/bookings/[ref]/documents/[documentId]/pdf/route'
import { GET as guestPdf } from '@/app/api/bookings/access/[token]/documents/[documentId]/pdf/route'

const reachable: boolean = await db
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

afterAll(async () => {
  if (reachable) await db.$disconnect().catch(() => undefined)
})

const mockGetCurrentUser = vi.mocked(getCurrentUser)

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function mintBookingReference(): string {
  let suffix = ''
  for (let i = 0; i < 6; i += 1) {
    suffix += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]
  }
  return `SP-BK-${suffix}`
}

function mintPaymentReference(): string {
  let suffix = ''
  for (let i = 0; i < 6; i += 1) {
    suffix += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]
  }
  return `SP-PAY-${suffix}`
}

function staffUser(permissions: string[], id = 'staff-probe') {
  return { id, publicId: 'p', email: 'staff@example.com', roles: ['STAFF'], permissions } as never
}

function ctx(params: Record<string, string>) {
  return { params: Promise.resolve(params) }
}

function call(route: typeof ownerPdf, url: string, params: Record<string, string>, ip = '10.9.9.9') {
  return route(new Request(url, { headers: { 'x-forwarded-for': ip } }), ctx(params))
}

async function createProbeUser(tag: string) {
  const email = `pdf-dl-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  return db.user.create({
    data: { email, emailNormalized: email.toLowerCase(), status: 'ACTIVE' },
    select: { id: true },
  })
}

async function createProbeBooking(opts: {
  userId: string | null
  tag: string
  total?: string
  status?: 'PENDING' | 'CONFIRMED'
}) {
  const reference = mintBookingReference()
  return db.booking.create({
    data: {
      reference,
      userId: opts.userId,
      contactName: 'José Muñoz Piñata',
      contactEmail: `pdf-probe-${opts.tag}-${Date.now()}@example.com`,
      contactPhone: '+34 600 111 222',
      notes: 'Notas señoría ¿Qué? über',
      currency: 'USD',
      subtotal: opts.total ?? '100.00',
      discount: '0.00',
      total: opts.total ?? '100.00',
      status: opts.status ?? 'PENDING',
      paymentStatus: 'PENDING',
      idempotencyKey: `pdf-dl-${opts.tag}-${Date.now()}-${reference}`,
      items: {
        create: {
          tourSlug: 'pyramids-sphinx',
          tourTitle: 'Pyramids & Sphinx — tour privado',
          travelDate: '2026-12-05',
          adults: 2,
          children: 1,
          infants: 0,
          addons: '["Almuerzo","Guía privada"]',
          adultUnit: '40.00',
          childUnit: '10.00',
          infantUnit: '0.00',
          addonTotal: '10.00',
          lineTotal: opts.total ?? '100.00',
        },
      },
    },
  })
}

async function createProbePayment(bookingId: string, amountPaid: string) {
  const reference = mintPaymentReference()
  return db.payment.create({
    data: {
      reference,
      bookingId,
      provider: 'offline',
      status: 'PAID',
      currency: 'USD',
      amount: amountPaid,
      amountPaid,
      amountRefunded: '0.00',
      paidAt: new Date(),
      idempotencyKey: `pdf-pay-${Date.now()}-${reference}`,
    },
  })
}

async function cleanup(opts: {
  bookingIds: string[]
  bookingRefs: string[]
  userIds: string[]
}): Promise<void> {
  await db.bookingDocument.deleteMany({ where: { bookingId: { in: opts.bookingIds } } }).catch(() => undefined)
  await db.bookingAccessToken.deleteMany({ where: { bookingRef: { in: opts.bookingRefs } } }).catch(() => undefined)
  await db.payment.deleteMany({ where: { bookingId: { in: opts.bookingIds } } }).catch(() => undefined)
  await db.bookingActivity.deleteMany({ where: { bookingId: { in: opts.bookingIds } } }).catch(() => undefined)
  await db.bookingItem.deleteMany({ where: { bookingId: { in: opts.bookingIds } } }).catch(() => undefined)
  await db.booking.deleteMany({ where: { id: { in: opts.bookingIds } } }).catch(() => undefined)
  await db.user.deleteMany({ where: { id: { in: opts.userIds } } }).catch(() => undefined)
}

function expectPdfHeaders(response: Response, numberPattern: RegExp): void {
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('application/pdf')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  const disposition = response.headers.get('content-disposition') ?? ''
  expect(disposition).toMatch(new RegExp(`^attachment; filename="${numberPattern.source}\\.pdf"$`))
}
async function expectValidPdf(response: Response): Promise<void> {
  const bytes = Buffer.from(await response.arrayBuffer())
  expect(bytes.length).toBeGreaterThan(4000)
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  expect(bytes.includes(Buffer.from('%%EOF'))).toBe(true)
}

describe.runIf(reachable)('PDF download access matrix (real database)', () => {
  it('lets the owner download, refuses strangers and missing sessions', async () => {
    const owner = await createProbeUser('owner')
    const stranger = await createProbeUser('stranger')
    const booking = await createProbeBooking({ userId: owner.id, tag: 'owner' })
    try {
      const issued = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: booking.reference,
        idempotencyKey: `pdf-owner-${Date.now()}`,
      })
      if (!issued.ok) throw new Error(`issuance failed: ${issued.error}`)
      const url = `http://localhost/api/account/bookings/${booking.reference}/documents/${issued.document.id}/pdf`

      mockGetCurrentUser.mockResolvedValue({ id: owner.id } as never)
      const ok = await call(ownerPdf, url, { ref: booking.reference, documentId: issued.document.id })
      expectPdfHeaders(ok, /SP-BRQ-\d{4}-\d{6}/)
      await expectValidPdf(ok)

      // Downloading never issues documents or writes rows.
      const count = await db.bookingDocument.count({ where: { bookingId: booking.id } })
      expect(count).toBe(1)

      mockGetCurrentUser.mockResolvedValue({ id: stranger.id } as never)
      const forbidden = await call(ownerPdf, url, { ref: booking.reference, documentId: issued.document.id })
      expect(forbidden.status).toBe(404)
      expect(await forbidden.json()).toEqual({ error: 'Document not found.' })

      mockGetCurrentUser.mockResolvedValue(null)
      const anonymous = await call(ownerPdf, url, { ref: booking.reference, documentId: issued.document.id })
      expect(anonymous.status).toBe(401)
    } finally {
      mockGetCurrentUser.mockResolvedValue(null)
      await cleanup({ bookingIds: [booking.id], bookingRefs: [booking.reference], userIds: [owner.id, stranger.id] })
    }
  })

  it('lets staff with bookings.view or payments.view download and refuses the rest', async () => {
    const booking = await createProbeBooking({ userId: null, tag: 'staff' })
    try {
      const issued = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: booking.reference,
        idempotencyKey: `pdf-staff-${Date.now()}`,
      })
      if (!issued.ok) throw new Error(`issuance failed: ${issued.error}`)
      const url = `http://localhost/api/admin/bookings/${booking.reference}/documents/${issued.document.id}/pdf`

      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.view']))
      const ok = await call(staffPdf, url, { ref: booking.reference, documentId: issued.document.id })
      expectPdfHeaders(ok, /SP-BRQ-\d{4}-\d{6}/)
      await expectValidPdf(ok)

      mockGetCurrentUser.mockResolvedValue(staffUser(['payments.view']))
      const okPayments = await call(staffPdf, url, { ref: booking.reference, documentId: issued.document.id })
      expectPdfHeaders(okPayments, /SP-BRQ-\d{4}-\d{6}/)

      mockGetCurrentUser.mockResolvedValue(staffUser(['customers.view']))
      const forbidden = await call(staffPdf, url, { ref: booking.reference, documentId: issued.document.id })
      expect(forbidden.status).toBe(403)
      expect(forbidden.headers.get('cache-control')).toBe('private, no-store')

      mockGetCurrentUser.mockResolvedValue(null)
      const anonymous = await call(staffPdf, url, { ref: booking.reference, documentId: issued.document.id })
      expect(anonymous.status).toBe(401)
    } finally {
      mockGetCurrentUser.mockResolvedValue(null)
      await cleanup({ bookingIds: [booking.id], bookingRefs: [booking.reference], userIds: [] })
    }
  })

  it('valid guest tokens download; invalid, expired and cross-booking tokens get the uniform 404', async () => {
    const bookingB = await createProbeBooking({ userId: null, tag: 'guest' })
    const bookingA = await createProbeBooking({ userId: null, tag: 'cross' })
    try {
      const issuedB = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: bookingB.reference,
        idempotencyKey: `pdf-guestb-${Date.now()}`,
      })
      const issuedA = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: bookingA.reference,
        idempotencyKey: `pdf-guesta-${Date.now()}`,
      })
      if (!issuedB.ok || !issuedA.ok) throw new Error('issuance failed')

      const minted = await issueGuestBookingToken(bookingB.reference)
      if (!minted) throw new Error('token minting failed')

      const ok = await call(
        guestPdf,
        `http://localhost/api/bookings/access/${minted.token}/documents/${issuedB.document.id}/pdf`,
        { token: minted.token, documentId: issuedB.document.id },
        '10.1.1.1',
      )
      expectPdfHeaders(ok, /SP-BRQ-\d{4}-\d{6}/)
      await expectValidPdf(ok)

      // Cross-booking: token of B against document of A.
      const cross = await call(
        guestPdf,
        `http://localhost/api/bookings/access/${minted.token}/documents/${issuedA.document.id}/pdf`,
        { token: minted.token, documentId: issuedA.document.id },
        '10.1.1.2',
      )
      expect(cross.status).toBe(404)
      expect(await cross.json()).toEqual({ error: 'Document not found.' })

      // Malformed token — same refusal as the guest booking view.
      const malformed = await call(
        guestPdf,
        `http://localhost/api/bookings/access/bad-token/documents/${issuedB.document.id}/pdf`,
        { token: 'bad-token', documentId: issuedB.document.id },
        '10.1.1.3',
      )
      expect(malformed.status).toBe(404)
      expect(await malformed.json()).toEqual({ error: 'This booking link is not valid.' })

      // Expired token: mint another, then force-expire every active
      // token of this booking (the valid download above already ran).
      const expiring = await issueGuestBookingToken(bookingB.reference)
      if (!expiring) throw new Error('token minting failed')
      await db.bookingAccessToken.updateMany({
        where: { bookingRef: bookingB.reference, revokedAt: null },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      })
      const expired = await call(
        guestPdf,
        `http://localhost/api/bookings/access/${expiring.token}/documents/${issuedB.document.id}/pdf`,
        { token: expiring.token, documentId: issuedB.document.id },
        '10.1.1.4',
      )
      expect(expired.status).toBe(404)
      expect(await expired.json()).toEqual({ error: 'This booking link is not valid.' })
    } finally {
      await cleanup({
        bookingIds: [bookingA.id, bookingB.id],
        bookingRefs: [bookingA.reference, bookingB.reference],
        userIds: [],
      })
    }
  })

  it('rejects booking-reference mismatches and unknown document ids', async () => {
    const bookingA = await createProbeBooking({ userId: null, tag: 'refa' })
    const bookingB = await createProbeBooking({ userId: null, tag: 'refb' })
    try {
      const issuedA = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: bookingA.reference,
        idempotencyKey: `pdf-refa-${Date.now()}`,
      })
      if (!issuedA.ok) throw new Error('issuance failed')

      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.view']))
      // Valid document id, but under the wrong booking's address.
      const mismatch = await call(
        staffPdf,
        `http://localhost/api/admin/bookings/${bookingB.reference}/documents/${issuedA.document.id}/pdf`,
        { ref: bookingB.reference, documentId: issuedA.document.id },
      )
      expect(mismatch.status).toBe(404)
      expect(await mismatch.json()).toEqual({ error: 'Document not found.' })

      const unknown = await call(
        staffPdf,
        `http://localhost/api/admin/bookings/${bookingA.reference}/documents/not-a-real-document-id/pdf`,
        { ref: bookingA.reference, documentId: 'not-a-real-document-id' },
      )
      expect(unknown.status).toBe(404)
    } finally {
      mockGetCurrentUser.mockResolvedValue(null)
      await cleanup({
        bookingIds: [bookingA.id, bookingB.id],
        bookingRefs: [bookingA.reference, bookingB.reference],
        userIds: [],
      })
    }
  })

  it('renders all six document types through the same guarded download', async () => {
    // Phase D completed the set: invoices, refund notes and vouchers
    // download through the identical access gate as the original three.
    const booking = await createProbeBooking({ userId: null, tag: 'alltypes' })
    try {
      await db.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } })
      const payment = await createProbePayment(booking.id, '100.00')
      const refund = await recordTestRefund(payment.reference, '20.00', 'alltypes')
      const specs = [
        { type: 'BOOKING_REQUEST', input: {}, pattern: /SP-BRQ-\d{4}-\d{6}/ },
        { type: 'BOOKING_CONFIRMATION', input: {}, pattern: /SP-BCF-\d{4}-\d{6}/ },
        { type: 'PAYMENT_RECEIPT', input: { paymentReference: payment.reference }, pattern: /SP-RCPT-\d{4}-\d{6}/ },
        { type: 'INVOICE', input: {}, pattern: /SP-INV-\d{4}-\d{6}/ },
        { type: 'BOOKING_VOUCHER', input: {}, pattern: /SP-VCH-\d{4}-\d{6}/ },
        { type: 'REFUND_NOTE', input: { paymentReference: payment.reference, refundEventId: refund.eventId }, pattern: /SP-RFD-\d{4}-\d{6}/ },
      ] as const
      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.view']))
      for (const spec of specs) {
        const issued = await issueBookingDocument({
          type: spec.type,
          bookingReference: booking.reference,
          ...spec.input,
          idempotencyKey: `pdf-all-${spec.type}-${Date.now()}`,
        })
        if (!issued.ok) throw new Error(`${spec.type} issuance failed: ${issued.error}`)
        const res = await call(
          staffPdf,
          `http://localhost/api/admin/bookings/${booking.reference}/documents/${issued.document.id}/pdf`,
          { ref: booking.reference, documentId: issued.document.id },
        )
        expectPdfHeaders(res, spec.pattern)
        await expectValidPdf(res)
      }
    } finally {
      mockGetCurrentUser.mockResolvedValue(null)
      await cleanup({ bookingIds: [booking.id], bookingRefs: [booking.reference], userIds: [] })
    }
  }, 15_000)

  it('issues nothing on download attempts for bookings without documents', async () => {
    const booking = await createProbeBooking({ userId: null, tag: 'noissue' })
    const payment = await createProbePayment(booking.id, '40.00')
    try {
      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.view']))
      const attempt = await call(
        staffPdf,
        `http://localhost/api/admin/bookings/${booking.reference}/documents/any-id/pdf`,
        { ref: booking.reference, documentId: 'any-id' },
      )
      expect(attempt.status).toBe(404)
      const count = await db.bookingDocument.count({ where: { bookingId: booking.id } })
      expect(count).toBe(0)
      // The payment row itself is untouched by the download attempt.
      const stillPaid = await db.payment.findUnique({ where: { id: payment.id }, select: { amountPaid: true } })
      expect(stillPaid?.amountPaid.toNumber()).toBe(40)
    } finally {
      mockGetCurrentUser.mockResolvedValue(null)
      await cleanup({ bookingIds: [booking.id], bookingRefs: [booking.reference], userIds: [] })
    }
  })
})

describe.runIf(reachable)('PDF financial accuracy (real database)', () => {
  it('receipts freeze their own payment amount and never include other payments', async () => {
    const booking = await createProbeBooking({ userId: null, tag: 'receipt' })
    try {
      const paymentA = await createProbePayment(booking.id, '40.00')
      const issued = await issueBookingDocument({
        type: 'PAYMENT_RECEIPT',
        bookingReference: booking.reference,
        paymentReference: paymentA.reference,
        idempotencyKey: `pdf-receipt-${Date.now()}`,
      })
      if (!issued.ok) throw new Error(`issuance failed: ${issued.error}`)

      // A second, later payment must not leak into the receipt.
      await createProbePayment(booking.id, '60.00')

      const actor = { kind: 'staff' as const, user: { roles: ['STAFF'], permissions: ['bookings.view'] } }
      const model = await loadBookingDocumentPdfModel(actor, issued.document.id, booking.reference)
      expect(model).not.toBeNull()
      expect(model!.document.type).toBe('PAYMENT_RECEIPT')
      expect(model!.document.number).toBe(issued.document.number)
      expect(model!.receipt).not.toBeNull()
      expect(model!.receipt!.amountReceivedCents).toBe(4000)
      expect(model!.receipt!.paymentReference).toBe(paymentA.reference)
      // No booking-level summary block on receipts.
      expect(model!.booking.summary).toBeNull()
      // Refunds appear only as a separate "to date" value.
      await db.payment.update({
        where: { id: paymentA.id },
        data: { amountRefunded: '10.00', status: 'PARTIALLY_REFUNDED' },
      })
      const afterRefund = await loadBookingDocumentPdfModel(actor, issued.document.id, booking.reference)
      expect(afterRefund!.receipt!.amountReceivedCents).toBe(4000)
      expect(afterRefund!.receipt!.refundedToDateCents).toBe(1000)
    } finally {
      await cleanup({ bookingIds: [booking.id], bookingRefs: [booking.reference], userIds: [] })
    }
  })

  it('keeps the issued total snapshot when the booking total changes later', async () => {
    const booking = await createProbeBooking({ userId: null, tag: 'snapshot' })
    try {
      const issued = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: booking.reference,
        idempotencyKey: `pdf-snapshot-${Date.now()}`,
      })
      if (!issued.ok) throw new Error(`issuance failed: ${issued.error}`)
      expect(issued.document.amountCents).toBe(10000)

      await db.booking.update({ where: { id: booking.id }, data: { total: '250.00', subtotal: '250.00' } })

      const actor = { kind: 'staff' as const, user: { roles: ['STAFF'], permissions: ['bookings.view'] } }
      const model = await loadBookingDocumentPdfModel(actor, issued.document.id, booking.reference)
      expect(model!.booking.summary!.totalAtIssueCents).toBe(10000)
      expect(model!.booking.summary!.totalAtIssueCents).not.toBe(25000)

      // A confirmation issued AFTER the change snapshots the new total,
      // proving amounts freeze at issuance time.
      await db.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } })
      const confirmation = await issueBookingDocument({
        type: 'BOOKING_CONFIRMATION',
        bookingReference: booking.reference,
        idempotencyKey: `pdf-snapshot-conf-${Date.now()}`,
      })
      if (!confirmation.ok) throw new Error(`issuance failed: ${confirmation.error}`)
      expect(confirmation.document.amountCents).toBe(25000)
      const confModel = await loadBookingDocumentPdfModel(actor, confirmation.document.id, booking.reference)
      expect(confModel!.booking.summary!.totalAtIssueCents).toBe(25000)
      expect(confModel!.document.typeLabel).toBe('Booking Confirmation')
    } finally {
      await cleanup({ bookingIds: [booking.id], bookingRefs: [booking.reference], userIds: [] })
    }
  })
})

