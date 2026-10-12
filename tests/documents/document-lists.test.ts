// Phase C: document list endpoint tests (real database).
//
// The three audiences list through three different routes with three
// different credentials, but read the same issued rows:
// - staff: GET /api/admin/bookings/[ref]/documents (bookings.view or
//   payments.view; also serves the receipt dialog's verified payments);
// - owner: GET /api/account/bookings/[ref]/documents (CUSTOMER session
//   owning the booking);
// - guest: GET /api/bookings/access/[token]/documents (valid token only,
//   metadata without any token in the payload).
//
// Listing is read-only everywhere: it never issues, renumbers, or
// otherwise writes document rows.
//
// Safety: session auth is mocked at the getCurrentUser boundary; probe
// rows are deleted in `finally`.

import { describe, it, expect, vi, afterAll } from 'vitest'

vi.mock('@/lib/server/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/auth')>()
  return { ...actual, getCurrentUser: vi.fn(async () => null) }
})

import { getCurrentUser } from '@/lib/server/auth'
import { issueGuestBookingToken } from '@/lib/server/booking-access'
import { issueBookingDocument } from '@/lib/server/documents'
import { db } from '@/lib/server/db'
import { GET as staffList } from '@/app/api/admin/bookings/[ref]/documents/route'
import { GET as ownerList } from '@/app/api/account/bookings/[ref]/documents/route'
import { GET as guestList } from '@/app/api/bookings/access/[token]/documents/route'

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

function staffUser(permissions: string[], id = 'staff-list-probe') {
  return { id, publicId: 'p', email: 'staff@example.com', roles: ['STAFF'], permissions } as never
}

function customerUser(id: string) {
  return { id, publicId: 'p', email: 'owner@example.com', roles: ['CUSTOMER'], permissions: [] } as never
}

function ctx(params: Record<string, string>) {
  return { params: Promise.resolve(params) }
}

