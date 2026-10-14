import type { Metadata } from 'next'
import { ENABLED_LOCALES, type EnabledLocale } from './locale-config'
import { validateHeroMedia } from './website-heroes'

export type SeoContent = {
  text: Record<EnabledLocale, { title: string; description: string; ogTitle?: string; ogDescription?: string }>
  image: string
  canonical?: string
  index?: boolean
  follow?: boolean
  card?: 'summary' | 'summary_large_image'
}
export function validateSeoContent(input: unknown): SeoContent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid SEO content.')
  const raw = input as Record<string, unknown>
  if (Object.keys(raw).some(key => !['text', 'image', 'canonical', 'index', 'follow', 'card'].includes(key))) throw new Error('Unsupported SEO field.')
  const clean = (value: unknown, max: number): string => {
    if (typeof value !== 'string' || value.length > max || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('Invalid SEO text.')
    return value.trim()
  }
  if (!raw.text || typeof raw.text !== 'object' || Array.isArray(raw.text)) throw new Error('Supply EN, ES and IT metadata.')
  if (Object.keys(raw.text).some(key => !ENABLED_LOCALES.includes(key as EnabledLocale))) throw new Error('Unsupported SEO language.')
  const text = Object.fromEntries(ENABLED_LOCALES.map(locale => {
    const entry = (raw.text as Record<string, unknown>)[locale]
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Supply EN, ES and IT metadata.')
    const fields = entry as Record<string, unknown>
    if (Object.keys(fields).some(key => !['title', 'description', 'ogTitle', 'ogDescription'].includes(key))) throw new Error('Unsupported localized SEO field.')
    return [locale, { title: clean(fields.title, 160), description: clean(fields.description, 320), ...(fields.ogTitle === undefined ? {} : { ogTitle: clean(fields.ogTitle, 160) }), ...(fields.ogDescription === undefined ? {} : { ogDescription: clean(fields.ogDescription, 320) }) }]
  })) as SeoContent['text']
  const result: SeoContent = { text, image: validateHeroMedia(raw.image, 'image', true) }
  if (raw.canonical !== undefined) {
    const canonical = clean(raw.canonical, 2000)
    if (canonical && (!/^\/(?!\/)[a-z0-9/-]*$/.test(canonical) || canonical.includes('//'))) throw new Error('Canonical must be a public site path, without query or fragment.')
    if (/^\/(admin|account|api|checkout|cart|login|register|forgot-password|reset-password|search|booking|website-cms-preview|verify-voucher|rent-car\/request)(\/|$)/.test(canonical)) throw new Error('Private canonical destinations are not allowed.')
    result.canonical = canonical
  }
  for (const field of ['index', 'follow'] as const) if (raw[field] !== undefined) {
    if (typeof raw[field] !== 'boolean') throw new Error('Invalid robots option.')
    result[field] = raw[field]
  }
  if (raw.card !== undefined) {
    if (raw.card !== 'summary' && raw.card !== 'summary_large_image') throw new Error('Invalid social card.')
    result.card = raw.card
  }
  return result
}
export function seoMetadata(seo: SeoContent, locale: EnabledLocale, siteUrl: string): Metadata {
  const copy = seo.text[locale]
  const title = copy.ogTitle || copy.title
  const description = copy.ogDescription || copy.description
  return {
    ...(copy.title ? { title: { absolute: copy.title } } : {}),
    ...(copy.description ? { description: copy.description } : {}),
    ...(seo.canonical ? { alternates: { canonical: siteUrl + seo.canonical, languages: { en: siteUrl + seo.canonical, 'x-default': siteUrl + seo.canonical } } } : {}),
    ...(seo.index !== undefined || seo.follow !== undefined ? { robots: { index: seo.index ?? true, follow: seo.follow ?? true } } : {}),
    ...(title || description || seo.image || seo.card !== undefined ? {
      openGraph: { ...(title ? { title } : {}), ...(description ? { description } : {}), locale: { en: 'en_US', es: 'es_ES', it: 'it_IT' }[locale], ...(seo.image ? { images: [{ url: seo.image }] } : {}) },
      twitter: { card: seo.card ?? 'summary_large_image', ...(title ? { title } : {}), ...(description ? { description } : {}), ...(seo.image ? { images: [seo.image] } : {}) },
    } : {}),
  }
}
