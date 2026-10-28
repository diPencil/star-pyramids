import { beforeEach, expect, it, vi } from 'vitest'
import type { Tour } from '@/data/types'
import { getBookingTotal } from '@/data/tours'
import { buildTripPreview, cleanTravelerPriceRows, previewAmount, previewCount, previewTextKey, quoteTripPreview, type TripBuilderDraft } from '@/lib/trip-builder-preview'

const source: Tour = { slug: 'saved', title: 'Saved title', category: 'multi-days-tours', location: 'Saved location', duration: 'Saved duration', price: 999, image: '/old.jpg', gallery: ['/old.jpg'], summary: 'Saved summary', detail: { overview: ['Saved overview'], highlights: [], itinerary: [], locations: [], travelerPrices: [{ travelers: 1, adultPrice: 999 }] } }
export function draft(): TripBuilderDraft {
  return {
    routeSlug: 'unsaved-route', form: { title: 'Current title', titleAr: '', category: 'multi-days-tours', destinationSlug: '', cruiseType: '', departurePort: '', location: 'Current location', duration: '3 days', price: '100', deal: '', dealEndsAt: '', groupSize: 'Private', travelStyle: 'Classic', summary: 'Current summary', overview: 'Current overview\nSecond paragraph', itineraryNote: 'Current note', included: 'Guide\nTransport', excluded: 'Tips' },
    catSlugs: ['classic'], addOns: [{ id: 'addon', title: 'Extra visit', price: '20' }], highlightImage: '/highlight.jpg', highlights: [{ id: 'highlight', title: 'Current highlight', items: 'Pyramids\nNile' }], itinerary: [{ id: 'day', day: 'Day 1', title: 'Current day', description: 'Current description', meals: 'Lunch', image: '/day.jpg' }],
    travelerPrices: { adult: [{ id: 'a1', travelers: '1', price: '100' }, { id: 'a2', travelers: '2', price: '80' }], child: [{ id: 'c', travelers: '1', price: '30' }], infant: [{ id: 'i', travelers: '1', price: '0' }] },
    priceRows: [{ id: 'date', category: 'Summer', startDate: '2027-01-01', endDate: '2027-01-31', price: '', note: 'Informational', prefix: '', tiers: [{ id: 'tier', label: 'Deluxe', price: '150', suffix: 'per person' }] }],
    locations: [{ id: 'loc', name: 'Current stop', nameAr: '', latitude: '30', longitude: '31' }], gallery: [{ id: 'photo', src: '/current.jpg', alt: 'Current image', creditLabel: 'Actual source', creditUrl: 'https://example.com/photo', source: 'link' }], videos: [{ id: 'video', url: 'https://example.com/clip.mp4', platform: 'direct', title: 'Current video', titleAr: '', publishedAt: '', thumbnail: '/poster.jpg' }],
  }
}
it('builds existing previews exclusively from current editable fields without mutating source/draft', () => {
  const state = draft(), old = JSON.stringify(source), original = JSON.stringify(state)
  const preview = buildTripPreview(source, state, 'en')
  expect(preview.tour).toMatchObject({ title: 'Current title', slug: 'unsaved-route', image: '/current.jpg', price: 100, summary: 'Current summary', duration: '3 days' })
  expect(preview.tour.detail).toMatchObject({ overview: ['Current overview', 'Second paragraph'], itinerary: [{ title: 'Current day' }], included: ['Guide', 'Transport'], excluded: ['Tips'], addOns: [{ title: 'Extra visit' }], highlights: [{ title: 'Current highlight' }] })
  expect(JSON.stringify(preview.tour)).not.toContain('Saved'); expect(JSON.stringify(source)).toBe(old); expect(JSON.stringify(state)).toBe(original)
})
it('does not restore intentionally cleared text, gallery or sections', () => {
  const state = draft(); state.form.title = ''; state.form.summary = ''; state.form.overview = ''; state.gallery = []; state.highlights = []; state.itinerary = []; state.locations = []; state.form.included = ''; state.form.excluded = ''
  const preview = buildTripPreview(source, state, 'en')
  expect(preview.tour.title).toBe(''); expect(preview.tour.summary).toBe(''); expect(preview.tour.image).toBe(''); expect(preview.tour.gallery).toEqual([])
  expect(preview.tour.detail).toMatchObject({ overview: [], highlights: [], itinerary: [], locations: [], included: [], excluded: [] })
})
it('handles a category change without old inactive-category pricing overriding it', () => {
  const state = draft(); state.form.category = 'one-day-tours'
  const preview = buildTripPreview(source, state, 'en')
  expect(preview.tour.detail).toBeUndefined(); expect(preview.tour.dayDetail?.stops?.[0].title).toBe('Current day')
  expect(quoteTripPreview(preview, { adult: 2, child: 0, infant: 0 })).toMatchObject({ kind: 'quote', total: 160 })
})
it('keeps captions aligned after a blank image source is removed from rendering', () => {
  const state = draft(); state.gallery.unshift({ ...state.gallery[0], id: 'empty', src: '', alt: 'Wrong caption' })
  const preview = buildTripPreview(source, state, 'en')
  expect(preview.tour.gallery).toEqual(['/current.jpg']); expect(preview.tour.galleryCaptions?.[0].en).toBe('Current image')
})
it.each(['es', 'it'] as const)('uses current %s translations and current English fallback, never saved English', locale => {
  const state = draft(); state.form.translations = { [locale]: { title: `${locale} current title`, overview: `${locale} overview` } }; state.itinerary[0].translations = { [locale]: { title: `${locale} current day` } }
  const preview = buildTripPreview(source, state, locale)
  expect(preview.tour.title).toBe(`${locale} current title`); expect(preview.tour.detail?.overview).toEqual([`${locale} overview`]); expect(preview.tour.detail?.itinerary[0].title).toBe(`${locale} current day`); expect(preview.tour.location).toBe('Current location')
})
it('honors explicit unsaved empty translations while preserving translation-editor persistence semantics', () => {
  const state = draft(); const cleared = new Set([previewTextKey(state.form, 'title', 'es'), previewTextKey(state.itinerary[0], 'description', 'es')])
  const preview = buildTripPreview(source, state, 'es', cleared)
  expect(preview.tour.title).toBe(''); expect(preview.tour.detail?.itinerary[0].description).toBe(''); expect(preview.tour.location).toBe('Current location')
})
it('distinguishes a legitimate zero price from incomplete/invalid pricing', () => {
  const state = draft(); state.form.price = ''
  expect(previewAmount('')).toBeNull(); expect(previewAmount('0')).toBe(0)
  expect(quoteTripPreview(buildTripPreview(source, state, 'en'), { adult: 2, child: 0, infant: 0 }).kind).toBe('incomplete')
  state.form.price = '0'; state.travelerPrices.adult.forEach(row => { row.price = '0' })
  expect(quoteTripPreview(buildTripPreview(source, state, 'en'), { adult: 2, child: 0, infant: 0 })).toMatchObject({ kind: 'quote', total: 0 })
})
it.each(['adult', 'child', 'infant'] as const)('marks deleted %s rates incomplete instead of silently substituting base rates', type => {
  const state = draft(); state.travelerPrices[type] = []
  expect(quoteTripPreview(buildTripPreview(source, state, 'en'), { adult: 2, child: 1, infant: 1 }).kind).toBe('incomplete')
})
it('uses independent traveler rates and total headcount including infants with nearest-tier semantics', () => {
  const state = draft(); state.travelerPrices.adult.push({ id: 'a3', travelers: '3', price: '70' })
  const preview = buildTripPreview(source, state, 'en')
  expect(quoteTripPreview(preview, { adult: 2, child: 0, infant: 1 })).toMatchObject({ kind: 'quote', adult: 70, infant: 0, total: 140, headcount: 3, currency: 'USD' })
  expect(quoteTripPreview(preview, { adult: 2, child: 1, infant: 1 })).toMatchObject({ kind: 'quote', adult: 70, child: 30, total: 170 })
})
it('reflects unsaved tier edits and matches server integer-cents accumulation', () => {
  const state = draft(); state.travelerPrices.adult[1].price = '1.005'
  const preview = buildTripPreview(source, state, 'en'), quote = quoteTripPreview(preview, { adult: 3, child: 0, infant: 0 })
  const units = getBookingTotal(preview.tour, 3, 0, 0)
  expect(quote).toMatchObject({ kind: 'quote', total: Math.round(units.adult * 100) * 3 / 100 })
})
it('applies unsaved manual discounts but respects active linked offers explicitly', () => {
  const state = draft(); state.form.deal = '10'; state.form.dealEndsAt = '2099-12-31'
  expect(quoteTripPreview(buildTripPreview(source, state, 'en'), { adult: 2, child: 0, infant: 0 })).toMatchObject({ total: 144 })
  const preview = buildTripPreview({ ...source, pricingDealSource: 'linked-offer', deal: { percent: 25, endsAt: '2099-12-31' } }, state, 'en')
  expect(preview.linkedOffer).toBe(true); expect(quoteTripPreview(preview, { adult: 2, child: 0, infant: 0 })).toMatchObject({ total: 120 })
})
it.each([{ adult: 0, child: 0, infant: 0 }, { adult: 51, child: 0, infant: 0 }, { adult: 30, child: 30, infant: 1 }, { adult: 1.5, child: 0, infant: 0 }, { adult: 2, child: -1, infant: 0 }])('rejects counts outside booking bounds: %j', counts => expect(quoteTripPreview(buildTripPreview(source, draft(), 'en'), counts).kind).toBe('invalid-count'))
it('clamps controls without allowing fractions and never turns a blank rate into a free rate', () => {
  expect(previewCount('999', 1)).toBe(50); expect(previewCount('1.9', 1)).toBe(1); expect(previewCount('', 1)).toBe(1)
  const values = draft().travelerPrices; values.adult[0].price = ''
  expect(cleanTravelerPriceRows(values).find(row => row.travelers === 1)?.adultPrice).toBeUndefined()
})