async function createProbeUser(tag: string) {
  const email = `doc-list-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  return db.user.create({
    data: { email, emailNormalized: email.toLowerCase(), status: 'ACTIVE' },
    select: { id: true },
  })
}

async function createProbeBooking(userId: string | null, tag: string) {
  const reference = `SP-BK-${mintSuffix()}`
  return db.booking.create({
    data: {
      reference,
      userId,
      contactName: 'List Probe',
      contactEmail: `doc-list-${tag}-${Date.now()}@example.com`,
      contactPhone: '+10000000000',
      currency: 'USD',
      subtotal: '120.00',
      discount: '0.00',
      total: '120.00',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      idempotencyKey: `doc-list-${tag}-${Date.now()}-${reference}`,
    },
  })
}

async function createProbePayment(bookingId: string, amountPaid: string) {
  const reference = `SP-PAY-${mintSuffix()}`
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
      idempotencyKey: `doc-list-pay-${Date.now()}-${reference}`,
    },
  })
}

async function cleanup(bookingIds: string[], bookingRefs: string[], userIds: string[]) {
  await db.bookingDocument.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined)
  await db.bookingAccessToken.deleteMany({ where: { bookingRef: { in: bookingRefs } } }).catch(() => undefined)
  await db.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined)
  await db.bookingItem.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined)
  await db.booking.deleteMany({ where: { id: { in: bookingIds } } }).catch(() => undefined)
  await db.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined)
}

describe.runIf(reachable)('staff document list (real database)', () => {
  it('requires a session, a view permission, and a real booking', async () => {
    const booking = await createProbeBooking(null, 'staff-empty')
    try {
      mockGetCurrentUser.mockResolvedValue(null)
      const anon = await staffList(
        new Request(`http://localhost/api/admin/bookings/${booking.reference}/documents`),
        ctx({ ref: booking.reference }),
      )
      expect(anon.status).toBe(401)

      mockGetCurrentUser.mockResolvedValue(staffUser([]))
      const forbidden = await staffList(
        new Request(`http://localhost/api/admin/bookings/${booking.reference}/documents`),
        ctx({ ref: booking.reference }),
      )
      expect(forbidden.status).toBe(403)

      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.view']))
      const missing = await staffList(
        new Request('http://localhost/api/admin/bookings/SP-BK-NOPE01/documents'),
        ctx({ ref: 'SP-BK-NOPE01' }),
      )
      expect(missing.status).toBe(404)
    } finally {
      mockGetCurrentUser.mockResolvedValue(null)
      await cleanup([booking.id], [booking.reference], [])
    }
  })

  it('lists documents plus verified payments without issuing anything', async () => {
    const booking = await createProbeBooking(null, 'staff-full')
    try {
      const issued = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: booking.reference,
        idempotencyKey: `doc-list-issue-${Date.now()}`,
      })
      if (!issued.ok) throw new Error(`issuance failed: ${issued.error}`)
      const payment = await createProbePayment(booking.id, '50.00')
      // Unverified money (amountPaid 0) must not appear as a receipt option.
      await db.payment.create({
        data: {
          reference: `SP-PAY-${mintSuffix()}`,
          bookingId: booking.id,
          provider: 'offline',
          status: 'PENDING',
          currency: 'USD',
          amount: '70.00',
          amountPaid: '0.00',
          amountRefunded: '0.00',
          idempotencyKey: `doc-list-unpaid-${Date.now()}`,
        },
      })

      mockGetCurrentUser.mockResolvedValue(staffUser(['payments.view']))
      const res = await staffList(
        new Request(`http://localhost/api/admin/bookings/${booking.reference}/documents`),
        ctx({ ref: booking.reference }),
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        documents: Array<{ id: string; number: string; type: string; amountCents: number; issuedAt: string }>
        verifiedPayments: Array<{ reference: string; amountPaidCents: number; paidAt: string | null }>
        issuableTypes: string[]
      }
      expect(body.documents).toHaveLength(1)
      expect(body.documents[0].id).toBe(issued.document.id)
      expect(body.documents[0].number).toMatch(/^SP-BRQ-\d{4}-\d{6}$/)
      expect(body.documents[0].amountCents).toBe(12000)
      expect(typeof body.documents[0].issuedAt).toBe('string')
      expect(body.verifiedPayments).toHaveLength(1)
      expect(body.verifiedPayments[0].reference).toBe(payment.reference)
      expect(body.verifiedPayments[0].amountPaidCents).toBe(5000)
      expect(body.issuableTypes).toEqual([
        'BOOKING_REQUEST',
        'BOOKING_CONFIRMATION',
        'PAYMENT_RECEIPT',
        'INVOICE',
        'BOOKING_VOUCHER',
        'REFUND_NOTE',
      ])

      // Listing wrote nothing: still exactly one document.
      expect(await db.bookingDocument.count({ where: { bookingId: booking.id } })).toBe(1)
    } finally {
      mockGetCurrentUser.mockResolvedValue(null)
      await cleanup([booking.id], [booking.reference], [])
    }
  })
})

