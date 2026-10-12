// Real-database document access-control tests (Phase A).
//
// Verifies the single access gate (`getBookingDocumentForActor`) that
// every future document download route MUST use:
// - owner: only the booking's registered customer; guest-checkout
//   bookings have no owner;
// - staff: only identities holding `bookings.view` or `payments.view`
//   (SUPER_ADMIN passes by the standard bypass);
// - guest: only a valid token for THAT booking; malformed, unknown and
//   expired tokens all collapse to the same null;
// - unknown documents are null for every actor kind.
//
// There is no HTTP route and no public document URL in this phase; this
// service gate is the authorization foundation.

import { describe, it, expect, afterAll } from 'vitest'

import { db } from '@/lib/server/db'
import { issueGuestBookingToken } from '@/lib/server/booking-access'
import {
  getBookingDocumentForActor,
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

async function createProbeUser(tag: string) {
  const email = `doc-access-${tag}-${Date.now()}@example.com`
  return db.user.create({
    data: {
      email,
      emailNormalized: email.toLowerCase(),
      status: 'ACTIVE',
    },
    select: { id: true },
  })
}

async function createProbeBooking(userId: string | null, tag: string) {
  const reference = mintBookingReference()
  return db.booking.create({
    data: {
      reference,
      userId,
      contactName: 'Access Probe',
      contactEmail: `access-probe-${tag}-${Date.now()}-${reference}@example.com`,
      contactPhone: '+200000000000',
      currency: 'USD',
      subtotal: '50.00',
      discount: '0.00',
      total: '50.00',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      idempotencyKey: `access-${tag}-${Date.now()}-${reference}`,
    },
  })
}

async function issueFor(bookingId: string, bookingReference: string, tag: string) {
  const result = await issueBookingDocument({
    type: 'BOOKING_REQUEST',
    bookingReference,
    idempotencyKey: `access-doc-${tag}-${Date.now()}`,
  })
  if (!result.ok) throw new Error(`issuance failed: ${result.error}`)
  return result.document
}

async function cleanup(opts: {
  bookingIds: string[]
  userIds: string[]
}): Promise<void> {
  await db.bookingDocument.deleteMany({ where: { bookingId: { in: opts.bookingIds } } }).catch(() => undefined)
  await db.booking.deleteMany({ where: { id: { in: opts.bookingIds } } }).catch(() => undefined)
  await db.user.deleteMany({ where: { id: { in: opts.userIds } } }).catch(() => undefined)
}

describe.runIf(reachable)('document owner access (real database)', () => {
  it('grants the booking owner and refuses everyone else', async () => {
    const owner = await createProbeUser('owner')
    const stranger = await createProbeUser('stranger')
    const booking = await createProbeBooking(owner.id, 'owner')
    try {
      const document = await issueFor(booking.id, booking.reference, 'owner')

      const asOwner = await getBookingDocumentForActor(
        { kind: 'owner', userId: owner.id },
        document.id,
      )
      expect(asOwner?.id).toBe(document.id)

      const asStranger = await getBookingDocumentForActor(
        { kind: 'owner', userId: stranger.id },
        document.id,
      )
      expect(asStranger).toBeNull()

      const asEmpty = await getBookingDocumentForActor({ kind: 'owner', userId: '' }, document.id)
      expect(asEmpty).toBeNull()
    } finally {
      await cleanup({ bookingIds: [booking.id], userIds: [owner.id, stranger.id] })
    }
  })

  it('guest-checkout bookings have no owner', async () => {
    const booking = await createProbeBooking(null, 'guest-checkout')
    try {
      const document = await issueFor(booking.id, booking.reference, 'guestco')
      const asAnyUser = await getBookingDocumentForActor(
        { kind: 'owner', userId: 'any-user-id' },
        document.id,
      )
      expect(asAnyUser).toBeNull()
    } finally {
      await cleanup({ bookingIds: [booking.id], userIds: [] })
    }
  })
})

describe.runIf(reachable)('document staff access (real database)', () => {
  it('requires bookings.view or payments.view; SUPER_ADMIN passes', async () => {
    const booking = await createProbeBooking(null, 'staff')
    try {
      const document = await issueFor(booking.id, booking.reference, 'staff')

      const noPerms = { roles: ['STAFF'], permissions: [] as string[] }
      const bookingsViewer = { roles: ['STAFF'], permissions: ['bookings.view'] }
      const paymentsViewer = { roles: ['STAFF'], permissions: ['payments.view'] }
      const superAdmin = { roles: ['SUPER_ADMIN'], permissions: [] as string[] }
      const customer = { roles: ['CUSTOMER'], permissions: [] as string[] }

      expect(await getBookingDocumentForActor({ kind: 'staff', user: noPerms }, document.id)).toBeNull()
      expect(await getBookingDocumentForActor({ kind: 'staff', user: customer }, document.id)).toBeNull()
      expect(
        (await getBookingDocumentForActor({ kind: 'staff', user: bookingsViewer }, document.id))?.id,
      ).toBe(document.id)
      expect(
        (await getBookingDocumentForActor({ kind: 'staff', user: paymentsViewer }, document.id))?.id,
      ).toBe(document.id)
      expect(
        (await getBookingDocumentForActor({ kind: 'staff', user: superAdmin }, document.id))?.id,
      ).toBe(document.id)
    } finally {
      await cleanup({ bookingIds: [booking.id], userIds: [] })
    }
  })
})

describe.runIf(reachable)('document guest-token access (real database)', () => {
  it('accepts only a valid token for that exact booking', async () => {
    const bookingA = await createProbeBooking(null, 'guest-a')
    const bookingB = await createProbeBooking(null, 'guest-b')
    try {
      const documentA = await issueFor(bookingA.id, bookingA.reference, 'guest-a')
      const documentB = await issueFor(bookingB.id, bookingB.reference, 'guest-b')

      const issuedA = await issueGuestBookingToken(bookingA.reference)
      expect(issuedA).not.toBeNull()
      const issuedB = await issueGuestBookingToken(bookingB.reference)
      expect(issuedB).not.toBeNull()

      const own = await getBookingDocumentForActor(
        { kind: 'guest', rawToken: issuedA!.token },
        documentA.id,
      )
      expect(own?.id).toBe(documentA.id)

      // A valid token for a DIFFERENT booking grants nothing here.
      const crossBooking = await getBookingDocumentForActor(
        { kind: 'guest', rawToken: issuedB!.token },
        documentA.id,
      )
      expect(crossBooking).toBeNull()
      // ...but works for its own booking.
      const ownB = await getBookingDocumentForActor(
        { kind: 'guest', rawToken: issuedB!.token },
        documentB.id,
      )
      expect(ownB?.id).toBe(documentB.id)

      // Malformed and unknown tokens look identical.
      const malformed = await getBookingDocumentForActor(
        { kind: 'guest', rawToken: 'garbage' },
        documentA.id,
      )
      expect(malformed).toBeNull()
      const unknown = await getBookingDocumentForActor(
        { kind: 'guest', rawToken: issuedA!.token.slice(0, -4) + 'ZZZZ' },
        documentA.id,
      )
      expect(unknown).toBeNull()
    } finally {
      await db.bookingAccessToken.deleteMany({
        where: { bookingRef: { in: [bookingA.reference, bookingB.reference] } } ,
      }).catch(() => undefined)
      await cleanup({ bookingIds: [bookingA.id, bookingB.id], userIds: [] })
    }
  })

  it('refuses expired tokens with the same uniform failure', async () => {
    const booking = await createProbeBooking(null, 'expired')
    try {
      const document = await issueFor(booking.id, booking.reference, 'expired')
      const issued = await issueGuestBookingToken(booking.reference)
      expect(issued).not.toBeNull()

      await db.bookingAccessToken.updateMany({
        where: { bookingRef: booking.reference },
        data: { expiresAt: new Date(Date.now() - 1000) },
      })

      const expired = await getBookingDocumentForActor(
        { kind: 'guest', rawToken: issued!.token },
        document.id,
      )
      expect(expired).toBeNull()
    } finally {
      await db.bookingAccessToken.deleteMany({ where: { bookingRef: booking.reference } }).catch(() => undefined)
      await cleanup({ bookingIds: [booking.id], userIds: [] })
    }
  })
})

describe.runIf(reachable)('document access: unknown documents (real database)', () => {
  it('returns null for every actor kind', async () => {
    const missing = 'doc_missing_0000000000000000000'
    expect(await getBookingDocumentForActor({ kind: 'owner', userId: 'u1' }, missing)).toBeNull()
    expect(
      await getBookingDocumentForActor(
        { kind: 'staff', user: { roles: ['SUPER_ADMIN'], permissions: [] } },
        missing,
      ),
    ).toBeNull()
    expect(await getBookingDocumentForActor({ kind: 'guest', rawToken: 'garbage' }, missing)).toBeNull()
    expect(await getBookingDocumentForActor({ kind: 'owner', userId: 'u1' }, '')).toBeNull()
  })
})

if (!reachable) {
  describe.skip('document access control (real database)', () => {
    it('skipped: database unreachable', () => {
      expect(true).toBe(true)
    })
  })
}
