import type { Metadata } from 'next'
import { localizeCatalogue, type CatalogueKind, type TranslatedContent } from './catalogue-translations'
import { getOgLocale, getServerLocale } from './server/locale'
import { attachCatalogueTranslations } from './server/catalogue-translations'
import { getHreflangEntries, getSiteUrl } from './seo'
import { getPublishedRecordSeo } from './server/record-seo'
import { getGlobalSeo } from './server/global-seo'

import type { RecordSeoKind } from './record-seo'
export type { RecordSeoKind } from './record-seo'

export function publicRecordCanonical(value?: string): string | undefined {
  if (!value || !/^\/(?!\/)[a-z0-9/-]*$/.test(value) || value.includes('//')) return undefined
  if (/^\/(admin|account|api|checkout|cart|login|register|forgot-password|reset-password|search|booking|website-cms-preview|verify-voucher|rent-car\/request)(\/|$)/.test(value)) return undefined
  return value
}

async function publishedMetadata(base: Metadata, kind: RecordSeoKind, slug: string, path: string): Promise<Metadata> {
  const locale = await getServerLocale()
  let seoReadFailed = false
  const seo = await getPublishedRecordSeo(kind, slug).catch(() => { seoReadFailed = true; return null })
  const defaults = await getGlobalSeo(locale).catch(() => ({} as Metadata))
  const copy = seo?.text[locale]
  const title = copy?.title?.trim()
  const description = copy?.description?.trim()
  const canonical = `${await getSiteUrl()}${publicRecordCanonical(seo?.canonical) || path}`
  const ogTitle = copy?.ogTitle?.trim() || title
  const ogDescription = copy?.ogDescription?.trim() || description
  const images = seo?.image || undefined
  const baseOg = base.openGraph
  const baseTwitter = base.twitter
  return {
    ...base,
    ...(title ? { title: { absolute: title } } : {}),
    ...(description ? { description } : {}),
    alternates: { canonical, languages: await getHreflangEntries(publicRecordCanonical(seo?.canonical) || path) },
    ...(seoReadFailed ? { robots: { index: false, follow: false } }
      : seo?.index !== undefined || seo?.follow !== undefined ? { robots: { index: seo.index ?? true, follow: seo.follow ?? true } } : {}),
    openGraph: { ...defaults.openGraph, ...baseOg,
      ...(!images && Array.isArray(baseOg?.images) && !baseOg.images.length && defaults.openGraph?.images ? { images: defaults.openGraph.images } : {}),
      url: canonical, ...(title || description || ogTitle || ogDescription ? { locale: getOgLocale(locale) } : {}),
      ...(ogTitle ? { title: ogTitle } : {}), ...(ogDescription ? { description: ogDescription } : {}),
      ...(images ? { images: [{ url: images }] } : {}),
    },
    twitter: { ...defaults.twitter, ...baseTwitter,
      ...(!images && Array.isArray(baseTwitter?.images) && !baseTwitter.images.length && defaults.twitter?.images ? { images: defaults.twitter.images } : {}),
      ...(ogTitle ? { title: ogTitle } : {}), ...(ogDescription ? { description: ogDescription } : {}),
      ...(images ? { images: [images] } : {}), ...(seo?.card ? { card: seo.card } : {}),
    },
  }
}

export async function recordStructuredDataEnabled(kind: RecordSeoKind, slug: string): Promise<boolean> {
  try { return (await getPublishedRecordSeo(kind, slug))?.structuredData !== false }
  catch { return false }
}

type DynamicRecord = { slug: string; title: string; image?: string; summary?: string; excerpt?: string; copy?: string } & TranslatedContent
type DynamicKind = Exclude<CatalogueKind, 'category' | 'car'> | 'tour'

export async function dynamicCategorySeo(record: { slug: string; name: string; copy: string; image?: string } & TranslatedContent, route: string): Promise<Metadata> {
  const requestedLocale = await getServerLocale()
  const [source] = await attachCatalogueTranslations('category', [record])
  const locale = source.translations?.[requestedLocale]?.name?.trim() ? requestedLocale : 'en'
  const localized = localizeCatalogue(source, 'category', locale)
  const title = `${localized.name.trim()} | STAR PYRAMIDS`
  const description = (locale === 'en' ? source.copy : source.translations?.[locale]?.copy)?.trim().slice(0, 160)
    || localized.name.trim().slice(0, 160)
  const path = `${route}/${record.slug}`
  const canonical = `${await getSiteUrl()}${path}`
  const images = record.image ? [record.image] : []
  return publishedMetadata({
    title: { absolute: title },
    description,
    alternates: { canonical, languages: await getHreflangEntries(path) },
    openGraph: { title, description, url: canonical, locale: getOgLocale(locale), type: 'website', images: images.map((url) => ({ url })) },
    twitter: { card: 'summary_large_image', title, description, images },
  }, 'category', record.slug, path)
}

export async function dynamicSeo(record: DynamicRecord, kind: DynamicKind, route: string): Promise<Metadata> {
  const requestedLocale = await getServerLocale()
  // These repositories do not yet attach their existing catalogue translations.
  const source = kind === 'destination' || kind === 'event' || kind === 'offer'
    ? (await attachCatalogueTranslations(kind, [record]))[0]
    : record
  const locale = kind !== 'tour' && source.translations?.[requestedLocale]?.title?.trim()
    ? requestedLocale : 'en'
  const localized = kind === 'tour' ? source : localizeCatalogue(source, kind, locale)
  const field = kind === 'tour' ? 'summary' : kind === 'blog' ? 'excerpt' : 'copy'
  const title = `${localized.title.trim()} | STAR PYRAMIDS`
  // A translated title alone is preferable to appending English prose or invented claims.
  const description = (locale === 'en' ? source[field] : source.translations?.[locale]?.[field])?.trim().slice(0, 160)
    || localized.title.trim().slice(0, 160)
  const path = `${route}/${record.slug}`
  const canonical = `${await getSiteUrl()}${path}`
  const images = record.image ? [record.image] : []
  return publishedMetadata({
    title: { absolute: title },
    description,
    alternates: { canonical, languages: await getHreflangEntries(path) },
    openGraph: { title, description, url: canonical, locale: getOgLocale(locale), type: kind === 'blog' || kind === 'event' ? 'article' : 'website', images: images.map((url) => ({ url })) },
    twitter: { card: 'summary_large_image', title, description, images },
  }, kind, record.slug, path)
}
