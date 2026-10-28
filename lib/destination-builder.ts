import type { Destination, Tour } from '@/data/types'
import { localizeCatalogue, moveTranslationRow, removeTranslationRow, type CatalogueTranslations } from './catalogue-translations'
import { destinationTours } from './destination-public'
import { isTourImage } from './tour-write'
import type { EnabledLocale } from './locale-config'

export const DESTINATION_REPEATERS = ['facts', 'bestFor', 'experiences', 'rhythm', 'practical'] as const
export type DestinationRepeater = typeof DESTINATION_REPEATERS[number]
export const DESTINATION_SECTION_MAP = [
  { id: 'hero', label: 'Hero', fields: ['title', 'copy', 'detail.heroImage', 'detail.heroAlt', 'detail.eyebrow'] },
  { id: 'facts', label: 'Facts at a glance', fields: ['detail.facts'] },
  { id: 'destination-story', label: 'Destination story', fields: ['detail.intro', 'detail.bestFor'] },
  { id: 'destination-experiences', label: 'Signature experiences', fields: ['detail.experiences'] },
  { id: 'destination-rhythm', label: 'Journey rhythm', fields: ['detail.rhythm', 'detail.heroImage'] },
  { id: 'destination-practical', label: 'Practical information', fields: ['detail.practical'] },
  { id: 'destination-related', label: 'Related trips', fields: ['detail.tourSlugs', 'tour.destinationSlug'] },
  { id: 'destination-plan-cta', label: 'Planning CTA', fields: ['image', 'title'] },
] as const

/** Migrate legacy display aliases into index-aligned text without changing the stored English record. */
export function destinationBuilderTranslations(item: Destination): CatalogueTranslations {
  const result = structuredClone(item.translations ?? {})
  for (const entries of Object.values(result)) {
    if (!entries) continue
    if (entries.stay && item.detail.facts.length) entries['detail.facts.0.value'] ??= entries.stay
    if (entries.bestFor) entries.bestFor.split('\n').map(text => text.trim()).filter(Boolean).slice(0, item.detail.bestFor.length)
      .forEach((text, index) => { entries[`detail.bestFor.${index}`] ??= text })
    delete entries.stay
    delete entries.bestFor
    for (const key of Object.keys(entries)) {
      const match = /^detail\.(facts|bestFor|experiences|rhythm|practical)\.(\d+)(?:\.|$)/.exec(key)
      if (match && Number(match[2]) >= item.detail[match[1] as DestinationRepeater].length) delete entries[key]
    }
  }
  return result
}

const blank = (section: DestinationRepeater) => ({
  facts: { label: '', value: '' }, bestFor: '', experiences: { title: '', copy: '', image: '', alt: '' },
  rhythm: { label: '', title: '', copy: '' }, practical: { title: '', copy: '' },
})[section]

/** English array order is authoritative; translations move/remove with their owning row. */
export function changeDestinationRow(item: Destination, section: DestinationRepeater, action: 'add' | 'remove' | 'move', index = 0, target = index): Destination {
  const rows: unknown[] = [...item.detail[section]]
  let translations = destinationBuilderTranslations(item)
  const prefix = `detail.${section}`
  if (action === 'add') {
    if (rows.length >= 100) return item
    rows.push(blank(section))
  } else {
    if (!Number.isInteger(index) || index < 0 || index >= rows.length) return item
    if (action === 'remove') { rows.splice(index, 1); translations = removeTranslationRow(translations, prefix, index) }
    else {
      if (!Number.isInteger(target) || target < 0 || target >= rows.length) return item
      rows.splice(target, 0, rows.splice(index, 1)[0])
      translations = moveTranslationRow(translations, prefix, index, target)
    }
  }
  return { ...item, translations, detail: { ...item.detail, [section]: rows } }
}

/** Same explicit values go to preview and save; no truthy defaults can resurrect clears. */
export function destinationBuilderRecord(item: Destination): Destination {
  return structuredClone(item)
}

export function destinationPreview(item: Destination, tours: readonly Tour[], locale: EnabledLocale) {
  const source = destinationBuilderRecord(item)
  // A draft must be previewable without becoming public.
  const related = destinationTours({ ...source, isPublished: true }, tours)
  const localized = localizeCatalogue(source, 'destination', locale)
  const safeImage = (value: string) => value && isTourImage(value) ? value : ''
  return {
    item: { ...localized, image: safeImage(localized.image), detail: { ...localized.detail,
      heroImage: safeImage(localized.detail.heroImage),
      experiences: localized.detail.experiences.map(row => ({ ...row, image: safeImage(row.image) })),
    } },
    tours: related,
  }
}
