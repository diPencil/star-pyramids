import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Destination, Tour } from '@/data/types'
import { changeDestinationRow, destinationBuilderRecord, destinationBuilderTranslations, destinationPreview, DESTINATION_SECTION_MAP, DESTINATION_REPEATERS } from '@/lib/destination-builder'
import { validateCatalogueTranslations } from '@/lib/catalogue-translations'
import { validateDestinationWrite } from '@/lib/destination-write'
import { DestinationSectionsEditor, DestinationCoverEditor } from '@/components/admin/destination-sections-editor'
import { DestinationPreviewContent } from '@/components/admin/destination-builder-preview'
import { DestinationDetailView } from '@/components/extended-pages'
import { PublicAppearance } from '@/components/public-appearance'
import { TourCard, TourCardPresentation } from '@/components/site'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'
import { PresentationProvider } from '@/components/presentation-content-context'
import { originalTemplateContent } from '@/lib/template-presentation'

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/destinations/new' }))
vi.mock('@/lib/catalogue-client', () => ({ usePublicDestinationsStatus: () => { throw Error('Preview must not read the catalogue') } }))
vi.mock('@/lib/tours-client', () => ({ useDbToursStatus: () => { throw Error('Preview must not fetch tours') } }))
// No DB access or media upload is allowed from rendering a preview.
vi.mock('@/lib/server/db', () => { throw Error('Builder parity tests must never use the database') })

const source = (): Destination => ({ slug: 'oasis', title: 'Saved oasis', image: '/cover.jpg', copy: 'Hero copy', isPublished: false, showInDestinations: false, showInOneDayTours: true, displayOrder: 7,
  detail: { heroImage: '/hero.jpg', heroAlt: 'View', eyebrow: 'Region', intro: 'Story', facts: [{ label: 'Stay', value: '2 days' }, { label: 'Climate', value: 'Warm' }], bestFor: ['History', 'Families'], experiences: [{ title: 'Museum', copy: 'Explore', image: '/museum.jpg', alt: 'Museum image' }, { title: 'Desert', copy: 'Walk', image: '/desert.jpg', alt: 'Dunes' }], rhythm: [{ label: 'Morning', title: 'Arrive', copy: 'Relax' }], practical: [{ title: 'Bring', copy: 'Water' }], tourSlugs: ['old-tour'] },
  translations: { es: { title: 'Oasis español', stay: '2 días', bestFor: 'Historia\nFamilias', 'detail.experiences.0.title': 'Museo', 'detail.experiences.1.title': 'Desierto', 'detail.intro': 'Historia local' }, it: { title: 'Oasi italiana', 'detail.experiences.0.title': 'Museo italiano', 'detail.experiences.1.title': 'Deserto', 'detail.intro': 'Storia locale' } },
})
const tour = (slug: string, patch: Partial<Tour> = {}): Tour => ({ slug, title: slug, status: 'published', category: 'one-day-tours', image: '/tour.jpg', summary: 'Trip', price: 125, duration: '1 day', location: 'Oasis', ...patch } as Tour)
const render = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node)
afterEach(() => vi.unstubAllGlobals())

