import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}))
vi.mock('@/lib/server/db', () => ({ db: { event: mocks.event } }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: vi.fn(async () => ({ id: 'staff' })), hasPermission: () => true }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => true }))
vi.mock('@/lib/server/catalogue-translations', () => ({
  catalogueTranslationResponse: async (_kind: unknown, value: unknown) => value,
  saveWithCatalogueTranslations: async (_kind: unknown, _translations: unknown, _slug: unknown, mutate: (tx: { event: typeof mocks.event }) => Promise<unknown>) => mutate({ event: mocks.event }),
}))
import { POST } from '@/app/api/events/route'
import { PUT } from '@/app/api/events/[slug]/route'
import { eventPriceLabel, sanitizeEvent } from '@/lib/events'
import { formatCurrency } from '@/lib/currency'

const base = { slug: 'festival', title: 'Festival', location: 'Cairo', date: 'Tomorrow', copy: 'Festival details', image: '', pricingType: 'paid' as const, price: 125.5 }
const context = { params: Promise.resolve({ slug: base.slug }) }
const request = (method: string, data: unknown) => new Request('http://localhost/api/events/festival', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.event.findUnique.mockResolvedValue(null)
  mocks.event.create.mockImplementation(async ({ data }) => data)
  mocks.event.update.mockImplementation(async ({ data }) => data)
})

describe('event currency mutations', () => {
  it.each(['USD', 'EUR', 'EGP'])('creates an event with normalized %s without changing its amount', async currency => {
    const response = await POST(request('POST', { ...base, currency: ` ${currency.toLowerCase()} ` }))
    expect(response.status).toBe(201)
    expect((await response.json()).event).toMatchObject({ currency, price: base.price })
  })
  it.each(['GBP', 'USDX', 123, {}, '   '])('rejects unsupported input %j on create and edit before writing', async currency => {
    mocks.event.findUnique.mockResolvedValue({ ...base, currency: 'USD', content: '{}' })
    expect((await POST(request('POST', { ...base, currency }))).status).toBe(400)
    expect((await PUT(request('PUT', { currency }), context)).status).toBe(400)
    expect(mocks.event.create).not.toHaveBeenCalled()
    expect(mocks.event.update).not.toHaveBeenCalled()
  })
  it.each([undefined, null, ''])('creates nullable currency %j without assigning USD', async currency => {
    const response = await POST(request('POST', { ...base, currency }))
    expect(response.status).toBe(201)
    expect((await response.json()).event).toMatchObject({ currency: null, price: base.price })
  })
  it.each([null, 'EUR', 'GBP'])('preserves existing currency %j and amount on an unrelated edit', async currency => {
    mocks.event.findUnique.mockResolvedValue({ ...base, currency, content: '{}' })
    const response = await PUT(request('PUT', { title: 'Updated festival' }), context)
    expect(response.status).toBe(200)
    expect((await response.json()).event).toMatchObject({ currency, price: base.price, title: 'Updated festival' })
  })
  it('updates an explicitly selected currency without converting the amount', async () => {
    mocks.event.findUnique.mockResolvedValue({ ...base, currency: null, content: '{}' })
    const response = await PUT(request('PUT', { currency: ' egp ' }), context)
    expect((await response.json()).event).toMatchObject({ currency: 'EGP', price: base.price })
  })
  it('allows explicitly clearing currency while retaining the amount', async () => {
    mocks.event.findUnique.mockResolvedValue({ ...base, currency: 'EUR', content: '{}' })
    const response = await PUT(request('PUT', { currency: null }), context)
    expect((await response.json()).event).toMatchObject({ currency: null, price: base.price })
  })
  it('preserves null currency on a paid editor round trip with a changed price', async () => {
    mocks.event.findUnique.mockResolvedValue({ ...base, currency: null, content: '{}' })
    const clean = sanitizeEvent({ ...base, currency: undefined, price: 99.95 })
    const response = await PUT(request('PUT', { ...clean, currency: undefined }), context)
    expect(response.status).toBe(200)
    expect((await response.json()).event).toMatchObject({ currency: null, price: 99.95, pricingType: 'paid' })
  })
})

describe('event currency presentation', () => {
  it('keeps unspecified and legacy currencies without relabeling amounts', () => {
    expect(sanitizeEvent({ ...base, currency: null })?.currency).toBeUndefined()
    expect(eventPriceLabel(base, false)).toBe('From 125.50')
    expect(eventPriceLabel({ ...base, currency: 'GBP' }, false)).toBe('From 125.50 GBP')
  })
  it.each(['USD', 'EUR', 'EGP'])('formats %s using the stored currency', currency => {
    expect(eventPriceLabel({ ...base, currency }, false)).toBe(`From ${new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(base.price)}`)
  })
  it.each([
    ['en', 'en-US', 'From'],
    ['es', 'es-ES', 'Desde'],
    ['it', 'it-IT', 'Da'],
  ] as const)('preserves cents and %s localization for paid prices and add-on amounts', (locale, intlLocale, prefix) => {
    for (const currency of ['USD', 'EUR', 'EGP', null]) {
      const expected = new Intl.NumberFormat(intlLocale, {
        ...(currency ? { style: 'currency', currency } : {}),
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(125.75)
      expect(eventPriceLabel({ ...base, price: 125.75, currency: currency ?? undefined }, locale)).toBe(`${prefix} ${expected}`)
      expect(formatCurrency(125.75, currency, locale)).toBe(expected)
    }
  })
})
