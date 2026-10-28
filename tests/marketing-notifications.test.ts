import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ offers: vi.fn(), tours: vi.fn(), receipts: new Map<string, any>(), reads: vi.fn(), writes: vi.fn(), user: 'customer-a' as string | null, writable: true, origin: true, personal: vi.fn(), personalCount: vi.fn(), personalRead: vi.fn(), personalAll: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ db: {
  offer: { findMany: m.offers }, tour: { findMany: m.tours },
  notification: {
    findMany: async ({ where }: any) => { m.reads(where); return [...m.receipts.values()].filter(row => row.userId === where.userId && row.type === where.type && where.id.in.includes(row.id)) },
    upsert: async ({ where, create, update }: any) => { m.writes(create); const row = m.receipts.get(where.id) ?? create; Object.assign(row, update); m.receipts.set(where.id, row); return row },
  },
} }))
vi.mock('@/lib/server/catalogue-translations', () => ({ attachCatalogueTranslations: async (_kind: string, rows: any[]) => rows }))
vi.mock('@/lib/server/staff-preview', () => ({ getAccountReadUser: async () => m.user ? { id: m.user } : null, getAccountWriteUser: async () => m.user && m.writable ? { id: m.user } : null }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => m.origin }))
vi.mock('@/lib/server/notifications', () => ({ listNotifications: m.personal, countUnreadNotifications: m.personalCount, markNotificationRead: m.personalRead, markAllNotificationsRead: m.personalAll }))
import { buildMarketingFeed, listMarketingNotifications, marketingForUser, markMarketingRead } from '@/lib/server/marketing-notifications'
import { GET as publicFeed } from '@/app/api/marketing-notifications/route'
import { GET as accountFeed, PATCH } from '@/app/api/account/notifications/route'
import { localizedNotification, MARKETING_READ_TYPE } from '@/lib/marketing-notifications'
type Offer = Parameters<typeof buildMarketingFeed>[0][number]
type Tour = Parameters<typeof buildMarketingFeed>[1][number]
const now = Date.parse('2026-10-28T12:00:00Z')
const offer = (extra: Partial<Offer> = {}): Offer => ({ id: 'offer-id', slug: 'oasis-offer', title: 'Oasis offer', copy: 'A real offer', badge: 'Save 10%', content: '{}', isPublished: true, startsAt: null, deadline: '2099-12-31', discountPercent: null, tourSlug: null, updatedAt: new Date('2026-10-27T12:00:00Z'), tour: null, ...extra })
const tour = (extra: Partial<Tour> = {}): Tour => ({ id: 'tour-id', slug: 'published-tour', title: 'Published tour', summary: 'A real trip', status: 'published', deal: JSON.stringify({ percent: 15, endsAt: '2099-12-31' }), detail: null, dayDetail: null, category: 'one-day-tours', updatedAt: new Date('2026-10-26T12:00:00Z'), ...extra })
const patch = (body: unknown) => PATCH(new Request('https://example.test/api/account/notifications', { method: 'PATCH', body: JSON.stringify(body) }))
beforeEach(() => {
  vi.clearAllMocks(); m.receipts.clear(); m.user = 'customer-a'; m.writable = true; m.origin = true
  m.offers.mockResolvedValue([offer()]); m.tours.mockResolvedValue([])
  m.personal.mockResolvedValue([{ id: 'booking-event', type: 'booking_created', title: 'Real booking', message: 'Booking received', href: '/account/bookings', createdAt: '2026-10-01T12:00:00.000Z', readAt: null }]); m.personalCount.mockResolvedValue(1); m.personalRead.mockResolvedValue(false)
})

