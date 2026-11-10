import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ user: vi.fn(), booking: vi.fn(), trip: vi.fn(), car: vi.fn(), event: vi.fn(), favorite: vi.fn(), payment: vi.fn(), conversation: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ db: {
  user: { findUnique: m.user }, booking: { findMany: m.booking }, tripRequest: { findMany: m.trip },
  carRequest: { findMany: m.car }, eventRequest: { findMany: m.event }, favoriteItem: { findMany: m.favorite },
  payment: { findMany: m.payment }, supportConversation: { findMany: m.conversation },
} }))
import { getCustomerDetail } from '@/lib/server/account/customers'
import { listCustomerBookings } from '@/lib/server/booking/bookings'
import { listCustomerTripRequests } from '@/lib/server/trip-builder/trip-requests'
import { listCustomerCarRequests } from '@/lib/server/cars/car-requests'
import { listCustomerEventRequests } from '@/lib/server/events/event-requests'
import { listCustomerPayments } from '@/lib/server/payments/payments'
import { listFavoriteSlugs } from '@/lib/server/account/favorites'

const date = new Date('2026-11-03T10:00:00Z')
const user = { id: 'owner-a', publicId: 'public-a', email: 'same-as-guest@example.com', firstName: 'Test', lastName: 'Customer', status: 'PENDING', emailVerifiedAt: null, createdAt: date, lastLoginAt: null, roles: [{ role: { key: 'CUSTOMER' } }] }
const booking = { reference: 'BK-A', status: 'PENDING', paymentStatus: 'PENDING', currency: 'USD', total: 280, createdAt: date,
  items: [{ tourSlug: 'cairo', tourTitle: 'Cairo Tour', travelDate: '', adults: 2, children: 0, infants: 0 }],
  payments: [{ reference: 'PAY-A', status: 'PAID', currency: 'USD', amount: 100, amountPaid: 100, amountRefunded: 0, createdAt: date }] }
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue(user)
  for (const query of [m.booking, m.trip, m.car, m.event, m.favorite, m.payment, m.conversation]) query.mockResolvedValue([])
})

it('projects every admin profile table from real owner-filtered rows without changing account ownership', async () => {
  m.booking.mockResolvedValue([booking])
  m.trip.mockResolvedValue([{ reference: 'TR-A', status: 'NEW', customTitle: 'Custom journey', createdAt: date }])
  m.car.mockResolvedValue([{ reference: 'CAR-A', status: 'NEW', vehicleSlug: 'sedan', tripType: 'One Way', createdAt: date }])
  m.event.mockResolvedValue([{ reference: 'EV-A', status: 'NEW', eventTitle: 'Festival', createdAt: date }])
  m.favorite.mockResolvedValue([{ itemType: 'tour', itemSlug: 'cairo', createdAt: date }])
  const detail = await getCustomerDetail('public-a', { includeFinancial: true })
  expect(detail.bookings[0]).toMatchObject({ reference: 'BK-A', items: [{ tourTitle: 'Cairo Tour', guests: 2 }] })
  expect(detail.tripRequests[0]).toMatchObject({ reference: 'TR-A', title: 'Custom journey' })
  expect(detail.carRequests[0]).toMatchObject({ reference: 'CAR-A', vehicleSlug: 'sedan' })
  expect(detail.eventRequests[0]).toMatchObject({ reference: 'EV-A', title: 'Festival' })
  expect(detail.payments[0]).toMatchObject({ reference: 'PAY-A', bookingReference: 'BK-A', amountPaid: 100 })
  expect(detail.favorites[0]).toMatchObject({ itemSlug: 'cairo' })
  for (const query of [m.booking, m.trip, m.car, m.event, m.favorite]) expect(query.mock.calls[0][0].where).toEqual({ userId: 'owner-a' })
})
it('does not infer ownership from a pending account email or report a payment without financial permission', async () => {
  const detail = await getCustomerDetail('public-a')
  expect(detail.bookings).toEqual([])
  expect(detail.payments).toEqual([])
  expect(detail.collectedValue).toBeNull()
  expect(m.booking.mock.calls[0][0].select.payments).toBe(false)
  expect(JSON.stringify(m.booking.mock.calls[0][0].where)).not.toContain(user.email)
})
const cases = [
  { name: 'bookings', list: listCustomerBookings, query: m.booking, where: (id: string) => ({ userId: id }) },
  { name: 'trip requests', list: listCustomerTripRequests, query: m.trip, where: (id: string) => ({ userId: id }) },
  { name: 'car requests', list: listCustomerCarRequests, query: m.car, where: (id: string) => ({ userId: id }) },
  { name: 'event requests', list: listCustomerEventRequests, query: m.event, where: (id: string) => ({ userId: id }) },
  { name: 'payments', list: listCustomerPayments, query: m.payment, where: (id: string) => ({ booking: { userId: id } }) },
  { name: 'favorites', list: listFavoriteSlugs, query: m.favorite, where: (id: string) => ({ userId: id }) },
]
it.each(cases)('$name uses only the requested owner FK when switching between customer identities', async ({ list, query, where }) => {
  await list('owner-a')
  await list('owner-b')
  expect(query.mock.calls[0][0].where).toEqual(where('owner-a'))
  expect(query.mock.calls[1][0].where).toEqual(where('owner-b'))
})
