import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Destination, Tour } from '@/data/types'

const mocks = vi.hoisted(() => ({ locale: 'en', destinations: vi.fn(), tours: vi.fn(), list: vi.fn(), find: vi.fn(), slugs: vi.fn(), listTours: vi.fn(), hero: vi.fn(), notFound: vi.fn() }))
vi.mock('@/components/locale', async () => ({ ...await vi.importActual<typeof import('@/components/locale')>('@/components/locale'), useLocale: () => ({ locale: mocks.locale, currency: 'USD' }) }))
vi.mock('@/lib/catalogue-client', () => ({ usePublicDestinationsStatus: mocks.destinations }))
vi.mock('@/lib/tours-client', () => ({ useDbToursStatus: mocks.tours, invalidateToursCache: vi.fn() }))
vi.mock('@/lib/customer-account', () => ({ useCustomerFavorites: () => ({ has: () => false, toggle: vi.fn() }) }))
// Keep the real TourCard (including its canonical link); omit unrelated shell providers.
vi.mock('@/components/site', async () => ({ ...await vi.importActual<typeof import('@/components/site')>('@/components/site'), SiteShell: ({ children }: { children: ReactNode }) => children }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => '/destinations', useRouter: () => ({}), notFound: mocks.notFound }))
vi.mock('@/lib/server/destinations', () => ({ getPublishedDestinations: mocks.list, findDestinationBySlug: mocks.find, listDestinationSlugs: mocks.slugs }))
vi.mock('@/lib/server/tours', () => ({ listTours: mocks.listTours }))
vi.mock('@/lib/server/faq-hero', () => ({ readFaqHeroState: mocks.hero }))
vi.mock('@/lib/server/page-content-metadata', () => ({ pageContentMetadata: vi.fn() }))
vi.mock('@/lib/structured-data', () => ({ RecordPageJsonLd: () => null }))
vi.mock('@/lib/dynamic-seo', () => ({ dynamicSeo: vi.fn() }))

import { DestinationDetailPage, DestinationsPage } from '@/components/extended-pages'
import { PresentationProvider, type PresentationStates } from '@/components/presentation-content-context'
import { FaqHeroProvider } from '@/components/faq-hero-context'
import { originalTemplateContent } from '@/lib/template-presentation'
import { originalEditorialHero } from '@/lib/editorial-hero-definitions'
import { localizeCatalogue } from '@/lib/catalogue-translations'
import { destinations as bootstrapDestinations } from '@/data/content'
import ListingRoute from '@/app/destinations/page'
import DetailRoute, { generateStaticParams } from '@/app/destinations/[slug]/page'

const destination = (patch: Partial<Destination> = {}): Destination => ({
  slug: 'database-oasis', title: 'Database Oasis', copy: 'Saved destination introduction', image: '/saved-card.jpg', isPublished: true, showInDestinations: true,
  translations: { es: { title: 'Oasis guardado', copy: 'Introducción guardada', 'detail.intro': 'Historia guardada' }, it: { title: 'Oasi salvata', 'detail.intro': 'Storia salvata' } },
  detail: { heroImage: '/saved-hero.jpg', heroAlt: 'Saved hero alt', eyebrow: 'Saved region', intro: 'Saved destination story', facts: [{ label: 'Stay', value: 'Three nights' }], bestFor: ['Quiet journeys'], experiences: [{ title: 'Saved experience', copy: 'Saved experience copy', image: '/experience.jpg', alt: 'Experience alt' }], rhythm: [{ label: 'Morning', title: 'Saved rhythm', copy: 'Take your time' }], practical: [{ title: 'Saved advice', copy: 'Bring water' }], tourSlugs: ['old-tour-alias', 'draft-trip'] }, ...patch,
})
const tour = (slug: string, patch: Partial<Tour> = {}): Tour => ({ slug, title: `Saved ${slug}`, category: 'one-day-tours', location: 'Oasis', duration: 'One day', price: 125, image: '/tour.jpg', summary: 'Saved tour', status: 'published', ...patch })
const render = (node: ReactNode) => renderToStaticMarkup(node)
const listing = (rows = [destination()]) => render(createElement(DestinationsPage, { initialDestinations: rows }))
const detail = (item = destination(), rows: Tour[] = []) => render(createElement(DestinationDetailPage, { slug: item.slug, initialDestination: item, initialTours: rows }))
const assertNoBootstrap = (html: string) => { for (const row of bootstrapDestinations) expect(html).not.toContain(`href="/destinations/${row.slug}"`) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.locale = 'en'
  mocks.destinations.mockReturnValue({ data: null, error: null, retry: vi.fn() })
  mocks.tours.mockReturnValue({ data: null, error: null, retry: vi.fn() })
  mocks.list.mockResolvedValue([destination()])
  mocks.find.mockResolvedValue(destination())
  mocks.slugs.mockResolvedValue(['database-oasis'])
  mocks.listTours.mockResolvedValue([])
  mocks.hero.mockResolvedValue({ mode: 'original' })
  mocks.notFound.mockImplementation(() => { throw new Error('NEXT_NOT_FOUND') })
})

