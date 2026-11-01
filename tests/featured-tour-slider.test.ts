import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import postcss, { type AtRule } from 'postcss'
import { describe, expect, it, vi } from 'vitest'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'
import { RebuiltHomePage } from '@/components/homepage'
import { originalPageContent } from '@/lib/page-sections'
import type { Tour } from '@/data/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/tours-client', () => ({ useDbTours: () => Array.from({ length: 9 }, (_, index) => ({ slug: 'published-' + index, title: 'Tour ' + index, status: 'published', category: 'one-day-tours', location: 'Cairo', duration: '1 day', price: 1, image: '/fixture.jpg' }) as Tour) }))
vi.mock('@/lib/catalogue-client', () => ({ useDbDestinations: () => [], useDbCategories: () => [] }))

describe('homepage featured tour carousel', () => {
  it.each(['en', 'es', 'it'] as const)('retains every selected card in one labeled carousel in %s', locale => {
    const content = originalPageContent()
    const featured = content.sections.find(section => section.id === 'featured')!
    featured.selectionMode = 'selected'; featured.selection = ['published-2', 'published-6']; featured.limit = 0
    const html = renderToStaticMarkup(h(InitialLocaleProvider, { locale, preview: true, children: h(LocaleProvider, { children: h(RebuiltHomePage, { pageContent: { content } }) }) }))
    const section = html.split('class="featured-tours-slider"')[1].split('class="center-cta"')[0]
    expect(section).toContain('role="region"')
    expect(section).toContain('tabindex="0"')
    expect(section).toContain(`aria-label="${featured.text[locale].xmasT.replaceAll("'", '&#x27;')}"`)
    expect(section.match(/<article\b/g)).toHaveLength(2)
    expect(section.indexOf('/egypt-tours/published-2')).toBeLessThan(section.indexOf('/egypt-tours/published-6'))
    expect(section).not.toContain('/egypt-tours/published-0')
    expect(html).toContain('class="compact-tour-grid popular-grid"')
  })
  it.each([320, 375, 430, 760, 761, 1024, 1440, 1920])('keeps an overflow row at width %i without changing other section grids', width => {
    const root = postcss.parse(readFileSync('components/featured-tour-slider.css', 'utf8'))
    const values: Record<string, string> = {}
    root.walkRules(rule => {
      expect(rule.selector).toContain('.featured-tours-slider')
      if (rule.selector !== '.home-section .featured-tours-slider .compact-tour-grid') return
      const media = rule.parent as AtRule
      const max = media.type === 'atrule' ? Number(media.params.match(/max-width:(\d+)px/)?.[1]) : Infinity
      if (width <= max) rule.walkDecls(declaration => { values[declaration.prop] = declaration.value })
    })
    expect(values).toMatchObject({ display: 'grid', 'grid-template-columns': 'none', 'grid-auto-flow': 'column', 'overflow-x': 'auto', 'scroll-snap-type': 'x mandatory' })
    expect(values['grid-auto-columns']).toBe(width <= 760 ? '86%' : width <= 1024 ? 'calc((100% - 18px)/2)' : 'calc((100% - 54px)/4)')
  })
})
