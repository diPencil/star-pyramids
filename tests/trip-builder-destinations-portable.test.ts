import { expect, it } from 'vitest'
import type { Destination } from '@/data/types'
import { tripDestinationOptions } from '@/lib/trip-builder-destinations'
import { encodeTourJson, decodeTourJson } from '@/lib/tour-json'
import { editorData } from '@/components/admin/trip-builder'
import { translationTour } from './fixtures/translation-tour'

const destination = { id: 'test-destination', slug: 'cairo', title: 'Cairo', isPublished: false, showInOneDayTours: true, translations: { es: { title: 'El Cairo' }, it: { title: 'Il Cairo' } } } as unknown as Destination
it.each(['en', 'es', 'it'] as const)('offers private Draft destinations using %s names and canonical identities', locale => {
  const option = tripDestinationOptions([destination], locale)[0]
  expect(option.value).toBe('cairo')
  expect(option.label).toContain(locale === 'en' ? 'Cairo' : destination.translations![locale]!.title)
  expect(option.label).toContain(locale === 'en' ? 'Draft' : locale === 'es' ? 'Borrador' : 'Bozza')
})
it('preserves a legacy selected destination while excluding unrelated ineligible rows', () => {
  const hidden = { ...destination, showInOneDayTours: false }
  expect(tripDestinationOptions([hidden], 'en')).toEqual([])
  expect(tripDestinationOptions([hidden], 'en', 'cairo')[0].value).toBe('cairo')
})
it('keeps the destination relationship through real editor loading and JSON serialization', () => {
  const reopened = editorData(decodeTourJson(encodeTourJson(translationTour)))
  expect(reopened.form.destinationSlug).toBe('cairo')
  expect(reopened.form.title).toBe(translationTour.title)
})
