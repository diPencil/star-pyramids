import { describe, expect, it } from 'vitest'
import { localizePublicTour } from '@/lib/tours/tour-public-locale'
import { translationTour } from './fixtures/translation-tour'

describe('public translation identity and financial isolation', () => {
  it.each(['es', 'it'] as const)('localizes %s content without mutating storage or booking identity', locale => {
    const source = structuredClone(translationTour), before = structuredClone(source)
    const result = localizePublicTour(source, locale)
    expect(result.title).toBe(source.dayDetail!.translations![locale]!.title)
    expect(result.dayDetail!.stops![0].meals).toBe(source.dayDetail!.stops![0].translations![locale]!.meals)
    expect(result.dayDetail!.addOns![0].title).toBe(source.dayDetail!.addOns![0].translations![locale]!.title)
    expect(result.price).toBe(source.price)
    expect(result.dayDetail!.travelerPrices).toEqual(source.dayDetail!.travelerPrices)
    expect(result.dayDetail!.addOns![0].price).toBe(5)
    expect(result.slug).toBe(source.slug)
    expect(result.status).toBe('draft')
    expect(source).toEqual(before)
  })
  it('keeps English canonical and falls back for a missing translated field', () => {
    const source = structuredClone(translationTour)
    source.dayDetail!.translations!.es!.title = ' '
    expect(localizePublicTour(source, 'en')).toBe(source)
    expect(localizePublicTour(source, 'es').title).toBe(source.title)
  })
})