describe('real published marketing source projection', () => {
  it('includes current campaigns and manual tour offers with real timestamps and canonical targets', () => {
    const rows = buildMarketingFeed([offer()], [tour()], now)
    expect(rows.map(row => row.href)).toEqual(['/special-offers/oasis-offer', '/egypt-tours/published-tour'])
    expect(rows[0].createdAt).toBe('2026-10-27T12:00:00.000Z')
    expect(rows[1].title).toBe('15% — Published tour')
    expect(rows[0].expiresAt).toBe('2099-12-31T23:59:59.999Z')
  })
  it.each([{ isPublished: false }, { startsAt: new Date('2099-01-01') }, { deadline: '2026-10-27' }, { deadline: 'bad' }, { deadline: '2026-02-31' }])('excludes draft/future/expired/invalid offers %j', extra => {
    expect(buildMarketingFeed([offer(extra)], [], now)).toEqual([])
  })
  it('excludes informational promotional bars, but includes genuine linked-tour discounts', () => {
    const content = JSON.stringify({ campaign: { placements: ['top-bar', 'footer-promo'] } })
    expect(buildMarketingFeed([offer({ content })], [], now)).toEqual([])
    expect(buildMarketingFeed([offer({ content, tourSlug: 'live', tour: { slug: 'live', status: 'published' }, discountPercent: 20 })], [], now)).toHaveLength(1)
  })
  it('requires published existing linked tours, deduplicates their manual offer, and respects linked expiry', () => {
    for (const linked of [null, { slug: 'published-tour', status: 'draft' }]) expect(buildMarketingFeed([offer({ tourSlug: 'published-tour', tour: linked })], [], now)).toEqual([])
    const linked = offer({ tourSlug: 'published-tour', tour: { slug: 'published-tour', status: 'published' }, discountPercent: 20 })
    expect(buildMarketingFeed([linked], [tour()], now)).toHaveLength(1)
    const rows = buildMarketingFeed([offer({ ...linked, deadline: '2026-10-27' })], [tour()], now)
    expect(rows.map(row => row.type)).toEqual(['tour_offer_available'])
  })
  it.each([{ status: 'draft' }, { deal: null }, { deal: '{}' }, { deal: '{broken' }, { deal: '{"percent":100}' }, { deal: '{"percent":-5}' }, { deal: '{"percent":10,"endsAt":"bad"}' }, { deal: '{"percent":10,"endsAt":"2026-10-01"}' }])('never fabricates a manual tour discount %j', extra => {
    expect(buildMarketingFeed([], [tour(extra)], now)).toEqual([])
  })
  it('keeps stable identities across locales/minor unrelated edits and renews meaningful revised offers', () => {
    const original = buildMarketingFeed([offer()], [], now)[0]
    expect(buildMarketingFeed([offer({ updatedAt: new Date() })], [], now)[0].id).toBe(original.id)
    expect(buildMarketingFeed([offer({ badge: 'Save 20%' })], [], now)[0].id).not.toBe(original.id)
    const localized = buildMarketingFeed([offer({ translations: { es: { title: 'Oferta real', copy: 'Descripción', badge: 'Ahorra 10%' } } })], [], now)[0]
    expect(localizedNotification(localized, 'es')).toMatchObject({ title: 'Oferta real', message: 'Ahorra 10% · Descripción', id: localized.id })
    expect(localizedNotification(localized, 'it').title).toBe('Oasis offer')
  })
  it('reads published source selections without copying raw private records or writing on GET', async () => {
    await listMarketingNotifications()
    expect(m.offers).toHaveBeenCalledWith(expect.objectContaining({ where: { isPublished: true } }))
    expect(m.tours).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'published', deal: { not: null } } }))
    const response = await publicFeed()
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const body = await response.json()
    expect(body.notifications[0]).not.toHaveProperty('content')
    expect(body.notifications[0]).not.toHaveProperty('tour')
    expect(m.writes).not.toHaveBeenCalled()
    m.offers.mockRejectedValueOnce(Error('Database unavailable'))
    expect((await publicFeed()).status).toBe(503)
  })
})

