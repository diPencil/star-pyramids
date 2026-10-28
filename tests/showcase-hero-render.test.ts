import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Clock3 } from 'lucide-react'
import { PageShowcaseHero } from '@/components/site'
import { EmptyFleetHero, EmptyOffersHero } from '@/components/empty-fleet-hero'
import { ShowcaseHeroProvider } from '@/components/showcase-hero-context'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'
import { originalShowcaseHero, type PublicShowcaseHero } from '@/lib/showcase-heroes'

const props = { image: '/egypt-hero.png', eyebrow: 'Source eyebrow', title: 'Source title', intro: 'Source description', primaryLabel: 'Browse', primaryHref: '#fleet', secondaryLabel: 'Featured', secondaryHref: '/rent-car/request?vehicle=source-id', railLabel: 'Featured vehicle', railTitle: 'Source record title', railHref: '/rent-car/request?vehicle=source-id', railMeta: [{ Icon: Clock3, label: 'Source duration' }], statsLabel: 'Source summary', stats: [{ value: 42, label: 'Source count' }] }
const render = (state?: PublicShowcaseHero) => renderToStaticMarkup(createElement(InitialLocaleProvider, { locale: 'es', preview: true, children: createElement(LocaleProvider, { children: state ? createElement(ShowcaseHeroProvider, { state, children: createElement(PageShowcaseHero, props) }) : createElement(PageShowcaseHero, props) }) }))
describe('actual showcase renderer without database access', () => {
  it('keeps the offers hero with no tours and respects published content and explicit hiding', () => {
    const content = originalShowcaseHero('offers')
    content.text.es.title = 'Ofertas personalizadas'
    content.mobileImage = '/media/offers-mobile.jpg'
    const renderOffers = (state: PublicShowcaseHero) => renderToStaticMarkup(createElement(InitialLocaleProvider, { locale: 'es', preview: true, children: createElement(LocaleProvider, { children: createElement(ShowcaseHeroProvider, { state, children: createElement(EmptyOffersHero) }) }) }))
    const html = renderOffers({ hidden: false, content })
    expect(html).toContain('Ofertas personalizadas')
    expect(html).toContain('/media/offers-mobile.jpg')
    expect(html).toContain('href="#current-offers"')
    expect(html).not.toContain('events-next-event')
    expect(html).not.toContain('/egypt-tours/')
    expect(renderOffers({ hidden: false, content: null })).toContain(originalShowcaseHero('offers').text.es.title)
    expect(renderOffers({ hidden: true, content: null })).toBe('')
  })
  it('renders the empty fleet hero and published CMS media without a fictitious vehicle', () => {
    const content = originalShowcaseHero('cars')
    content.text.es.title = 'Traslados personalizados'
    content.image = '/media/fleet-cover.jpg'
    const html = renderToStaticMarkup(createElement(InitialLocaleProvider, { locale: 'es', preview: true, children: createElement(LocaleProvider, { children: createElement(ShowcaseHeroProvider, { state: { hidden: false, content }, children: createElement(EmptyFleetHero) }) }) }))
    expect(html).toContain('Traslados personalizados')
    expect(html).toContain('/media/fleet-cover.jpg')
    expect(html).toContain('href="#fleet"')
    expect(html).not.toContain('events-next-event')
    expect(html).not.toContain('?vehicle=')
    expect(html).not.toContain('Seats maximum')
  })
  it('keeps original markup identical before CMS initialization', () => {
    expect(render({ hidden: false, content: null })).toBe(render())
  })
  it('renders published Spanish text and mobile image without replacing source records', () => {
    const content = originalShowcaseHero('cars')
    content.image = 'https://example.com/desktop.jpg'
    content.mobileImage = 'https://example.com/mobile.jpg'
    content.alt.es = 'Imagen de viaje'
    content.links.primaryHref = '/contact'
    const html = render({ hidden: false, content })
    expect(html).toContain(content.text.es.title)
    expect(html).toContain('https://example.com/mobile.jpg')
    expect(html).toContain('Imagen de viaje')
    expect(html).toContain('href="/contact"')
    expect(html).toContain('Source record title')
    expect(html).toContain('/rent-car/request?vehicle=source-id')
    expect(html).toContain('Source duration')
    expect(html).toContain('>42</b>')
    expect(html).not.toContain(content.text.en.title)
  })
  it('does not restore hardcoded hero after unpublish or read failure', () => {
    expect(render({ hidden: true, content: null })).toBe('')
    expect(render({ hidden: false, content: null, unavailable: true })).toBe('')
  })
})
