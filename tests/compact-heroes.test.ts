import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CRUISE_HERO_IDS } from '@/lib/compact-hero-defaults'
import { cruiseTypes } from '@/data/tours'
import { heroCatalogue } from '@/lib/hero-catalogue'
import { originalShowcaseHero, validateShowcaseHero, type PublicShowcaseHero } from '@/lib/showcase-heroes'
import { ShowcaseHeroProvider } from '@/components/showcase-hero-context'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'
import { RegionTourPage } from '@/components/site'
import { TripsPage } from '@/components/trips-page'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => '/trips', useSearchParams: () => new URLSearchParams() }))

function render(child: React.ReactElement, state?: PublicShowcaseHero) {
  return renderToStaticMarkup(createElement(InitialLocaleProvider, { locale: 'es', preview: true, children: createElement(LocaleProvider, { children: state ? createElement(ShowcaseHeroProvider, { state, children: child }) : child }) }))
}
describe('compact hero publication without database writes', () => {
  it('covers every cruise definition exactly once and links dynamic content owners', () => {
    expect([...CRUISE_HERO_IDS].sort()).toEqual(cruiseTypes.map((item) => item.slug).sort())
    expect(new Set(heroCatalogue.map((hero) => hero.id)).size).toBe(heroCatalogue.length)
    expect(new Set(heroCatalogue.map((hero) => hero.route)).size).toBe(heroCatalogue.length)
    expect(heroCatalogue.filter((hero) => !('cms' in hero))).toHaveLength(7)
  })
  it.each(['trips', ...CRUISE_HERO_IDS] as const)('%s rejects unsupported media and links', (id) => {
    const content = originalShowcaseHero(id)
    expect(validateShowcaseHero(id, content)).toEqual(content)
    expect(() => validateShowcaseHero(id, { ...content, image: '/egypt-hero.png' })).toThrow()
    expect(() => validateShowcaseHero(id, { ...content, links: { primaryHref: '/contact' } })).toThrow()
  })
  const cruise = createElement(RegionTourPage, { region: { slug: CRUISE_HERO_IDS[0], name: 'Original cruise', nameAr: 'Original', copy: 'Original description', tourSlugs: [] }, tours: [], page: 1, category: 'nile-cruises' })
  for (const [id, child] of [['trips', createElement(TripsPage)], [CRUISE_HERO_IDS[0], cruise]] as const) {
    it(`${id} preserves original markup and keeps controls after unpublishing`, () => {
      expect(render(child, { hidden: false, content: null })).toBe(render(child))
      const content = originalShowcaseHero(id)
      content.text.es.title = 'Published Spanish heading'
      const published = render(child, { hidden: false, content })
      expect(published).toContain('Published Spanish heading')
      const hidden = render(child, { hidden: true, content })
      expect(hidden).not.toContain('Published Spanish heading')
      expect(hidden).toContain(id === 'trips' ? 'trips-search' : 'results-bar')
      expect(render(child, { hidden: false, content: null, unavailable: true })).not.toContain(id === 'trips' ? 'trips-intro-inner' : 'cat-hero-ic')
    })
  }
})