describe('shared destination builder row contracts', () => {
  it('matches the actual public section hierarchy without inventing record sections', () => {
    expect(DESTINATION_SECTION_MAP.map(row => row.id)).toEqual(['hero', 'facts', 'destination-story', 'destination-experiences', 'destination-rhythm', 'destination-practical', 'destination-related', 'destination-plan-cta'])
    const html = render(createElement(DestinationDetailView, { item: source(), relatedTours: [tour('related')], preview: true }))
    const order = ['destination-detail-hero', 'destination-facts', 'destination-story', 'destination-experiences', 'destination-rhythm container', 'destination-practical', 'destination-related', 'destination-plan-cta']
    expect(order.map(name => html.indexOf('class="' + name))).toEqual([...order.map(name => html.indexOf('class="' + name))].sort((a, b) => a - b))
    expect(order.every(name => html.includes('class="' + name))).toBe(true)
  })
  it.each(DESTINATION_REPEATERS)('adds and removes %s without affecting other content or flags', section => {
    const initial = source(), snapshot = JSON.stringify(initial)
    const next = changeDestinationRow(initial, section, 'add')
    expect(next.detail[section]).toHaveLength(initial.detail[section].length + 1)
    expect(changeDestinationRow(next, section, 'remove', next.detail[section].length - 1).detail).toEqual(initial.detail)
    expect(next.isPublished).toBe(false)
    expect(next.showInDestinations).toBe(false)
    expect(next.displayOrder).toBe(7)
    expect(JSON.stringify(initial)).toBe(snapshot)
  })
  it('moves EN/ES/IT item text and media together; removing it cannot resurrect translations', () => {
    const initial = source()
    const moved = changeDestinationRow(initial, 'experiences', 'move', 0, 1)
    expect(moved.detail.experiences.map(row => row.image)).toEqual(['/desert.jpg', '/museum.jpg'])
    expect(moved.translations?.es?.['detail.experiences.1.title']).toBe('Museo')
    expect(moved.translations?.it?.['detail.experiences.0.title']).toBe('Deserto')
    const removed = changeDestinationRow(moved, 'experiences', 'remove', 1)
    expect(removed.translations?.es?.['detail.experiences.1.title']).toBeUndefined()
    const added = changeDestinationRow(removed, 'experiences', 'add')
    expect(destinationPreview(added, [], 'es').item.detail.experiences[1].title).toBe('')
    expect(destinationPreview(added, [], 'it').item.detail.experiences[0].title).toBe('Deserto')
  })
  it('migrates legacy audience/stay aliases to rows before structural editing', () => {
    const normalized = destinationBuilderTranslations(source())
    expect(normalized.es).toMatchObject({ 'detail.facts.0.value': '2 días', 'detail.bestFor.0': 'Historia', 'detail.bestFor.1': 'Familias' })
    expect(normalized.es?.bestFor).toBeUndefined()
    const removed = changeDestinationRow(source(), 'bestFor', 'remove', 0)
    expect(destinationPreview(removed, [], 'es').item.detail.bestFor).toEqual(['Familias'])
    const reordered = changeDestinationRow(source(), 'facts', 'move', 0, 1)
    expect(destinationPreview(reordered, [], 'es').item.detail.facts[1].value).toBe('2 días')
  })
  it('drops stale out-of-range keys before adding rows, and rejects invalid indices', () => {
    const item = source()
    item.translations!.es!['detail.experiences.2.title'] = 'Removed long ago'
    const added = changeDestinationRow(item, 'experiences', 'add')
    expect(destinationPreview(added, [], 'es').item.detail.experiences[2].title).toBe('')
    expect(changeDestinationRow(item, 'facts', 'remove', -1)).toBe(item)
    expect(changeDestinationRow(item, 'facts', 'move', 0, 99)).toBe(item)
  })
  it('keeps explicit empty media/text/lists identical in preview and validated save payloads', () => {
    const item = source()
    item.copy = ''; item.image = ''; item.translations = {}
    item.detail = { ...item.detail, heroImage: '', intro: '', facts: [], bestFor: [], experiences: [], rhythm: [], practical: [] }
    const record = destinationBuilderRecord(item)
    const payload = { ...record, detail: { ...record.detail } }
    expect(() => validateDestinationWrite(payload, true)).not.toThrow()
    expect(destinationPreview(record, [], 'en').item).toEqual(record)
    const html = render(createElement(DestinationPreviewContent, { item: record, tours: [], locale: 'en' }))
    expect(html).not.toContain('src=""')
    expect(html).not.toContain('Museum')
    expect(html).not.toContain('/hero.jpg')
  })
})

