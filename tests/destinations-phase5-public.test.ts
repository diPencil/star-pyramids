import { describe, expect, it } from 'vitest'
import type { Destination, Tour } from '@/data/types'
import { destinationTours, listedDestinations } from '@/lib/destination-public'
import { localizeCatalogue, validateCatalogueTranslations } from '@/lib/catalogue-translations'

const destination: Destination = { slug: 'cairo', title: 'Cairo', copy: 'Copy', image: '/cairo.jpg', detail: {
  heroImage: '/hero.jpg', heroAlt: 'Cairo view', eyebrow: 'Discover', intro: 'Intro',
  facts: [{ label: 'Stay', value: '2 days' }], bestFor: ['History'],
  experiences: [{ title: 'Museum', copy: 'Visit', image: '/museum.jpg', alt: 'Museum view' }],
  rhythm: [{ label: 'Day 1', title: 'Arrive', copy: 'Explore' }], practical: [{ title: 'Pack', copy: 'Water' }],
  tourSlugs: ['alias', 'first', 'draft', 'missing'],
} }
const tour = (slug: string, extra: Partial<Tour> = {}): Tour => ({ slug, title: slug, status: 'published', ...extra } as Tour)

describe('destination publication and trip membership', () => {
  it.each([true, false])('separates listing visibility from publication: %s', published => {
    const rows = [true, false].map(showInDestinations => ({ ...destination, isPublished: published, showInDestinations }))
    expect(listedDestinations(rows)).toHaveLength(published ? 1 : 0)
  })
  it('preserves excluded published one-day destinations and canonicalizes explicit alias links', () => {
    const rows = [tour('first', { aliases: ['alias'] }), tour('associated', { destinationSlug: 'cairo' }), tour('draft', { destinationSlug: 'cairo', status: 'draft' }), tour('other')]
    expect(destinationTours({ ...destination, showInDestinations: false }, rows).map(row => row.slug)).toEqual(['first', 'associated'])
    expect(destinationTours({ ...destination, isPublished: false }, rows)).toEqual([])
    expect(rows).toHaveLength(4)
  })
  it('never restores deleted or unpublished explicit tour references', () => {
    expect(destinationTours(destination, [tour('draft', { status: 'draft' })])).toEqual([])
  })
  it('gives canonical identities precedence over conflicting legacy aliases', () => {
    expect(destinationTours({ ...destination, detail: { ...destination.detail, tourSlugs: ['first'] } }, [tour('other', { aliases: ['first'] }), tour('first')]).map(row => row.slug)).toEqual(['first'])
  })
})

describe('destination complete EN/ES/IT text contract', () => {
  const translated = {
    'detail.intro': 'Introducción', copy: 'Resumen', title: 'El Cairo',
    'detail.heroAlt': 'Vista', 'detail.eyebrow': 'Descubrir',
    'detail.facts.0.label': 'Estancia', 'detail.facts.0.value': '2 días',
    'detail.experiences.0.title': 'Museo', 'detail.experiences.0.copy': 'Visita', 'detail.experiences.0.alt': 'El museo',
    'detail.rhythm.0.label': 'Día 1', 'detail.rhythm.0.title': 'Llegada', 'detail.rhythm.0.copy': 'Explora',
    'detail.practical.0.title': 'Prepara', 'detail.practical.0.copy': 'Agua', bestFor: 'Historia\nFamilias',
  }
  it('persists validated nested translations and keeps originals/media/identity immutable', () => {
    const original = JSON.stringify(destination)
    const translations = validateCatalogueTranslations('destination', { es: translated, it: { title: 'Il Cairo' } })
    const result = localizeCatalogue({ ...destination, translations }, 'destination', 'es')
    expect(result.title).toBe('El Cairo')
    expect(result.detail.intro).toBe('Introducción')
    expect(result.detail.heroAlt).toBe('Vista')
    expect(result.detail.experiences[0]).toEqual({ title: 'Museo', copy: 'Visita', alt: 'El museo', image: '/museum.jpg' })
    expect(result.detail.facts[0]).toEqual({ label: 'Estancia', value: '2 días' })
    expect(result.detail.rhythm[0].title).toBe('Llegada')
    expect(result.detail.practical[0].copy).toBe('Agua')
    expect(result.detail.bestFor).toEqual(['Historia', 'Familias'])
    expect(result.slug).toBe('cairo')
    expect(result.detail.tourSlugs).toEqual(destination.detail.tourSlugs)
    expect(JSON.stringify(destination)).toBe(original)
    expect(localizeCatalogue({ ...destination, translations }, 'destination', 'it').detail).toEqual({ ...destination.detail, heroAlt: 'Il Cairo' })
  })
  it('ignores orphan translations rather than inventing removed repeatable items', () => {
    const result = localizeCatalogue({ ...destination, translations: { es: { 'detail.experiences.99.title': 'Removed' } } }, 'destination', 'es')
    expect(result.detail.experiences).toEqual(destination.detail.experiences)
  })
  it.each(['detail.heroImage', 'detail.tourSlugs.0', 'detail.__proto__.title', 'detail.experiences.0.image', 'isPublished'])('rejects translated identity, media or status: %s', key => {
    expect(() => validateCatalogueTranslations('destination', { es: { [key]: 'changed' } })).toThrow()
  })
  it('keeps Arabic disabled and safely falls back to English', () => {
    expect(() => validateCatalogueTranslations('destination', { ar: { title: 'x' } })).toThrow()
    expect(localizeCatalogue(destination, 'destination', 'es')).toBe(destination)
    expect(localizeCatalogue(destination, 'destination', 'en')).toBe(destination)
  })
})
