import { ENABLED_LOCALES, type Locale } from './locale-config'

export type CatalogueKind = 'destination' | 'category' | 'event' | 'offer' | 'blog' | 'car'
export type CatalogueTranslations = Partial<Record<Locale, Record<string, string>>>
export type TranslatedContent = { translations?: CatalogueTranslations }

export function vehicleTransmissionLabel(value: string, locale: Locale): string {
  const labels: Record<string, Partial<Record<Locale, string>>> = {
    Automatic: { es: 'Automático', it: 'Automatico', ar: 'أوتوماتيك' },
    Manual: { es: 'Manual', it: 'Manuale', ar: 'يدوي' },
  }
  return labels[value]?.[locale] ?? value
}

const fields: Record<CatalogueKind, RegExp> = {
  destination: /^(title|copy|stay|bestFor)$/,
  category: /^(name|copy)$/,
  event: /^(title|category|copy|intro|location|venueName|address|city|organizerName|included\.\d+|excluded\.\d+|highlights\.\d+\.(title|description)|program\.\d+\.(day|title|description)|addOns\.\d+\.title)$/,
  offer: /^(title|badge|copy|duration|highlights)$/,
  blog: /^(title|category|excerpt)$/,
  car: /^(title|copy)$/,
}

export function validateCatalogueTranslations(kind: CatalogueKind, value: unknown): CatalogueTranslations {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid translations.')
  const result: CatalogueTranslations = {}
  let count = 0
  for (const [locale, entries] of Object.entries(value)) {
    if (!ENABLED_LOCALES.some((entry) => entry === locale) || locale === 'en' || !entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('Invalid translation language.')
    const next: Record<string, string> = {}
    for (const [key, text] of Object.entries(entries)) {
      if (++count > 500 || !fields[kind].test(key) || key.length > 160 || typeof text !== 'string' || text.length > 10000) throw new Error('Invalid translation field or length.')
      if (text.trim()) next[key] = text
    }
    if (Object.keys(next).length) result[locale as Locale] = next
  }
  if (JSON.stringify(result).length > 100000) throw new Error('Translations are too large.')
  return result
}

/** Reindex text keys when an English repeatable item is removed. */
export function removeTranslationRow(value: CatalogueTranslations, prefix: string, index: number): CatalogueTranslations {
  const result: CatalogueTranslations = {}
  for (const [locale, entries] of Object.entries(value)) {
    const next: Record<string, string> = {}
    for (const [key, text] of Object.entries(entries ?? {})) {
      if (!key.startsWith(`${prefix}.`)) { next[key] = text; continue }
      const parts = key.split('.')
      const position = Number(parts[1])
      if (position === index) continue
      if (position > index) parts[1] = String(position - 1)
      next[parts.join('.')] = text
    }
    result[locale as Locale] = next
  }
  return result
}

export function alignTranslationRows(value: CatalogueTranslations, prefix: string, retainedIndices: readonly number[]): CatalogueTranslations {
  const result: CatalogueTranslations = {}
  for (const [locale, entries] of Object.entries(value)) {
    const next: Record<string, string> = {}
    for (const [key, text] of Object.entries(entries ?? {})) {
      if (!key.startsWith(`${prefix}.`)) { next[key] = text; continue }
      const parts = key.split('.')
      const position = retainedIndices.indexOf(Number(parts[1]))
      if (position < 0) {
        if (text.trim()) throw new Error('Complete the English content for translated items before saving.')
        continue
      }
      parts[1] = String(position)
      next[parts.join('.')] = text
    }
    result[locale as Locale] = next
  }
  return result
}

/** Only text fields can be overlaid; financial values and identity never change. */
export function localizeCatalogue<T extends { slug: string } & TranslatedContent>(item: T, kind: CatalogueKind, locale: Locale): T {
  const values = item.translations?.[locale]
  if (!values || locale === 'en') return item
  const result: Record<string, unknown> = { ...item }
  const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean)
  for (const [key, text] of Object.entries(values)) {
    if (!text.trim() || !fields[kind].test(key)) continue
    if (kind === 'destination') {
      const detail = { ...(result.detail as Record<string, unknown>) }
      if (key === 'stay') {
        const facts = detail.facts as { label: string; value: string }[] | undefined
        if (facts?.length) detail.facts = facts.map((fact, index) => index === 0 ? { ...fact, value: text } : fact)
      } else if (key === 'bestFor') detail.bestFor = lines(text)
      else { result[key] = text; if (key === 'copy') detail.intro = text; if (key === 'title') detail.heroAlt = text }
      result.detail = detail
    } else if (kind === 'event' && key.includes('.')) {
      const [name, rawIndex, field] = key.split('.')
      const array = result[name]
      if (!Array.isArray(array)) continue
      result[name] = array.map((entry: unknown, index: number) => index !== Number(rawIndex) ? entry : field && entry && typeof entry === 'object' ? { ...entry, [field]: text } : text)
    } else result[key] = kind === 'offer' && key === 'highlights' ? lines(text) : text
  }
  return result as T
}