describe('customer offer inbox and owner-scoped read receipts', () => {
  it('merges real account updates and offers; listing does not write customer records', async () => {
    const response = await accountFeed(), body = await response.json()
    expect(body.notifications.map((row: any) => row.type)).toEqual(['offer_available', 'booking_created'])
    expect(body.unreadCount).toBe(2)
    expect(m.writes).not.toHaveBeenCalled()
  })
  it('persists independent per-account read status and idempotency without bulk recipient writes', async () => {
    const source = buildMarketingFeed([offer()], [], now)
    await markMarketingRead('customer-a', source)
    expect((await marketingForUser('customer-a', source))[0].readAt).not.toBeNull()
    expect((await marketingForUser('customer-b', source))[0].readAt).toBeNull()
    const timestamp = [...m.receipts.values()][0].readAt
    await markMarketingRead('customer-a', source)
    expect(m.receipts.size).toBe(1)
    expect([...m.receipts.values()][0].readAt).toEqual(timestamp)
    expect([...m.receipts.values()][0]).toMatchObject({ userId: 'customer-a', type: MARKETING_READ_TYPE })
    expect(m.reads).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'customer-b' }))
  })
  it('marks an active offer read through the existing authenticated PATCH and synchronizes count', async () => {
    const item = (await listMarketingNotifications())[0]
    expect((await patch({ action: 'read', id: item.id })).status).toBe(200)
    expect((await (await accountFeed()).json()).unreadCount).toBe(1)
    expect(m.personalRead).not.toHaveBeenCalled()
    m.user = 'customer-b'
    expect((await (await accountFeed()).json()).unreadCount).toBe(2)
  })
  it('offer-only read all preserves booking/payment unread state; account read all includes both', async () => {
    expect((await patch({ action: 'read-offers' })).status).toBe(200)
    expect(m.personalAll).not.toHaveBeenCalled()
    expect((await patch({ action: 'read-all' })).status).toBe(200)
    expect(m.personalAll).toHaveBeenCalledWith('customer-a')
  })
  it('removes expired/unpublished/deleted offers even if a read receipt exists', async () => {
    const item = (await listMarketingNotifications())[0]
    await patch({ action: 'read', id: item.id })
    m.offers.mockResolvedValue([])
    const body = await (await accountFeed()).json()
    expect(body.notifications.map((row: any) => row.id)).toEqual(['booking-event'])
    expect((await patch({ action: 'read', id: item.id })).status).toBe(404)
  })
  it('keeps booking/payment reads and mutations available when the marketing source fails', async () => {
    m.offers.mockRejectedValue(Error('Marketing unavailable'))
    const response = await accountFeed(), body = await response.json()
    expect(response.status).toBe(200)
    expect(body.notifications.map((row: any) => row.id)).toEqual(['booking-event'])
    expect(body.unreadCount).toBe(1)
    expect(body.marketingUnavailable).toBe(true)
    m.personalRead.mockResolvedValue(true)
    const read = await patch({ action: 'read', id: 'booking-event' })
    expect(read.status).toBe(200)
    expect(m.personalRead).toHaveBeenCalledWith('customer-a', 'booking-event')
    expect((await patch({ action: 'read-all' })).status).toBe(200)
    expect(m.personalAll).toHaveBeenCalledWith('customer-a')
    expect((await patch({ action: 'read-offers' })).status).toBe(503)
    expect(m.writes).not.toHaveBeenCalled()
  })
  it('rejects guests, cross-origin mutations, staff-preview writes, forged and stale targets', async () => {
    m.user = null; expect((await accountFeed()).status).toBe(401); expect((await patch({ action: 'read-offers' })).status).toBe(401)
    m.user = 'customer-a'; m.origin = false; expect((await patch({ action: 'read-all' })).status).toBe(403)
    m.origin = true; m.writable = false; expect((await patch({ action: 'read-all' })).status).toBe(401)
    m.writable = true
    expect((await patch({ action: 'read', id: 'marketing:offer:' + 'a'.repeat(32) })).status).toBe(404)
    expect((await patch({ action: 'read', id: 'another-customer-personal-id' })).status).toBe(404)
    expect(m.personalRead).toHaveBeenCalledWith('customer-a', 'another-customer-personal-id')
    expect(m.writes).not.toHaveBeenCalled()
  })
})
