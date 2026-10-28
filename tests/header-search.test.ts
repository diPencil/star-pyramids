import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SearchResult } from '@/lib/site-search'
const state = vi.hoisted(() => ({ locale: 'en', read: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/locale', () => ({ useLocale: () => ({ locale: state.locale }), tx: (locale: string, text: Record<string, string>) => text[locale] ?? text.en }))
vi.mock('@/lib/use-public-search', () => ({ usePublicSearch: state.read }))
import { HeaderSearch, SearchSuggestions } from '@/components/header-search'
const result: SearchResult = { type: 'Destination', slug: 'cairo', title: 'Cairo', copy: 'Discover the city', image: '/cairo.jpg', href: '/destinations/cairo' }
const props = { query: 'cair', id: 'suggestions', active: 0, results: [result], loading: false, failed: [], retry: vi.fn(), onClose: vi.fn() }
describe('header autocomplete without browser or database', () => {
  it('provides accessible desktop/mobile search without fetching until suggestions open', () => {
    for (const mobile of [false, true]) {
      const html = renderToStaticMarkup(createElement(HeaderSearch, { mobile, query: '', onQueryChange: vi.fn(), placeholder: 'Find places', submitLabel: 'Search' }))
      expect(html).toContain('role="combobox"')
      expect(html).toContain('aria-expanded="false"')
      expect(html).toContain('type="submit"')
    }
    expect(state.read).not.toHaveBeenCalled()
  })
  it('renders named typed page links with small thumbnails, never image links', () => {
    state.locale = 'en'
    const html = renderToStaticMarkup(createElement(SearchSuggestions, props))
    expect(html).toContain('role="listbox"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('Destination')
    expect(html).toContain('<strong>Cairo</strong>')
    expect(html).toContain('href="/destinations/cairo"')
    expect(html).toContain('width="48" height="48"')
    expect(html).not.toContain('href="/cairo.jpg"')
    expect(html).toContain('href="/search?q=cair"')
  })
  it('caps the dropdown while linking to all results', () => {
    const results = Array.from({ length: 11 }, (_, index) => ({ ...result, slug: 'place-' + index }))
    const html = renderToStaticMarkup(createElement(SearchSuggestions, { ...props, results }))
    expect(html.match(/role="option"/g)).toHaveLength(8)
    expect(html).toContain('View all results')
  })
  it('shows loading/error rather than a false empty result', () => {
    let html = renderToStaticMarkup(createElement(SearchSuggestions, { ...props, results: [], loading: true }))
    expect(html).toContain('Searching…')
    expect(html).not.toContain('No matching pages')
    html = renderToStaticMarkup(createElement(SearchSuggestions, { ...props, results: [], failed: ['error'] }))
    expect(html).toContain('Retry')
    expect(html).not.toContain('No matching pages')
  })
  it('localizes suggestion categories and empty states for EN/ES/IT', () => {
    for (const [locale, label] of [['en', 'Destination'], ['es', 'Destino'], ['it', 'Destinazione']]) {
      state.locale = locale
      expect(renderToStaticMarkup(createElement(SearchSuggestions, props))).toContain(label)
    }
    state.locale = 'en'
    expect(renderToStaticMarkup(createElement(SearchSuggestions, { ...props, results: [] }))).toContain('No matching pages')
  })
})
