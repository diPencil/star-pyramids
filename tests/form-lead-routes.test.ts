import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ user: vi.fn(), car: vi.fn(), event: vi.fn(), limit: vi.fn(), attempt: vi.fn() }))
vi.mock('@/lib/server/auth/auth', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/lib/server/rate-limit', () => ({ checkCarRequestRateLimit: mocks.limit, checkEventRequestRateLimit: mocks.limit,
  recordCarRequestAttempt: mocks.attempt, recordEventRequestAttempt: mocks.attempt }))
vi.mock('@/lib/server/cars/car-requests', () => ({ createCarRequestRecord: mocks.car, validateCarDraft: vi.fn(async body => body) }))
vi.mock('@/lib/server/events/event-requests', () => ({ createEventRequestRecord: mocks.event, validateEventDraft: vi.fn(async body => body), EventRequestInputError: class extends Error {} }))
import { POST as car } from '@/app/api/car-requests/route'
import { POST as event } from '@/app/api/event-requests/route'
import { formLeadMeasurement } from '@/lib/server/tracking/leads/form-lead-measurement'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.limit.mockResolvedValue({ allowed: true })
  mocks.attempt.mockResolvedValue(undefined)
  mocks.user.mockResolvedValue(null)
  mocks.car.mockResolvedValue({ reference: 'SP-CR-PRIVATE', contact: { email: 'private@example.test' } })
  mocks.event.mockResolvedValue({ reference: 'SP-ER-PRIVATE', contact: { email: 'private@example.test' } })
})
function request(route: string, origin = 'https://starpyramids.com') {
  return new Request(`https://starpyramids.com/api/${route}`, { method: 'POST', headers: { origin, host: 'starpyramids.com', 'content-type': 'application/json' },
    body: JSON.stringify({ contactEmail: 'private@example.test', eventSlug: 'public-event' }) })
}

it.each(['guest', 'customer'] as const)('returns stable, projected lead receipts only after %s persistence', async identity => {
  if (identity === 'customer') mocks.user.mockResolvedValue({ id: 'fixture-owner', roles: ['CUSTOMER'] })
  for (const [name, endpoint, create, eventName, reference] of [
    ['car-requests', car, mocks.car, 'car_request_created', 'SP-CR-PRIVATE'],
    ['event-requests', event, mocks.event, 'event_request_created', 'SP-ER-PRIVATE'],
  ] as const) {
    const response = await endpoint(request(name))
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.leadMeasurement).toEqual(formLeadMeasurement(eventName, reference))
    expect(JSON.stringify(body.leadMeasurement)).not.toMatch(/PRIVATE|email|contact|purchase/)
    expect(create).toHaveBeenCalledWith(identity === 'customer' ? 'fixture-owner' : null, expect.anything())
  }
})

it('does not produce measurement receipts before persistence or on access/rate/persistence failures', async () => {
  for (const [name, endpoint, create] of [['car-requests', car, mocks.car], ['event-requests', event, mocks.event]] as const) {
    const forbidden = await endpoint(request(name, 'https://evil.example'))
    expect(forbidden.status).toBe(403)
    expect((await forbidden.json()).leadMeasurement).toBeUndefined()
    expect(create).not.toHaveBeenCalled()
    mocks.limit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 30 })
    const limited = await endpoint(request(name))
    expect(limited.status).toBe(429)
    expect((await limited.json()).leadMeasurement).toBeUndefined()
    create.mockRejectedValueOnce(Error('fixture persistence failed'))
    const failed = await endpoint(request(name))
    expect(failed.status).toBeGreaterThanOrEqual(400)
    expect((await failed.json()).leadMeasurement).toBeUndefined()
  }
})
