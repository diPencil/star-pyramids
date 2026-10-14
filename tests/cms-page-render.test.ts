import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }))
import { RebuiltHomePage } from '@/components/homepage'
import { InitialLocaleProvider } from '@/components/locale'
import { originalPageContent, publicPageContent, transitionPageContent, initialPageState, type PublicPageContent } from '@/lib/page-sections'
import type { EnabledLocale } from '@/lib/locale-config'
const render = (state?: PublicPageContent, locale: EnabledLocale = 'en') => renderToStaticMarkup(createElement(InitialLocaleProvider, { locale, preview: true, children: createElement(RebuiltHomePage, { initialLocale: locale, pageContent: state }) }))
describe('actual homepage components consume CMS publication', () => {
  it('keeps default structure identical when an original document is supplied', () => {
    // React-generated IDs are deterministic in independent SSR renders.
    expect(render({ content: originalPageContent() })).toBe(render())
  })
  it('renders localized edits, item icons and reordered sections without changing required forms', () => {
    const content = originalPageContent()
    content.sections[2].text.es.xmasT = 'Viajes seleccionados por nuestro equipo'
    content.sections.find((s) => s.id === 'faq')!.items![0].text.es.question = 'Pregunta publicada del CMS'
    content.sections.find((s) => s.id === 'stats')!.items![0].icon = 'Compass'
    content.sections.splice(2, 0, content.sections.splice(content.sections.findIndex((s) => s.id === 'faq'), 1)[0])
    const html = render({ content }, 'es')
    expect(html).toContain('Viajes seleccionados por nuestro equipo')
    expect(html).toContain('Pregunta publicada del CMS')
    expect(html.indexOf('Pregunta publicada del CMS')).toBeLessThan(html.indexOf('Viajes seleccionados por nuestro equipo'))
    expect(html).toContain('lucide-compass')
    for (const value of ['Trip search', 'home-help-name', 'home-help-email', 'mini-search']) expect(html).toContain(value)
  })
  it('hides optional sections on unpublish/read failure while retaining the search and enquiry controls', () => {
    for (const state of [publicPageContent(transitionPageContent(initialPageState(), 'unpublish')), { content: null, unavailable: true }]) {
      const html = render(state)
      expect(html).not.toContain('Explore Egypt&#x27;s Top Tours')
      expect(html).not.toContain('faq-home-list')
      expect(html).toContain('Trip search')
      expect(html).toContain('home-help-name')
      expect(html).toContain('mini-search')
    }
  })
})
