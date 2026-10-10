import { describe, expect, it, vi, beforeEach } from 'vitest'
const mocks = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ db: { offer: { findMany: mocks.findMany } } }))
import { isOfferActive, offerDeadline, offerHref } from '@/lib/special-offers'
import { applyLinkedOfferDeals, offerBody, offerError, OfferInputError, presentOffer } from '@/lib/server/special-offers'

beforeEach(() => mocks.findMany.mockResolvedValue([]))
describe('Special Offers lifecycle and pricing', () => {
  it('includes the complete end date and rejects impossible dates', () => {
    expect(isOfferActive({ deadline: '2026-12-31' }, Date.parse('2026-12-31T23:59:59Z'))).toBe(true)
    expect(isOfferActive({ deadline: '2026-12-31' }, Date.parse('2027-01-01T00:00:00Z'))).toBe(false)
    expect(Number.isNaN(offerDeadline('2026-02-30'))).toBe(true)
  })
  it('excludes hidden and scheduled offers', () => {
    expect(isOfferActive({ isPublished: false })).toBe(false)
    expect(isOfferActive({ startsAt: '2099-01-01' })).toBe(false)
  })
  it('routes linked offers to bookable tours and campaigns to their own pages', () => {
    expect(offerHref({ slug: 'sale', tourSlug: 'cairo' })).toBe('/egypt-tours/cairo')
    expect(offerHref({ slug: 'sale' })).toBe('/special-offers/sale')
  })
  it.each(['', 'null', '[]', '{'])('rejects invalid JSON %s with a JSON 400', async body => {
    const error = await offerBody(new Request('http://localhost/api/offers', { method: 'POST', body })).catch(e => e)
    expect(error).toBeInstanceOf(OfferInputError)
    const response = offerError(error)
    expect(response.status).toBe(400)
    expect(await response.json()).toHaveProperty('error')
  })
  it('uses live tour price and images rather than stale snapshots', () => {
    const row = { tourSlug: 'cairo', discountPercent: 15, image: 'old', duration: null, price: 1, originalPrice: 2, content: '{}', tour: { image: 'live', duration: '1 day', price: 125.5, gallery: '["live"]' } }
    expect(presentOffer(row)).toMatchObject({ price: 106.68, originalPrice: 125.5, image: 'live' })
  })
  it('keeps the raw manual deal separate from the active linked discount', async () => {
    mocks.findMany.mockResolvedValue([{ tourSlug: 'cairo', isPublished: true, startsAt: null, deadline: '2099-01-01', discountPercent: 20 }])
    const manual = { percent: 5, endsAt: '2099-01-01' }
    const row = { slug: 'cairo', deal: JSON.stringify(manual) }
    const [resolved] = await applyLinkedOfferDeals([row])
    expect(resolved.deal).toEqual({ percent: 20, endsAt: '2099-01-01' })
    expect(resolved.manualDeal).toEqual(manual)
    expect(row.deal).toBe(JSON.stringify(manual))
  })
  it('restores the manual pricing when a linked offer is hidden or expired', async () => {
    const manual = { percent: 5, endsAt: '2099-01-01' }
    for (const state of [{ isPublished: false, deadline: '2099-01-01' }, { isPublished: true, deadline: '2000-01-01' }]) {
      mocks.findMany.mockResolvedValue([{ tourSlug: 'cairo', discountPercent: 20, ...state }])
      expect((await applyLinkedOfferDeals([{ slug: 'cairo', deal: JSON.stringify(manual) }]))[0].deal).toEqual(manual)
    }
  })
})
