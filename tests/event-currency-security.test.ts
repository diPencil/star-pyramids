import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  allowed: false,
  event: { findUnique: vi.fn(), findMany: vi.fn() },
  eventRequest: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  lock: vi.fn(),
}))
vi.mock('@/lib/server/db', () => {
  const db = { event: mocks.event, eventRequest: mocks.eventRequest, $queryRaw: mocks.lock }
  return { db: { ...db, $transaction: async (fn: (tx: typeof db) => Promise<unknown>) => fn(db) } }
})
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => mocks.user, hasPermission: () => mocks.allowed }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => true }))
vi.mock('@/lib/server/rate-limit', () => ({ checkEventRequestRateLimit: async () => ({ allowed: true }), recordEventRequestAttempt: vi.fn() }))
vi.mock('@/lib/server/notifications', () => ({ notifyUser: vi.fn(), notifyStaff: vi.fn() }))
vi.mock('@/lib/server/email', () => ({ sendCustomerEmailSafe: vi.fn(), sendStaffEmailSafe: vi.fn() }))
vi.mock('@/lib/server/catalogue-translations', () => ({ catalogueTranslationResponse: async (_kind: unknown, value: unknown) => value }))
import { GET as list } from '@/app/api/events/route'
import { GET as detail } from '@/app/api/events/[slug]/route'
import { POST as submit } from '@/app/api/event-requests/route'
import { cancelCustomerEventRequest, createEventRequestRecord, transitionStaffEventRequest, validateEventDraft, type ValidatedEventDraft } from '@/lib/server/event-requests'

const event = { slug: 'festival', title: 'Canonical festival', date: 'Canonical date', location: 'Cairo', isPublished: true }
const draft: ValidatedEventDraft = { eventSlug: event.slug, eventTitle: 'Forged title', eventDate: 'Forged date', eventLocation: 'Forged location', attendees: 2, note: '', contactName: 'Test Guest', contactEmail: 'guest@example.com', contactPhone: '1234567890', dialCode: '+20', nationality: 'EG' }
const context = { params: Promise.resolve({ slug: event.slug }) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.user = null
  mocks.allowed = false
  mocks.event.findUnique.mockResolvedValue(event)
  mocks.event.findMany.mockResolvedValue([event])
  mocks.eventRequest.create.mockImplementation(async ({ data }) => ({ ...data, activities: [], user: null, createdAt: new Date(), updatedAt: new Date() }))
})

describe('event public visibility and request integrity', () => {
  it('filters anonymous lists to published events', async () => {
    await list()
    expect(mocks.event.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isPublished: true } }))
  })
  it('does not grant unpublished access merely for being signed in', async () => {
    mocks.user = { id: 'customer' }
    mocks.event.findUnique.mockResolvedValue({ ...event, isPublished: false })
    expect((await detail(new Request('http://localhost/api/events/festival'), context)).status).toBe(404)
  })
  it('permits authorized event staff to inspect unpublished records', async () => {
    mocks.user = { id: 'staff' }; mocks.allowed = true
    mocks.event.findUnique.mockResolvedValue({ ...event, isPublished: false })
    expect((await detail(new Request('http://localhost/api/events/festival'), context)).status).toBe(200)
    await list()
    expect(mocks.event.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })
  it.each([null, { ...event, isPublished: false }])('rejects missing or unpublished request targets', async row => {
    mocks.event.findUnique.mockResolvedValue(row)
    await expect(createEventRequestRecord(null, draft)).rejects.toThrow('available event')
    expect(mocks.eventRequest.create).not.toHaveBeenCalled()
  })
  it('locks and snapshots the canonical event instead of browser-supplied descriptions', async () => {
    const created = await createEventRequestRecord('owner', draft)
    expect(created).toMatchObject({ eventTitle: event.title, eventDate: event.date, eventLocation: event.location })
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.event.findUnique.mock.invocationCallOrder[0])
    expect(mocks.eventRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'owner', status: 'NEW' }) }))
  })
  it('fits canonical event titles into the existing request snapshot column', async () => {
    mocks.event.findUnique.mockResolvedValue({ ...event, title: 'A'.repeat(200) })
    expect((await createEventRequestRecord(null, draft)).eventTitle).toBe('A'.repeat(160))
  })
  it.each(['price', 'currency', 'userId', 'status'])('rejects mass assignment of %s', key => {
    expect(() => validateEventDraft({ [key]: 'forged' })).toThrow('Invalid request')
  })
  it('blocks cancellation after a concurrent staff decision', async () => {
    mocks.eventRequest.findUnique.mockResolvedValueOnce({ id: 'request', userId: 'owner', status: 'NEW' }).mockResolvedValueOnce({ id: 'request', userId: 'owner', status: 'APPROVED' })
    await expect(cancelCustomerEventRequest('owner', 'SP-ER-ABCDEF')).rejects.toThrow('changed')
    expect(mocks.eventRequest.update).not.toHaveBeenCalled()
  })
  it('blocks a staff decision after a concurrent cancellation', async () => {
    mocks.eventRequest.findUnique.mockResolvedValueOnce({ id: 'request', userId: 'owner', status: 'REVIEWING' }).mockResolvedValueOnce({ id: 'request', userId: 'owner', status: 'CANCELLED' })
    await expect(transitionStaffEventRequest('SP-ER-ABCDEF', 'approved', '', false)).rejects.toThrow('changed')
    expect(mocks.eventRequest.update).not.toHaveBeenCalled()
  })
  it('does not expose database diagnostics through public submission errors', async () => {
    mocks.event.findUnique.mockRejectedValue(new Error('SELECT private_table: database-password-secret'))
    const response = await submit(new Request('http://localhost/api/event-requests', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        eventSlug: event.slug, eventTitle: event.title, eventDate: event.date, eventLocation: event.location,
        attendees: 2, note: '', name: 'Test Guest', email: 'guest@example.com', phone: '1234567890', dialCode: '+20', nationality: 'EG',
      }),
    }))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'This request could not be completed. Please try again.' })
  })
})
