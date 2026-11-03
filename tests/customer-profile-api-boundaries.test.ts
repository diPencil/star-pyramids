import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ read: vi.fn(), bookings: vi.fn(), trips: vi.fn(), cars: vi.fn(), events: vi.fn(), payments: vi.fn(), favorites: vi.fn() }))
vi.mock('@/lib/server/staff-preview', () => ({ getAccountReadUser: m.read, getAccountWriteUser: vi.fn() }))
vi.mock('@/lib/server/bookings', () => ({ listCustomerBookings: m.bookings }))
vi.mock('@/lib/server/trip-requests', () => ({ listCustomerTripRequests: m.trips }))
vi.mock('@/lib/server/car-requests', () => ({ listCustomerCarRequests: m.cars }))
vi.mock('@/lib/server/event-requests', () => ({ listCustomerEventRequests: m.events }))
vi.mock('@/lib/server/payments', () => ({ listCustomerPayments: m.payments, initiateCustomerPayment: vi.fn(), validatePaymentInitiation: vi.fn() }))
vi.mock('@/lib/server/favorites', () => ({ listFavoriteSlugs: m.favorites, addFavorite: vi.fn(), removeFavorite: vi.fn(), validateFavorite: vi.fn() }))
import { GET as bookings } from '@/app/api/account/bookings/route'
import { GET as trips } from '@/app/api/account/trip-requests/route'
import { GET as cars } from '@/app/api/account/car-requests/route'
import { GET as events } from '@/app/api/account/event-requests/route'
import { GET as payments } from '@/app/api/account/payments/route'
import { GET as favorites } from '@/app/api/account/favorites/route'
const cases = [
  { name: 'bookings', get: bookings, service: m.bookings, key: 'bookings' },
  { name: 'trip requests', get: trips, service: m.trips, key: 'requests' },
  { name: 'car requests', get: cars, service: m.cars, key: 'requests' },
  { name: 'event requests', get: events, service: m.events, key: 'requests' },
  { name: 'payments', get: payments, service: m.payments, key: 'payments' },
  { name: 'favorites', get: favorites, service: m.favorites, key: 'favorites' },
]
beforeEach(() => vi.resetAllMocks())
it.each(cases)('$name rejects a visitor without an authenticated/verified preview context', async ({ get, service }) => {
  m.read.mockResolvedValue(null)
  const response = await get()
  expect(response.status).toBe(401)
  expect(service).not.toHaveBeenCalled()
})
it.each(cases)('$name passes only the account read identity, including the verified staff preview target', async ({ get, service, key }) => {
  m.read.mockResolvedValue({ id: 'preview-customer', email: 'not-an-ownership-key@example.com' })
  service.mockResolvedValue(['safe-result'])
  const response = await get()
  expect(response.status).toBe(200)
  expect(service).toHaveBeenCalledExactlyOnceWith('preview-customer')
  expect(await response.json()).toEqual({ [key]: ['safe-result'] })
})
