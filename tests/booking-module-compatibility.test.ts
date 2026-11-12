import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), findMany: vi.fn(), transaction: vi.fn(), resolveToken: vi.fn(),
}))
vi.mock('@/lib/server/db', () => ({ db: {
  booking: { findUnique: mocks.findUnique, findMany: mocks.findMany },
  $transaction: mocks.transaction,
} }))
vi.mock('@/lib/server/catalogue/tours', () => ({ findTourBySlug: vi.fn() }))
vi.mock('@/lib/server/notifications/notifications', () => ({ notifyUser: vi.fn(), notifyStaff: vi.fn() }))
vi.mock('@/lib/server/email/email', () => ({ sendCustomerEmailSafe: vi.fn(), sendStaffEmailSafe: vi.fn() }))
vi.mock('@/lib/server/booking/access/booking-access', () => ({
  resolveGuestBookingToken: mocks.resolveToken,
  GuestBookingAccessError: class extends Error {},
  guestBookingPath: vi.fn(), issueGuestBookingToken: vi.fn(), revokeGuestBookingTokens: vi.fn(),
}))

import * as entry from '@/lib/server/booking/bookings'
import * as validation from '@/lib/server/booking/booking-validation'
import * as views from '@/lib/server/booking/booking-read-models'
import * as queries from '@/lib/server/booking/booking-queries'
import * as replay from '@/lib/server/booking/booking-replay'

type Row = Parameters<typeof entry.toCustomerView>[0]
const date = new Date('2026-11-10T00:00:00Z')
function booking(overrides: Partial<Row> = {}): Row {
  return {
    id: 'booking-fixture', reference: 'SP-BK-FIXTURE', userId: 'owner',
    status: 'PENDING', paymentStatus: 'PENDING', currency: 'USD',
    subtotal: '100.00', discount: '0.00', total: '100.00',
    contactName: 'Fixture Customer', contactEmail: 'fixture@example.test', contactPhone: '+12025550123',
    notes: null, createdAt: date, updatedAt: date,
    items: [], activities: [], payments: [], user: null, ...overrides,
  } as Row
}

beforeEach(() => {
  vi.resetAllMocks()
  const unexpected = () => { throw new Error('Unexpected isolated persistence call') }
  mocks.findUnique.mockImplementation(unexpected)
  mocks.findMany.mockImplementation(unexpected)
  mocks.transaction.mockImplementation(unexpected)
  mocks.resolveToken.mockImplementation(unexpected)
})

describe('booking service entry-point compatibility', () => {
  it('preserves the complete runtime export surface', () => {
    expect(Object.keys(entry).sort()).toEqual([
      'BOOKING_FINANCIAL_REVIEW_CODE', 'BookingFinancialReviewError', 'addStaffBookingNote',
      'cancelCustomerBooking', 'createBookingRecord', 'findCheckoutReplay', 'getCustomerBooking',
      'getGuestBooking', 'getStaffBooking', 'listCustomerBookings', 'listStaffBookings',
      'toCustomerView', 'toStaffView', 'transitionStaffBooking', 'validateBookingDraft',
    ].sort())
  })

  it.each([
    ['validateBookingDraft', validation.validateBookingDraft],
    ['toCustomerView', views.toCustomerView], ['toStaffView', views.toStaffView],
    ['listCustomerBookings', queries.listCustomerBookings], ['getCustomerBooking', queries.getCustomerBooking],
    ['getGuestBooking', queries.getGuestBooking], ['listStaffBookings', queries.listStaffBookings],
    ['getStaffBooking', queries.getStaffBooking], ['findCheckoutReplay', replay.findCheckoutReplay],
  ] as const)('re-exports %s with identical function identity', (name, fn) => {
    expect(entry[name]).toBe(fn)
  })

  it('keeps the financial-review error and code contract', () => {
    const error = new entry.BookingFinancialReviewError()
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('BookingFinancialReviewError')
    expect(error.code).toBe(entry.BOOKING_FINANCIAL_REVIEW_CODE)
  })
})

