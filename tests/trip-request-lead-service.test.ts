import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ create: vi.fn(), notifyUser: vi.fn(), notifyStaff: vi.fn(), email: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ db: { tripRequest: { create: mocks.create } } }))
vi.mock('@/lib/server/notifications/notifications', () => ({ notifyUser: mocks.notifyUser, notifyStaff: mocks.notifyStaff }))
vi.mock('@/lib/server/email/email', () => ({ sendCustomerEmailSafe: mocks.email, sendStaffEmailSafe: mocks.email }))
vi.mock('@/lib/server/editorial/blogs', () => ({ findBlogBySlug: vi.fn() }))
vi.mock('@/lib/server/catalogue/destinations', () => ({ findDestinationBySlug: vi.fn() }))
vi.mock('@/lib/server/catalogue/tours', () => ({ findTourBySlug: vi.fn() }))
import { createTripRequestRecord } from '@/lib/server/trip-builder/trip-requests'
import { tripRequestMeasurement } from '@/lib/server/tracking/leads/trip-request-measurement'

const draft = {
  contactName: 'Fixture Visitor', contactEmail: 'visitor@example.test', contactPhone: '2025550123', dialCode: '+1',
  nationality: 'US', destinationSlug: 'cairo', tourSlug: '', customTitle: '', requestedAddOns: [],
  timeMode: 'unsure', preferredFrom: '', preferredTo: '', adults: 2, children: 0, infants: 0,
  budgetMin: 1000, budgetMax: 3000, currency: 'USD', flightOffer: false, notes: 'private fixture',
} as Parameters<typeof createTripRequestRecord>[1]

beforeEach(() => {
  vi.resetAllMocks()
  mocks.create.mockImplementation(async ({ data }) => ({
    ...data, id: 'opaque-persisted-id', preferredFrom: null, preferredTo: null, activities: [], user: null,
    createdAt: new Date('2026-11-08T00:00:00Z'), updatedAt: new Date('2026-11-08T00:00:00Z'),
  }))
})

it.each([null, 'customer-fixture-id'])('adds only an opaque creation receipt after persistence for owner %s', async owner => {
  const result = await createTripRequestRecord(owner, draft)
  expect(mocks.create).toHaveBeenCalledOnce()
  expect(mocks.create.mock.calls[0][0].data.userId).toBe(owner)
  expect(result.tripRequestMeasurement).toEqual(tripRequestMeasurement('opaque-persisted-id'))
  expect(Object.keys(result.tripRequestMeasurement).sort()).toEqual(['event', 'event_id'])
  const event = JSON.stringify(result.tripRequestMeasurement)
  for (const privateValue of [result.reference, draft.contactName, draft.contactEmail, draft.contactPhone, draft.notes, 'opaque-persisted-id']) expect(event).not.toContain(privateValue)
})

it('does not acknowledge a failed persistence attempt as a lead', async () => {
  mocks.create.mockRejectedValueOnce(Error('fixture persistence failure'))
  await expect(createTripRequestRecord(null, draft)).rejects.toThrow('fixture persistence failure')
  expect(mocks.notifyStaff).not.toHaveBeenCalled()
})
