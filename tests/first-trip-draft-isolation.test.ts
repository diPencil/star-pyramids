import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Tour } from '@/data/types'

const state = vi.hoisted(() => ({ tours: [] as Tour[] }))
vi.mock('@/lib/server/db', () => ({ db: {} }))
vi.mock('@/lib/server/catalogue/tours', () => ({
  getToursByCategory: async () => state.tours,
  findTourBySlug: async (slug: string) => state.tours.find(t => t.slug === slug || t.aliases?.includes(slug)) ?? null,
}))
vi.mock('@/lib/server/editorial/blogs', () => ({ findBlogBySlug: async () => null }))
vi.mock('@/lib/server/catalogue/destinations', () => ({ findDestinationBySlug: async () => null }))
vi.mock('@/lib/server/notifications/notifications', () => ({ notifyUser: vi.fn(), notifyStaff: vi.fn() }))
vi.mock('@/lib/server/email/email', () => ({ sendCustomerEmailSafe: vi.fn(), sendStaffEmailSafe: vi.fn() }))
vi.mock('@/lib/server/cms/page-content-metadata', () => ({ pageContentMetadata: async () => ({}) }))
vi.mock('@/lib/seo/seo', () => ({ getCanonicalUrl: async (p: string) => p, getHreflangEntries: async () => ({}) }))
vi.mock('@/components/cms/heroes/server-showcase-hero', async () => {
  const { createElement } = await import('react')
  return { ServerShowcaseHero: ({ children }: { children: React.ReactNode }) => createElement('main', null, children) }
})
vi.mock('@/components/site', async () => {
  const { createElement } = await import('react')
  return { RegionTourPage: ({ tours, region }: { tours: Tour[]; region: { tourSlugs: string[] } }) => createElement('div', null, JSON.stringify({ titles: tours.map(t => t.title), slugs: region.tourSlugs, count: tours.length })) }
})

import CruiseTypePage from '@/app/egypt-tours/nile-cruises/[type]/page'
import { validateTripDraft } from '@/lib/server/trip-builder/trip-requests'

const makeTour = (slug: string, status: string, cruiseType: Tour['cruiseType'] = 'standard-nile-cruises'): Tour => ({
  slug, title: slug, aliases: [`${slug}-alias`], status, category: 'nile-cruises', cruiseType,
  location: 'Nile', duration: 'Full day', price: 1, image: '', summary: '',
})
const request = (tourSlug: string) => ({
  destinationSlug: '', tourSlug, customTitle: tourSlug ? '' : 'Custom journey', requestedAddOns: [],
  timeMode: 'unsure', preferredFrom: '', preferredTo: '', adults: 1, children: 0, infants: 0,
  budgetMin: 0, budgetMax: 100, currency: 'USD', flightOffer: false,
  nationality: 'EG', dialCode: '+20', notes: '',
  contact: { name: 'Test Visitor', email: 'visitor@example.test', phone: '+201234567890' },
})
beforeEach(() => { state.tours = [makeTour('published-cruise', 'published'), makeTour('private-draft', 'draft')] })

describe('public Draft isolation before first-trip import', () => {
  it('passes only published matching cruises to regional cards, identities and counts', async () => {
    state.tours.push(makeTour('different-type', 'published', 'luxury-nile-cruise'))
    const html = renderToStaticMarkup(await CruiseTypePage({ params: Promise.resolve({ type: 'standard-nile-cruises' }) }))
    expect(html).toContain('published-cruise')
    expect(html).toContain('&quot;count&quot;:1')
    expect(html).not.toContain('private-draft')
    expect(html).not.toContain('different-type')
  })
  it.each(['private-draft', 'private-draft-alias'])('rejects Draft request identity %s before creating anything', async slug => {
    await expect(validateTripDraft(request(slug))).rejects.toThrow('Choose a valid tour.')
  })
  it('retains published-tour requests', async () => {
    await expect(validateTripDraft(request('published-cruise'))).resolves.toMatchObject({ tourSlug: 'published-cruise' })
  })
  it('retains custom-title requests without a tour', async () => {
    await expect(validateTripDraft(request(''))).resolves.toMatchObject({ tourSlug: '', customTitle: 'Custom journey' })
  })
  it('rejects unknown tours', async () => {
    await expect(validateTripDraft(request('missing'))).rejects.toThrow('Choose a valid tour.')
  })
})