describe('isolated booking read and replay boundaries', () => {
  it('retains customer scope, descending order and minimal list includes', async () => {
    mocks.findMany.mockResolvedValue([booking()])
    const result = await entry.listCustomerBookings('owner')
    expect(mocks.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { userId: 'owner' }, orderBy: { createdAt: 'desc' },
      include: { items: true, activities: false, payments: views.paymentSelect, user: false },
    })
    expect(result[0]).toMatchObject({ reference: 'SP-BK-FIXTURE', total: 100, activity: [] })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it.each([null, 'another-user'])('rejects an account read owned by %s', async userId => {
    mocks.findUnique.mockResolvedValue(booking({ userId }))
    expect(await entry.getCustomerBooking('owner', 'SP-BK-FIXTURE')).toBeNull()
    expect(mocks.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { reference: 'SP-BK-FIXTURE' }, include: views.rowInclude })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('does not read a booking when guest authorization fails', async () => {
    mocks.resolveToken.mockRejectedValue(new Error('expired token fixture'))
    await expect(entry.getGuestBooking('invalid-fixture')).rejects.toThrow('expired token fixture')
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('derives the guest booking reference from the authorized token', async () => {
    mocks.resolveToken.mockResolvedValue({ reference: 'SP-BK-FIXTURE' })
    mocks.findUnique.mockResolvedValue(booking({ userId: null }))
    expect(await entry.getGuestBooking('opaque-fixture')).toMatchObject({ reference: 'SP-BK-FIXTURE' })
    expect(mocks.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { reference: 'SP-BK-FIXTURE' }, include: views.rowInclude })
  })

  it('rejects a guest token after the booking gains an account', async () => {
    mocks.resolveToken.mockResolvedValue({ reference: 'SP-BK-FIXTURE' })
    mocks.findUnique.mockResolvedValue(booking())
    await expect(entry.getGuestBooking('opaque-fixture')).rejects.toThrow('not-found')
  })

  it('preserves the distinct staff and customer activity projections', () => {
    const row = booking({ activities: [
      { id: 'internal', bookingId: 'booking-fixture', actorRole: 'staff', action: 'Internal note', note: 'Private fixture', isInternal: true, createdAt: date },
      { id: 'public', bookingId: 'booking-fixture', actorRole: 'customer', action: 'Booking created', note: null, isInternal: false, createdAt: date },
    ] })
    expect(entry.toCustomerView(row).activity).toHaveLength(1)
    expect(JSON.stringify(entry.toCustomerView(row))).not.toContain('Private fixture')
    expect(entry.toStaffView(row).activity).toHaveLength(2)
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('retains staff list ordering and account includes', async () => {
    mocks.findMany.mockResolvedValue([booking()])
    expect(await entry.listStaffBookings()).toHaveLength(1)
    expect(mocks.findMany).toHaveBeenCalledExactlyOnceWith({
      orderBy: { createdAt: 'desc' }, include: {
        items: true, activities: false, payments: views.paymentSelect,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    })
  })

  it('returns null for a missing staff detail without starting a transaction', async () => {
    mocks.findUnique.mockResolvedValue(null)
    expect(await entry.getStaffBooking('missing-fixture')).toBeNull()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('keeps replay ownership checks and captured Marketing consent for a pending booking with a long public tour slug', async () => {
    const key = 'checkout-key-fixture'
    const slug = 'alexandriaarchaeologicalmuseumexperience-private-tour'
    const digest = (category: string, grant: string) => createHash('sha256')
      .update(JSON.stringify(['sp-booking-consent-v1', key, category, grant])).digest('hex')
    const row = booking({ items: [{
      id: 'item-fixture', bookingId: 'booking-fixture', tourSlug: slug, tourTitle: 'Fixture tour',
      tourImage: null, travelDate: '', adults: 1, children: 0, infants: 0, addons: '[]',
      adultUnit: '100.00', childUnit: '0.00', infantUnit: '0.00', addonTotal: '0.00', lineTotal: '100.00',
    } as Row['items'][number]], activities: [{
      id: 'attempt', bookingId: 'booking-fixture', actorRole: 'system', isInternal: true,
      action: 'Checkout attempt fingerprint v1', createdAt: date,
      note: JSON.stringify({ fingerprint: 'same-fixture', owner: 'owner', measurement: { analytics: digest('analytics', 'analytics-fixture') } }),
    }] })
    mocks.findUnique.mockResolvedValue(row)
    const result = await entry.findCheckoutReplay('owner', key, 'same-fixture', undefined, undefined,
      { analytics: 'analytics-fixture', marketing: 'new-marketing-fixture' })
    expect(result).toMatchObject({ created: false, guestAccessUrl: null })
    expect(result?.bookingMeasurement?.grants).toEqual({ analytics: 'analytics-fixture', marketing: undefined })
    expect(result?.bookingMeasurement?.event).toMatchObject({ event: 'sp_booking_created', items: [{ item_id: slug, quantity: 1, price: 100 }] })
    await expect(entry.findCheckoutReplay('intruder', key, 'same-fixture')).rejects.toThrow('already used')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
