import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const state = vi.hoisted(() => ({ loading: false, error: null as string | null, blogs: [] as unknown[], query: '', retry: vi.fn() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams({ q: state.query }) }))
vi.mock('@/components/site', () => ({ SiteShell: ({ children }: { children: unknown }) => children }))
vi.mock('@/components/locale', () => ({ useLocale: () => ({ locale: 'en' }), tx: (_locale: string, text: { en: string }) => text.en }))
const status = () => ({ data: state.loading || state.error ? null : [], loading: state.loading, error: state.error, retry: state.retry })
vi.mock('@/lib/tours-client', () => ({ useDbTours: () => [], useDbToursStatus: () => status() }))
vi.mock('@/lib/catalogue-client', () => ({ usePublicDestinationsStatus: () => status() }))
vi.mock('@/lib/events-cars-client', () => ({ useDbEvents: () => [], useDbEventsStatus: () => status() }))
vi.mock('@/lib/offers-blogs-client', () => ({ useDbOffers: () => [], useDbBlogs: () => state.blogs, useDbOffersStatus: () => status(), usePublicBlogsStatus: () => status() }))
import { SearchPage } from '@/components/public-search-page'
beforeEach(() => { state.loading = false; state.error = null; state.blogs = []; state.query = '' })
describe('public search rendering without browser or database writes', () => {
  it('renders a genuine empty state rather than bundled demo results', () => {
    const html = renderToStaticMarkup(createElement(SearchPage))
    expect(html).toContain('0 results')
    expect(html).toContain('No matching results')
    expect(html).not.toContain('content-card-body')
  })
  it('does not claim zero results while sources are loading or unavailable', () => {
    state.loading = true
    let html = renderToStaticMarkup(createElement(SearchPage))
    expect(html).toContain('Loading search results')
    expect(html).not.toContain('0 results')
    state.loading = false; state.error = 'Failed'
    html = renderToStaticMarkup(createElement(SearchPage))
    expect(html).toContain('Some results could not be loaded')
    expect(html).toContain('Retry')
    expect(html).not.toContain('No matching results')
  })
  it('uses the submitted URL query and renders matching live content only', () => {
    state.query = 'Markets'
    state.blogs = [{ slug: 'cairo', title: 'Cairo markets', excerpt: 'Local guide', category: 'Travel', image: '/guide.jpg', isPublished: true }, { slug: 'draft', title: 'Markets draft', isPublished: false }]
    const html = renderToStaticMarkup(createElement(SearchPage))
    expect(html).toContain('1 result')
    expect(html).toContain('href="/blogs/cairo"')
    expect(html).not.toContain('Markets draft')
  })
})
