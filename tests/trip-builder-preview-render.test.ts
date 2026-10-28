import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Tour } from '@/data/types'
import { editorData, blankTour } from '@/components/admin/trip-builder'
import { TripBuilderPreview, TripPreviewContent, PreviewDatePrices, PreviewPricing, safePreviewMedia } from '@/components/admin/trip-builder-preview'
import { buildTripPreview, quoteTripPreview, type TripBuilderDraft } from '@/lib/trip-builder-preview'
import { toTour } from '@/lib/server/tours'
vi.mock('@/lib/server/db', () => ({ db: {} }))
const base: Tour = { slug: 'existing', title: 'Saved title', category: 'multi-days-tours', location: 'Cairo', duration: '2 days', price: 100, image: '/saved.jpg', gallery: ['/saved.jpg'], summary: 'Saved summary', detail: { overview: ['Saved paragraph'], highlights: [], itinerary: [], locations: [], travelerPrices: [{ travelers: 1, adultPrice: 100, childPrice: 30, infantPrice: 0 }, { travelers: 2, adultPrice: 80, childPrice: 20, infantPrice: 0 }] } }
function editor(tour = base): TripBuilderDraft {
  const { categorySlugs, ...fields } = editorData(tour)
  return { ...fields, catSlugs: categorySlugs }
}
beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => { throw Error('Preview must not perform API writes or reads') })))
afterEach(() => vi.unstubAllGlobals())
it('new editor previews are blank/incomplete rather than a fabricated free saved trip', () => {
  const source = blankTour(), draft = editor(source)
  expect(draft.form.price).toBe(''); expect(draft.travelerPrices.adult.every(row => row.price === '')).toBe(true); expect(draft.gallery).toEqual([])
  const preview = buildTripPreview(source, draft, 'en')
  expect(preview.tour.title).toBe(''); expect(preview.tour.image).toBe(''); expect(quoteTripPreview(preview, { adult: 2, child: 0, infant: 0 }).kind).toBe('incomplete')
  const html = renderToStaticMarkup(createElement(TripPreviewContent, { preview, counts: { adult: 2, child: 0, infant: 0 } }))
  expect(html).toContain('Untitled trip'); expect(html).toContain('Complete the pricing fields'); expect(html).not.toContain('src=""'); expect(html).not.toContain('Traveler group total')
})
it('existing stored zero amounts are not confused with missing new-trip prices', () => {
  const source = { ...base, price: 0, detail: undefined }
  const draft = editor(source)
  expect(draft.form.price).toBe('0')
  expect(quoteTripPreview(buildTripPreview(source, draft, 'en'), { adult: 2, child: 0, infant: 0 })).toMatchObject({ kind: 'quote', total: 0 })
})
it('initializes only the active category detail, ignoring stale inactive-category data', () => {
  const source: Tour = { ...base, category: 'one-day-tours', dayDetail: { overview: ['Actual day overview'], travelerPrices: [{ travelers: 1, adultPrice: 40, childPrice: 10, infantPrice: 0 }] } }
  const draft = editor(source)
  expect(draft.form.overview).toBe('Actual day overview'); expect(draft.travelerPrices.adult[0].price).toBe('40')
})
it.each(['en','es','it'] as const)('renders the current %s content using real public layout/section classes', locale => {
  const draft = editor(); draft.form.title = 'Current title'; draft.form.overview = 'Current paragraph'; draft.gallery = []
  draft.form.translations = { es: { title: 'Título actual' }, it: { title: 'Titolo attuale' } }
  const preview = buildTripPreview(base, draft, locale)
  const html = renderToStaticMarkup(createElement(TripPreviewContent, { preview, counts: { adult: 2, child: 0, infant: 0 } }))
  expect(html).toContain(locale === 'es' ? 'Título actual' : locale === 'it' ? 'Titolo attuale' : 'Current title')
  expect(html).toContain('Current paragraph'); expect(html).not.toContain('Saved title'); expect(html).not.toContain('/saved.jpg'); expect(html).toContain('tour-detail-layout'); expect(html).toContain('tour-content-section'); expect(html).toContain('USD')
  expect(fetch).not.toHaveBeenCalled()
})
it('formats the real traveler group total and labels unit prices and non-authoritative status', () => {
  const html = renderToStaticMarkup(createElement(PreviewPricing, { preview: buildTripPreview(base, editor(), 'en'), counts: { adult: 2, child: 0, infant: 0 } }))
  expect(html).toContain('$160.00 USD'); expect(html).toContain('Per adult'); expect(html).toContain('Traveler group total'); expect(html).toContain('server recalculates'); expect(html).toContain('Optional add-ons are excluded')
  expect(html).toMatch(/<label[^>]*for=/); expect(html).toMatch(/step="1"/)
})
it('retains unsaved date-tier values and shows missing amounts without turning them into zero', () => {
  const draft = editor(); draft.priceRows = [{ id: 'row', category: 'Current period', price: '', startDate: '', endDate: '', note: 'Current note', prefix: '', tiers: [{ id: 'tier', label: 'Current tier', price: '', suffix: 'per person' }] }]
  const html = renderToStaticMarkup(createElement(PreviewDatePrices, { preview: buildTripPreview(base, draft, 'en') }))
  expect(html).toContain('price-season-card'); expect(html).toContain('Current tier'); expect(html).toContain('—'); expect(html).not.toContain('$0.00')
})
it('keeps the preview closed by default, language choices enabled-only and every button non-submitting', () => {
  const html = renderToStaticMarkup(createElement(TripBuilderPreview, { source: base, draft: editor(), clearedTranslations: new Set<string>(), counts: { adult: 2, child: 0, infant: 0 }, onCount: () => {} }))
  expect(html).toContain('Preview language'); expect(html).toContain('value="en"'); expect(html).toContain('value="es"'); expect(html).toContain('value="it"'); expect(html).not.toContain('value="ar"')
  expect(html).not.toContain('role="dialog"'); expect(html).not.toContain('<form')
  for (const button of html.matchAll(/<button\b[^>]*>/g)) expect(button[0]).toContain('type="button"')
  expect(fetch).not.toHaveBeenCalled()
})
it('preserves derived linked-offer pricing provenance through the server Tour mapper', () => {
  const row = { ...base, pricingDealSource: 'linked-offer' as const, aliases: '[]', gallery: '[]', galleryCaptions: '[]', journeyVideos: '[]', categorySlugs: '[]', photoCredits: '[]', detail: '{}', dayDetail: null, deal: '{"percent":20,"endsAt":"2099-12-31"}' }
  expect(toTour(row as unknown as Parameters<typeof toTour>[0]).pricingDealSource).toBe('linked-offer')
})
it('reuses published appearance tokens only inside the public preview scope', () => {
  const html = renderToStaticMarkup(createElement(TripPreviewContent, { preview: buildTripPreview(base, editor(), 'en'), counts: { adult: 2, child: 0, infant: 0 }, appearance: { primary: '#123456' } }))
  expect(html).toContain('public-appearance'); expect(html).toContain('--primary:#123456'); expect(html).not.toContain('.sp-admin')
})
it.each(['javascript:alert(1)', 'data:text/html,hello', '//evil.example/image.jpg', '/%2e%2e/private.jpg', '/\\evil.example/image.jpg'])('does not turn unsafe draft media into active URLs: %s', source => expect(safePreviewMedia(source)).toBe(''))
