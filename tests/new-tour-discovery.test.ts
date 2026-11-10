import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Tour } from '@/data/types'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'
import { OneDayToursRegions, TourListing } from '@/components/site'
import { TripsPage } from '@/components/tours/trips-page'
import { RebuiltHomePage } from '@/components/home/homepage'
import { originalPageContent } from '@/lib/cms/page-sections'

const state = vi.hoisted(() => ({ rows: [] as Tour[], page: '' }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => '/trips', useSearchParams: () => new URLSearchParams(state.page) }))
vi.mock('@/lib/tours/tours-client', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/tours/tours-client')>()
  return { ...actual, useDbTours: (base: readonly Tour[], options?: import('@/lib/tours/tours-client').DbToursOptions) => actual.resolveTours(base, new Map(state.rows.map(row => [row.slug, row])), options) }
})
vi.mock('@/lib/catalogue/catalogue-client', () => ({
  useDbDestinations: () => [{ slug: 'cairo', title: 'Cairo', copy: 'Cairo experiences', isPublished: true, showInOneDayTours: true }],
  useDbCategories: (base: unknown[]) => base,
}))
const row = (slug: string, category: Tour['category'], status = 'published'): Tour => ({ slug, title: slug, category, status, destinationSlug: 'cairo', location: 'Cairo', duration: '1 day', price: 1, image: '/fixture.jpg', summary: 'Source-supported description' }) as Tour
const render = (child: React.ReactNode) => renderToStaticMarkup(h(InitialLocaleProvider, { locale: 'en', preview: true, children: h(LocaleProvider, { children: child }) }))

describe('published admin-created tours in actual discovery components', () => {
  beforeEach(() => { state.rows = []; state.page = '' })
  it.each(['one-day-tours', 'multi-days-tours', 'nile-cruises', 'shore-excursions'] as const)('includes new published %s records in the automatic Top Tours section', category => {
    state.rows = [row('new-featured-tour', category), row('hidden-featured-draft', category, 'draft')]
    const html = render(h(RebuiltHomePage))
    const featured = html.split('class="featured-tours-slider"')[1].split('</section>')[0]
    expect(featured).toContain('href="/egypt-tours/new-featured-tour"')
    expect(featured).not.toContain('hidden-featured-draft')
  })
  it('includes all 26 published Top Tours across categories despite a legacy CMS limit of seven', () => {
    const types = ['one-day-tours', 'multi-days-tours', 'nile-cruises', 'shore-excursions'] as const
    state.rows = Array.from({ length: 26 }, (_, index) => row('featured-' + index, types[index % 4]))
    state.rows.push(row('draft-featured', 'one-day-tours', 'draft'))
    const content = originalPageContent()
    const featured = content.sections.find(section => section.id === 'featured')!
    featured.selectionMode = 'selected'; featured.selection = ['featured-0']; featured.limit = 7
    const html = render(h(RebuiltHomePage, { pageContent: { content } }))
    const grid = html.split('class="featured-tours-slider"')[1].split('</section>')[0]
    expect(grid).toContain('href="/egypt-tours/featured-25"')
    expect(grid).not.toContain('draft-featured')
    expect(grid.match(/<article\b/g)).toHaveLength(26)
  })
  it('renders exactly eight Recommended cards across the published pool', () => {
    const types = ['one-day-tours', 'multi-days-tours', 'nile-cruises', 'shore-excursions'] as const
    state.rows = Array.from({ length: 10 }, (_, index) => row(`published-${index}`, types[index % 4]))
    state.rows.push(row('hidden-new-draft', 'shore-excursions', 'draft'))
    const html = render(h(RebuiltHomePage))
    const grid = html.split('class="compact-tour-grid popular-grid"')[1].split('class="center-cta"')[0]
    expect(grid.match(/<article\b/g)).toHaveLength(8)
    expect(new Set([...grid.matchAll(/href="\/egypt-tours\/(published-\d+)"/g)].map(match => match[1])).size).toBe(8)
    expect(grid).not.toContain('hidden-new-draft')
  })
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
    const popularGrid = html.split('class="compact-tour-grid popular-grid"')[1].split('class="center-cta"')[0]
    expect(popularGrid).toContain('href="/egypt-tours/chosen-homepage-tour"')
    expect(popularGrid).not.toContain('href="/egypt-tours/not-selected-tour"')
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
