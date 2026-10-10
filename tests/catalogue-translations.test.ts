import { describe, expect, it } from 'vitest'
import { alignTranslationRows, localizeCatalogue, removeTranslationRow, validateCatalogueTranslations, type CatalogueKind } from '@/lib/catalogue-translations'

describe('catalogue translation boundaries', () => {
  it.each([
    ['destination', 'title'], ['category', 'name'], ['event', 'intro'],
    ['offer', 'badge'], ['blog', 'excerpt'], ['car', 'copy'],
  ] as const)('accepts actual %s text fields and round trips JSON', (kind, key) => {
    const translations = { es: { [key]: 'Texto español' }, it: { [key]: 'Testo italiano' } }
    expect(validateCatalogueTranslations(kind, JSON.parse(JSON.stringify(translations)))).toEqual(translations)
  })

  it.each(['destination', 'category', 'event', 'offer', 'blog', 'car'] as CatalogueKind[])('rejects changes to shared values for %s', (kind) => {
    for (const key of ['slug', 'price', 'dailyPrice', 'image', 'isPublished', '__proto__']) {
      expect(() => validateCatalogueTranslations(kind, { es: { [key]: 'changed' } })).toThrow()
    }
  })

  it('rejects disabled languages, non-text values and oversized input', () => {
    expect(() => validateCatalogueTranslations('car', { ar: { title: 'نص' } })).toThrow()
    expect(() => validateCatalogueTranslations('car', { en: { title: 'text' } })).toThrow()
    expect(() => validateCatalogueTranslations('car', { es: { title: 100 } })).toThrow()
    expect(() => validateCatalogueTranslations('car', { es: { title: 'x'.repeat(10001) } })).toThrow()
  })

  it('preserves shared values and English fallback without mutating the source', () => {
    const source = { slug: 'car', title: 'Vehicle', copy: 'English description', dailyPrice: 45, image: '/car.jpg', translations: { es: { title: 'Vehículo', price: '0' } } }
    const spanish = localizeCatalogue(source, 'car', 'es')
    expect(spanish.title).toBe('Vehículo')
    expect(spanish.copy).toBe('English description')
    expect(spanish.dailyPrice).toBe(45)
    expect(spanish.image).toBe('/car.jpg')
    expect(source.title).toBe('Vehicle')
    expect(localizeCatalogue(source, 'car', 'en')).toBe(source)
    expect(localizeCatalogue(source, 'car', 'it')).toBe(source)
  })

  it('overlays lists and paragraphs while preserving unedited destination content', () => {
    const source = { slug: 'cairo', title: 'Cairo', copy: 'Copy', detail: { intro: 'Intro', facts: [{ label: 'Stay', value: '2 days' }], bestFor: ['History'], experiences: [{ title: 'Existing' }] }, translations: { es: { copy: 'Descripción', stay: '2 días', bestFor: 'Historia\nFamilias' } } }
    const translated = localizeCatalogue(source, 'destination', 'es')
    expect(translated.detail.intro).toBe('Descripción')
    expect(translated.detail.facts[0].value).toBe('2 días')
    expect(translated.detail.bestFor).toEqual(['Historia', 'Familias'])
    expect(translated.detail.experiences).toEqual(source.detail.experiences)
  })

  it('keeps event prices and schedule intact while translating repeatable text', () => {
    const source = { slug: 'event', date: 'October 20, 2026', startDate: '2026-10-20', addOns: [{ title: 'Transfer', price: 25 }], program: [{ day: 'Day 1', title: 'Arrival', description: 'English' }], included: ['Guide'], translations: { it: { 'addOns.0.title': 'Trasferimento', 'program.0.title': 'Arrivo', 'included.0': 'Guida', date: 'bad date' } } }
    const translated = localizeCatalogue(source, 'event', 'it')
    expect(translated.addOns).toEqual([{ title: 'Trasferimento', price: 25 }])
    expect(translated.program[0].title).toBe('Arrivo')
    expect(translated.included).toEqual(['Guida'])
    expect(translated.startDate).toBe(source.startDate)
    expect(translated.date).toBe(source.date)
  })

  it('shifts all locales together when a repeated row is removed', () => {
    const translations = { es: { 'program.0.title': 'Uno', 'program.1.title': 'Dos', title: 'Evento' }, it: { 'program.1.title': 'Due' } }
    expect(removeTranslationRow(translations, 'program', 0)).toEqual({ es: { 'program.0.title': 'Dos', title: 'Evento' }, it: { 'program.0.title': 'Due' } })
  })

  it('reindexes blank English rows on save, and rejects translated rows that would be lost', () => {
    expect(alignTranslationRows({ es: { 'program.1.title': 'Uno' } }, 'program', [1])).toEqual({ es: { 'program.0.title': 'Uno' } })
    expect(() => alignTranslationRows({ es: { 'program.0.title': 'Uno' } }, 'program', [1])).toThrow('Complete the English')
  })
})