describe.runIf(reachable)('owner document list (real database)', () => {
  it('serves the owner, 404s strangers and anonymous callers', async () => {
    const owner = await createProbeUser('list-owner')
    const stranger = await createProbeUser('list-stranger')
    const booking = await createProbeBooking(owner.id, 'owner-docs')
    try {
      const issued = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: booking.reference,
        idempotencyKey: `doc-list-owner-${Date.now()}`,
      })
      if (!issued.ok) throw new Error(`issuance failed: ${issued.error}`)

      mockGetCurrentUser.mockResolvedValue(customerUser(owner.id))
      const ok = await ownerList(
        new Request(`http://localhost/api/account/bookings/${booking.reference}/documents`),
        ctx({ ref: booking.reference }),
      )
      expect(ok.status).toBe(200)
      const body = (await ok.json()) as { documents: Array<{ id: string; number: string }> }
      expect(body.documents).toHaveLength(1)
      expect(body.documents[0].id).toBe(issued.document.id)

      mockGetCurrentUser.mockResolvedValue(customerUser(stranger.id))
      const strangerRes = await ownerList(
        new Request(`http://localhost/api/account/bookings/${booking.reference}/documents`),
        ctx({ ref: booking.reference }),
      )
      expect(strangerRes.status).toBe(404)
      expect(await strangerRes.json()).toEqual({ error: 'Booking not found.' })

      mockGetCurrentUser.mockResolvedValue(null)
      const anon = await ownerList(
        new Request(`http://localhost/api/account/bookings/${booking.reference}/documents`),
        ctx({ ref: booking.reference }),
      )
      expect(anon.status).toBe(401)
    } finally {
      mockGetCurrentUser.mockResolvedValue(null)
      await cleanup([booking.id], [booking.reference], [owner.id, stranger.id])
    }
  })
})

describe.runIf(reachable)('guest document list (real database)', () => {
  it('serves a valid token, refuses the rest uniformly, leaks no token', async () => {
    const booking = await createProbeBooking(null, 'guest-docs')
    const other = await createProbeBooking(null, 'guest-docs-other')
    try {
      // Confirmations need a confirmed booking; the probe updates the
      // booking directly (the endpoint under test never mutates).
      await db.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } })
      const issued = await issueBookingDocument({
        type: 'BOOKING_CONFIRMATION',
        bookingReference: booking.reference,
        idempotencyKey: `doc-list-guest-${Date.now()}`,
      })
      if (!issued.ok) throw new Error(`issuance failed: ${issued.error}`)
      const otherIssued = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: other.reference,
        idempotencyKey: `doc-list-guest-other-${Date.now()}`,
      })
      if (!otherIssued.ok) throw new Error(`other issuance failed: ${otherIssued.error}`)
      const minted = await issueGuestBookingToken(booking.reference)
      if (!minted) throw new Error('guest token minting failed')
      const otherMinted = await issueGuestBookingToken(other.reference)
      if (!otherMinted) throw new Error('other guest token minting failed')

      const ok = await guestList(
        new Request(`http://localhost/api/bookings/access/${minted.token}/documents`, {
          headers: { 'x-forwarded-for': '10.7.7.1' },
        }),
        ctx({ token: minted.token }),
      )
      expect(ok.status).toBe(200)
      expect(ok.headers.get('cache-control')).toBe('no-store')
      const raw = await ok.text()
      // The credential never appears in the payload.
      expect(raw).not.toContain(minted.token)
      const body = JSON.parse(raw) as { documents: Array<{ id: string; type: string }> }
      // Exactly this booking's documents — nothing from the other booking.
      expect(body.documents).toHaveLength(1)
      expect(body.documents[0].id).toBe(issued.document.id)
      expect(body.documents[0].type).toBe('BOOKING_CONFIRMATION')

      const otherOk = await guestList(
        new Request(`http://localhost/api/bookings/access/${otherMinted.token}/documents`, {
          headers: { 'x-forwarded-for': '10.7.7.2' },
        }),
        ctx({ token: otherMinted.token }),
      )
      expect(otherOk.status).toBe(200)
      const otherBody = (await otherOk.json()) as { documents: Array<{ id: string }> }
      expect(otherBody.documents).toHaveLength(1)
      expect(otherBody.documents[0].id).toBe(otherIssued.document.id)

      const bad = await guestList(
        new Request('http://localhost/api/bookings/access/bad-token/documents', {
          headers: { 'x-forwarded-for': '10.7.7.3' },
        }),
        ctx({ token: 'bad-token' }),
      )
      expect(bad.status).toBe(404)
      expect(await bad.json()).toEqual({ error: 'This booking link is not valid.' })
    } finally {
      await cleanup([booking.id, other.id], [booking.reference, other.reference], [])
    }
  })
})
