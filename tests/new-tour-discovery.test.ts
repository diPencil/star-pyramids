import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Tour } from '@/data/types'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'
import { OneDayToursRegions, TourListing } from '@/components/site'
import { TripsPage } from '@/components/trips-page'
import { RebuiltHomePage } from '@/components/homepage'
import { originalPageContent } from '@/lib/page-sections'

const state = vi.hoisted(() => ({ rows: [] as Tour[], page: '' }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => '/trips', useSearchParams: () => new URLSearchParams(state.page) }))
vi.mock('@/lib/tours-client', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/tours-client')>()
  return { ...actual, useDbTours: (base: readonly Tour[], options?: import('@/lib/tours-client').DbToursOptions) => actual.resolveTours(base, new Map(state.rows.map(row => [row.slug, row])), options) }
})
vi.mock('@/lib/catalogue-client', () => ({
  useDbDestinations: () => [{ slug: 'cairo', title: 'Cairo', copy: 'Cairo experiences', isPublished: true, showInOneDayTours: true }],
  useDbCategories: (base: unknown[]) => base,
}))
const row = (slug: string, category: Tour['category'], status = 'published'): Tour => ({ slug, title: slug, category, status, destinationSlug: 'cairo', location: 'Cairo', duration: '1 day', price: 1, image: '', summary: 'Source-supported description' }) as Tour
const render = (child: React.ReactNode) => renderToStaticMarkup(h(InitialLocaleProvider, { locale: 'en', preview: true, children: h(LocaleProvider, { children: child }) }))

describe('published admin-created tours in actual discovery components', () => {
  beforeEach(() => { state.rows = []; state.page = '' })
  it('shows newly published records in the automatic homepage selection, without drafts', () => {
    state.rows = [row('new-homepage-tour', 'one-day-tours'), row('hidden-homepage-draft', 'one-day-tours', 'draft')]
    const html = render(h(RebuiltHomePage))
    expect(html).toContain('href="/egypt-tours/new-homepage-tour"')
    expect(html).not.toContain('href="/egypt-tours/hidden-homepage-draft"')
  })
  it('preserves an explicit CMS selection instead of appending unselected homepage cards', () => {
    state.rows = [row('chosen-homepage-tour', 'one-day-tours'), row('not-selected-tour', 'one-day-tours')]
    const content = originalPageContent()
    const popular = content.sections.find(section => section.id === 'popular')!
    popular.selectionMode = 'selected'
    popular.selection = ['chosen-homepage-tour']
    const html = render(h(RebuiltHomePage, { pageContent: { content } }))
    expect(html).toContain('href="/egypt-tours/chosen-homepage-tour"')
    expect(html).not.toContain('href="/egypt-tours/not-selected-tour"')
  })
  it('includes a new day-tour slug in destination sections and excludes drafts and other categories', () => {
    state.rows = [row('new-cairo-day', 'one-day-tours'), row('hidden-draft', 'one-day-tours', 'draft'), row('other-category', 'nile-cruises')]
    const html = render(h(OneDayToursRegions))
    expect(html).toContain('href="/egypt-tours/new-cairo-day"')
    expect(html).not.toContain('href="/egypt-tours/hidden-draft"')
    expect(html).not.toContain('href="/egypt-tours/other-category"')
  })
  it.each(['one-day-tours', 'multi-days-tours', 'nile-cruises', 'shore-excursions'] as const)('includes new published %s records without category leakage', category => {
    state.rows = [row('new-published-record', category), row('hidden-draft', category, 'draft'), row('wrong-category', category === 'one-day-tours' ? 'nile-cruises' : 'one-day-tours')]
    const html = render(h(TourListing, { slug: category }))
    expect(html).toContain('href="/egypt-tours/new-published-record"')
    expect(html).not.toContain('href="/egypt-tours/hidden-draft"')
    expect(html).not.toContain('href="/egypt-tours/wrong-category"')
  })
  it('paginates eleven published tours as nine plus two, without counting drafts', () => {
    state.rows = [...Array.from({ length: 11 }, (_, i) => row(`new-trip-${i}`, 'one-day-tours')), row('hidden-draft', 'one-day-tours', 'draft')]
    const first = render(h(TripsPage))
    expect(first).toContain('11 trips found')
    expect(first).toContain('Showing 1-9 of 11')
    expect(first).not.toContain('href="/egypt-tours/new-trip-10"')
    state.page = 'page=2'
    const second = render(h(TripsPage))
    expect(second).toContain('Showing 10-11 of 11')
    expect(second).toContain('href="/egypt-tours/new-trip-10"')
    expect(second).not.toContain('href="/egypt-tours/hidden-draft"')
  })
})