describe('public destination SSR using server seeds and live catalogue status', () => {
  it.each([['en', 'Database Oasis', 'Saved destination story'], ['es', 'Oasis guardado', 'Historia guardada'], ['it', 'Oasi salvata', 'Storia salvata']])('renders saved listing/detail content in %s before client fetch', (locale, title, story) => {
    mocks.locale = locale
    const html = listing()
    expect(html).toContain(`<h2>${title}</h2>`)
    expect(html).toContain('href="/destinations/database-oasis"')
    expect(html).toContain('src="/saved-card.jpg"')
    expect(html).not.toContain('Loading destinations')
    assertNoBootstrap(html)
    const page = detail()
    expect(page).toContain(`<h1>${title}</h1>`)
    for (const value of [story, 'Saved experience', 'Saved advice', 'src="/saved-hero.jpg"']) expect(page).toContain(value)
    expect(page).toContain(`alt="${locale === 'en' ? 'Saved hero alt' : title}"`)
  })

  it('excludes unpublished and listing-hidden records, while listing-hidden published detail stays reachable', () => {
    const hidden = destination({ slug: 'listing-hidden', title: 'Hidden listing title', showInDestinations: false })
    const unpublished = destination({ slug: 'unpublished', title: 'Private destination', isPublished: false })
    const html = listing([destination(), hidden, unpublished])
    expect(html).toContain('Database Oasis')
    expect(html).not.toContain('Hidden listing title')
    expect(html).not.toContain('Private destination')
    expect(detail(hidden)).toContain('<h1>Hidden listing title</h1>')
    mocks.destinations.mockReturnValue({ data: [unpublished], error: null, retry: vi.fn() })
    expect(detail(unpublished)).toContain('Destination not found')
    expect(detail(unpublished)).not.toContain('Private destination')
  })

  it.each(['loading', 'empty', 'error'] as const)('renders honest %s status without source cards', kind => {
    mocks.destinations.mockReturnValue({ data: kind === 'empty' ? [] : null, error: kind === 'error' ? 'Unavailable' : null, retry: vi.fn() })
    const html = render(createElement(DestinationsPage))
    expect(html).toContain(kind === 'loading' ? 'Loading destinations…' : kind === 'empty' ? 'No destinations are available yet.' : 'Destinations could not be loaded.')
    expect(html).toContain(`role="${kind === 'error' ? 'alert' : 'status'}"`)
    expect(html.includes('Try again')).toBe(kind === 'error')
    assertNoBootstrap(html)
  })

  it('never resurrects server/bootstrap records after a successful empty API response', () => {
    mocks.destinations.mockReturnValue({ data: [], error: null, retry: vi.fn() })
    const html = listing()
    expect(html).toContain('No destinations are available yet.')
    expect(html).not.toContain('Database Oasis')
    assertNoBootstrap(html)
    const page = detail()
    expect(page).toContain('Destination not found')
    expect(page).not.toContain('Saved destination story')
  })

  it('prefers localized API records over stale server seeds', () => {
    mocks.locale = 'es'
    const fresh = destination({ title: 'Fresh destination', translations: { es: { title: 'Destino actualizado' } } })
    mocks.destinations.mockReturnValue({ data: [localizeCatalogue(fresh, 'destination', 'es')], error: null, retry: vi.fn() })
    expect(listing()).toContain('Destino actualizado')
    expect(detail()).toContain('<h1>Destino actualizado</h1>')
    expect(listing()).not.toContain('Oasis guardado')
  })

  it.each([['es', 'Aún no hay destinos disponibles.', 'No se pudieron cargar los destinos.'], ['it', 'Nessuna destinazione disponibile al momento.', 'Impossibile caricare le destinazioni.']])('localizes empty and error status in %s', (locale, empty, error) => {
    mocks.locale = locale
    mocks.destinations.mockReturnValue({ data: [], error: null, retry: vi.fn() })
    expect(listing()).toContain(empty)
    mocks.destinations.mockReturnValue({ data: null, error: 'Failed', retry: vi.fn() })
    expect(listing()).toContain(error)
    expect(listing()).not.toContain('Oasis guardado')
    expect(listing()).not.toContain('Oasi salvata')
  })

  it('applies published presentation link copy without replacing destination records', () => {
    mocks.locale = 'es'
    const content = originalTemplateContent('destinations')
    const states: PresentationStates = { destinations: { content: { ...content, sections: content.sections.map(section => section.id === 'presentation' ? { ...section, text: { ...section.text, es: { ...section.text.es, description1: 'Enlace editorial publicado' } } } : section) } } }
    const html = render(createElement(PresentationProvider, { states, children: createElement(DestinationsPage, { initialDestinations: [destination()] }) }))
    expect(html).toContain('Enlace editorial publicado')
    expect(html).toContain('Oasis guardado')
    expect(html).toContain('href="/destinations/database-oasis"')
  })

  it('shows loading/error on detail without reviving stale content and supports server load failure recovery', () => {
    expect(render(createElement(DestinationDetailPage, { slug: 'missing' }))).toContain('Loading destinations…')
    mocks.destinations.mockReturnValue({ data: null, error: 'Failed', retry: vi.fn() })
    expect(detail()).toContain('role="alert"')
    expect(detail()).not.toContain('Saved destination story')
    expect(render(createElement(DestinationsPage, { loadError: true }))).toContain('Try again')
    mocks.destinations.mockReturnValue({ data: [destination()], error: null, retry: vi.fn() })
    expect(render(createElement(DestinationsPage, { loadError: true }))).toContain('Database Oasis')
  })

  it('renders real canonical tour cards, deduplicates aliases, and keeps associations for listing-excluded destinations', () => {
    const rows = [tour('canonical-trip', { aliases: ['old-tour-alias'], destinationSlug: 'database-oasis' }), tour('associated-trip', { destinationSlug: 'database-oasis' }), tour('draft-trip', { status: 'draft', destinationSlug: 'database-oasis' }), tour('unrelated-trip')]
    const html = detail(destination({ showInDestinations: false }), rows)
    expect(html).toContain('href="/egypt-tours/canonical-trip"')
    expect(html).toContain('href="/egypt-tours/associated-trip"')
    expect(html.match(/class="tour-card /g)).toHaveLength(2)
    for (const slug of ['old-tour-alias', 'draft-trip', 'unrelated-trip']) expect(html).not.toContain(`href="/egypt-tours/${slug}"`)
    mocks.tours.mockReturnValue({ data: [], error: null, retry: vi.fn() })
    expect(detail(destination(), rows)).not.toContain('class="tour-card ')
    mocks.tours.mockReturnValue({ data: null, error: 'Failed', retry: vi.fn() })
    expect(detail(destination(), rows)).not.toContain('class="tour-card ')
  })

  it('honors real CMS section visibility and published localized hero overrides', () => {
    const content = originalTemplateContent('destination-detail')
    const states: PresentationStates = { 'destination-detail': { content: { ...content, sections: content.sections.map(section => ({ ...section, visible: section.id !== 'destination-experiences' })) } } }
    const html = render(createElement(PresentationProvider, { states, children: createElement(DestinationDetailPage, { slug: 'database-oasis', initialDestination: destination() }) }))
    expect(html).not.toContain('Saved experience')
    expect(html).toContain('Saved advice')
    expect(html).toContain('<h1>Database Oasis</h1>')
    mocks.locale = 'it'
    const hero = originalEditorialHero('destinations')
    hero.text.it.heading = 'Hero pubblicato dal CMS'
    hero.image = '/published-cms-hero.jpg'
    hero.href = '/contact'
    const overridden = render(createElement(FaqHeroProvider, { state: { hidden: false, content: hero }, children: createElement(DestinationsPage, { initialDestinations: [destination()] }) }))
    expect(overridden).toContain('<h1>Hero pubblicato dal CMS</h1>')
    expect(overridden).toContain('src="/published-cms-hero.jpg"')
    expect(overridden).toContain('href="/contact"')
    expect(overridden).toContain('Oasi salvata')
    for (const state of [{ hidden: true, content: null }, { hidden: false, content: null, unavailable: true }]) {
      const hidden = render(createElement(FaqHeroProvider, { state, children: createElement(DestinationsPage, { initialDestinations: [destination()] }) }))
      expect(hidden).not.toContain('editorial-hero')
      expect(hidden).toContain('Oasi salvata')
    }
  })

  it('retains the default destination hero image when published CMS media is blank', () => {
    const hero = originalEditorialHero('destinations')
    hero.image = '   '
    hero.text.en.heading = 'Published copy with default media'
    const original = listing()
    const defaultImage = original.match(/<section class="editorial-hero"><img src="([^"]+)"/)?.[1]
    expect(defaultImage).toBeTruthy()
    const html = render(createElement(FaqHeroProvider, { state: { hidden: false, content: hero }, children: createElement(DestinationsPage, { initialDestinations: [destination()] }) }))
    expect(html).toContain(`<section class="editorial-hero"><img src="${defaultImage}"`)
    expect(html).toContain('<h1>Published copy with default media</h1>')
    expect(html).toContain('href="/destinations/database-oasis"')
  })
})

describe('destination route server seed boundaries (repositories mocked)', () => {
  it('passes repository listing content to real SSR components, including an authoritative empty result', async () => {
    expect(render(await ListingRoute())).toContain('href="/destinations/database-oasis"')
    mocks.list.mockResolvedValue([])
    expect(render(await ListingRoute())).toContain('No destinations are available yet.')
    mocks.list.mockRejectedValue(new Error('Read failed'))
    expect(render(await ListingRoute())).toContain('Destinations could not be loaded.')
  })
  it('passes published associated tours through the detail route and rejects unpublished records', async () => {
    mocks.find.mockResolvedValue(destination({ showInDestinations: false }))
    mocks.listTours.mockResolvedValue([tour('canonical-trip', { aliases: ['old-tour-alias'] }), tour('draft-trip', { status: 'draft' })])
    const page = await DetailRoute({ params: Promise.resolve({ slug: 'database-oasis' }) })
    // Check the actual client-bound seed too: hidden editorial aliases must
    // not survive in serialized props merely because their cards are filtered.
    expect(page.props.children[1].props.initialDestination.detail.tourSlugs).toEqual(['canonical-trip'])
    const html = render(page)
    expect(mocks.find).toHaveBeenCalledWith('database-oasis')
    expect(html).toContain('href="/egypt-tours/canonical-trip"')
    expect(html).not.toContain('href="/egypt-tours/draft-trip"')
    mocks.find.mockResolvedValue(destination({ isPublished: false }))
    await expect(DetailRoute({ params: Promise.resolve({ slug: 'database-oasis' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    mocks.find.mockResolvedValue(null)
    await expect(DetailRoute({ params: Promise.resolve({ slug: 'missing' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })
  it('generates only repository slugs and tolerates repository failure without bootstrap routes', async () => {
    expect(await generateStaticParams()).toEqual([{ slug: 'database-oasis' }])
    mocks.slugs.mockRejectedValue(new Error('Read failed'))
    expect(await generateStaticParams()).toEqual([])
  })
})
