import type { Locale } from './locale-config'
import { safeCampaignHref } from './marketing-campaigns'

/**
 * Footer accessibility strip (the dark notice above the footer) — a
 * permanent informational notice, NOT a commercial offer. Admins may
 * override its copy, CTA and visibility through the Website Settings
 * workflow (`site.accessStrip` JSON document); every field left empty
 * falls back to the built-in defaults below so an unconfigured shop
 * renders exactly as before.
 */

export const ACCESS_STRIP_DEFAULT_HREF = '/accessible-travel'

export const ACCESS_STRIP_DEFAULT_NOTE: Record<Locale, string> = {
  en: '5% discount on all our tour packages for guests requiring accessibility assistance.',
  ar: 'خصم 5% على كل باقات الرحلات لضيوفنا من ذوي الاحتياجات الخاصة.',
  es: '5% de descuento en todos nuestros paquetes para huéspedes que necesiten asistencia de accesibilidad.',
  it: 'Sconto del 5% su tutti i nostri pacchetti per gli ospiti che necessitano di assistenza per l’accessibilità.',
}

export const ACCESS_STRIP_DEFAULT_CTA_LABEL: Record<Locale, string> = {
  en: 'Read More',
  ar: 'اقرأ المزيد',
  es: 'Leer más',
  it: 'Leggi di più',
}

export type AccessStripOverride = {
  visible: boolean
  note: Partial<Record<Locale, string>>
  ctaLabel: Partial<Record<Locale, string>>
  ctaHref: string
}

const LOCALES: readonly Locale[] = ['en', 'es', 'it', 'ar']

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code < 32 || code === 127) return true
  }
  return false
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max || hasControlChars(trimmed)) return ''
  return trimmed
}

function cleanLocaleMap(value: unknown, max: number): Partial<Record<Locale, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const next: Partial<Record<Locale, string>> = {}
  for (const locale of LOCALES) {
    const text = cleanText(source[locale], max)
    if (text) next[locale] = text
  }
  return next
}

function readSource(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      return parsed as Record<string, unknown>
    } catch {
      return null
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return null
}

/**
 * Tolerant reader for render paths. Returns null when no override is
 * configured; unknown fields are ignored and an unsafe CTA destination
 * degrades to the default link instead of breaking the strip.
 */
export function readAccessStrip(value: unknown): AccessStripOverride | null {
  const source = readSource(value)
  if (!source) return null
  const href = cleanText(source.ctaHref, 2000)
  return {
    visible: source.visible === undefined ? true : source.visible === true,
    note: cleanLocaleMap(source.note, 500),
    ctaLabel: cleanLocaleMap(source.ctaLabel, 120),
    ctaHref: href && safeCampaignHref(href) ? href : '',
  }
}

/**
 * Strict validator for the admin settings write path. Throws on wrong
 * types, overlong copy, or an unsafe CTA destination.
 */
export function validateAccessStrip(value: unknown): AccessStripOverride {
  const source = readSource(value)
  if (!source) throw new Error('Invalid accessibility strip settings.')
  if (source.visible !== undefined && typeof source.visible !== 'boolean') {
    throw new Error('Invalid accessibility strip visibility.')
  }
  if (source.note !== undefined && (typeof source.note !== 'object' || source.note === null || Array.isArray(source.note))) {
    throw new Error('Invalid accessibility strip text.')
  }
  if (source.ctaLabel !== undefined && (typeof source.ctaLabel !== 'object' || source.ctaLabel === null || Array.isArray(source.ctaLabel))) {
    throw new Error('Invalid accessibility strip button text.')
  }
  const note = cleanLocaleMap(source.note, 500)
  const ctaLabel = cleanLocaleMap(source.ctaLabel, 120)
  if (source.note && typeof source.note === 'object' && !Array.isArray(source.note)) {
    for (const [locale, text] of Object.entries(source.note as Record<string, unknown>)) {
      if (!(LOCALES as readonly string[]).includes(locale)) throw new Error('Invalid accessibility strip language.')
      if (typeof text === 'string' && text.trim() && !note[locale as Locale]) throw new Error('Invalid accessibility strip text.')
    }
  }
  if (source.ctaLabel && typeof source.ctaLabel === 'object' && !Array.isArray(source.ctaLabel)) {
    for (const [locale, text] of Object.entries(source.ctaLabel as Record<string, unknown>)) {
      if (!(LOCALES as readonly string[]).includes(locale)) throw new Error('Invalid accessibility strip language.')
      if (typeof text === 'string' && text.trim() && !ctaLabel[locale as Locale]) throw new Error('Invalid accessibility strip button text.')
    }
  }
  const rawHref = typeof source.ctaHref === 'string' ? source.ctaHref.trim() : ''
  if (rawHref && !safeCampaignHref(rawHref)) {
    throw new Error('Use a website path or a valid HTTPS link for the accessibility strip button.')
  }
  return { visible: source.visible === undefined ? true : source.visible === true, note, ctaLabel, ctaHref: rawHref }
}

export type ResolvedAccessStrip = { visible: boolean; note: string; ctaLabel: string; ctaHref: string }

/**
 * Resolves one locale view. Empty fields mean "no override" — the caller
 * renders the built-in defaults for those fields.
 */
export function resolveAccessStrip(override: AccessStripOverride | null, locale: Locale): ResolvedAccessStrip {
  return {
    visible: override?.visible !== false,
    note: override?.note[locale] ?? '',
    ctaLabel: override?.ctaLabel[locale] ?? '',
    ctaHref: override?.ctaHref ?? '',
  }
}