describe('real public-style unsaved preview', () => {
  it.each([['en', 'Unsaved name', 'Unsaved story'], ['es', 'Oasis español', 'Historia local'], ['it', 'Oasi italiana', 'Storia locale']] as const)('renders current %s data without catalogue/provider integrations', (locale, title, intro) => {
    const fetcher = vi.fn(() => { throw Error('No preview fetch allowed') }); vi.stubGlobal('fetch', fetcher)
    const item = source(); item.title = 'Unsaved name'; item.detail.intro = 'Unsaved story'
    const html = render(createElement(DestinationPreviewContent, { item, tours: [], locale }))
    expect(html).toContain(`<h1>${title}</h1>`)
    expect(html).toContain(intro)
    expect(html).toContain('inert=""')
    expect(html).toContain('/museum.jpg')
    expect(fetcher).not.toHaveBeenCalled()
    expect(item.title).toBe('Unsaved name')
    expect(item.isPublished).toBe(false)
  })
  it('honors published shared template visibility and ordering in the same renderer', () => {
    const content = originalTemplateContent('destination-detail')
    content.sections = content.sections.filter(section => section.id !== 'destination-practical').concat(content.sections.filter(section => section.id === 'destination-practical')).reverse()
    const experiences = content.sections.find(section => section.id === 'destination-experiences')!
    experiences.visible = false
    const html = render(createElement(PresentationProvider, { states: { 'destination-detail': { content } }, children: createElement(DestinationPreviewContent, { item: source(), tours: [], locale: 'en' }) }))
    expect(html).not.toContain('Museum image')
    expect(html).toContain('Water')
    const visibleIds = content.sections.filter(section => section.visible && section.id !== 'hero' && section.id !== 'destination-related').map(section => section.id)
    const positions = visibleIds.map(id => html.indexOf('class="' + id))
    expect(positions.every(index => index >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a,b) => a-b))
  })
  it('includes published canonical curated and assigned tours while keeping drafts private', () => {
    const item = source(), related = [tour('live', { aliases: ['old-tour'] }), tour('assigned', { destinationSlug: item.slug }), tour('private', { status: 'draft', destinationSlug: item.slug })]
    const preview = destinationPreview(item, related, 'en')
    expect(preview.tours.map(row => row.slug)).toEqual(['live', 'assigned'])
    const html = render(createElement(DestinationPreviewContent, { item, tours: related, locale: 'en' }))
    expect(html).toContain('href="/egypt-tours/live"'); expect(html).toContain('href="/egypt-tours/assigned"')
    expect(html).not.toContain('href="/egypt-tours/private"')
    expect(html).toContain('$125.00'); expect(html).toContain('1 day'); expect(html).toContain('tour-bottom')
    expect(item.isPublished).toBe(false)
  })
  it('sanitizes invalid unsaved media without changing persisted source values', () => {
    const item = source(); item.image = 'javascript:alert(1)'; item.detail.heroImage = '//evil.test/image.jpg'
    const preview = destinationPreview(item, [], 'en')
    expect(preview.item.image).toBe(''); expect(preview.item.detail.heroImage).toBe('')
    expect(item.image).toBe('javascript:alert(1)')
    expect(() => validateCatalogueTranslations('destination', { es: { 'detail.bestFor.0': 'Historia' } })).not.toThrow()
    expect(() => validateCatalogueTranslations('destination', { ar: { title: 'x' } })).toThrow()
  })
  it('includes published appearance tokens in the preview without styling the admin shell', () => {
    const html = render(createElement(PublicAppearance, { tokens: { primary: '#123456', font: 'georgia', h1: 44 }, children: createElement(DestinationPreviewContent, { item: source(), tours: [], locale: 'en' }) }))
    expect(html).toContain('--primary:#123456')
    expect(html).toContain('Georgia, serif')
    expect(html).toContain('font-size:44px')
    expect(html.match(/<style>/g)).toHaveLength(1)
    const admin = render(createElement(PublicAppearance, { tokens: { primary: '#123456' }, children: createElement('div', null, 'Admin') }))
    expect(admin).not.toContain('--primary')
  })
  it('keeps the passive related card identical to the public card apart from disabled actions', () => {
    const item = tour('passive')
    const publicCard = render(createElement(TourCard, { tour: item }))
    const passive = render(createElement(TourCardPresentation, { tour: item, passive: true }))
    expect(passive.replaceAll(' disabled=""', '')).toBe(publicCard)
  })
  it('reuses exactly the public body for empty-related previews', () => {
    const item = source()
    const projection = destinationPreview(item, [], 'it')
    const direct = render(createElement(InitialLocaleProvider, { locale: 'it', preview: true, children: createElement(LocaleProvider, { initialLocale: 'it', children: createElement(DestinationDetailView, { item: projection.item, relatedTours: [], preview: true }) }) }))
    const preview = render(createElement(DestinationPreviewContent, { item, tours: [], locale: 'it' }))
    expect(preview).toContain(direct.slice(direct.indexOf('<main')))
  })
})

describe('section-based builder controls', () => {
  it('exposes all existing section fields, image controls and structural actions on the same editor', () => {
    const item = { ...source(), translations: destinationBuilderTranslations(source()) }
    const onChange = vi.fn(), onUpload = vi.fn(), setTranslations = vi.fn()
    const html = render(createElement(DestinationSectionsEditor, { item, onChange, onUpload, setTranslations }))
    for (const label of ['1. Hero', '2. Facts at a glance', '3. Destination story', '4. Signature experiences', '5. Journey rhythm', '6. Practical information']) expect(html).toContain(label)
    expect(html).toContain('Move experiences item 1 down')
    expect(html).toContain('Remove practical item 1')
    expect(html).toContain('/museum.jpg')
    expect(html).toContain('Add item')
    expect(html).toContain('Español'); expect(html).toContain('Italiano'); expect(html).not.toContain('Arabic')
    const cover = render(createElement(DestinationCoverEditor, { item, onChange, onUpload }))
    expect(cover).toContain('/cover.jpg')
    expect(cover).toContain('/admin/website-cms/pages/destination-detail')
    expect(onChange).not.toHaveBeenCalled(); expect(onUpload).not.toHaveBeenCalled()
  })
})
