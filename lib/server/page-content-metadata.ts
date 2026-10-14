import 'server-only'
import type { Metadata } from 'next'
import { isPageDocumentId } from '../additional-page-content'
import { currentSeo, type SeoPageId } from '../seo-manager'
import { readSeoState } from './seo-manager'
import { readPublishedPage } from './page-sections'
import { getServerLocale } from './locale'
import { seoMetadata } from '../seo-content'
import { getSiteUrl } from '../seo'
import { getGlobalSeo } from './global-seo'

async function withGlobalSocial(metadata: Metadata, locale: string): Promise<Metadata> {
  const defaults = await getGlobalSeo(locale).catch(() => ({} as Metadata))
  return { ...metadata, ...(defaults.openGraph || metadata.openGraph ? { openGraph: { ...defaults.openGraph, ...metadata.openGraph } } : {}), ...(defaults.twitter || metadata.twitter ? { twitter: { ...defaults.twitter, ...metadata.twitter } } : {}) }
}

export async function pageContentMetadata(pageId: SeoPageId): Promise<Metadata> {
  if (!isPageDocumentId(pageId)) {
    try { const state = await readSeoState(pageId); const locale = await getServerLocale(); return state.seoManaged ? withGlobalSocial(seoMetadata(currentSeo(state, pageId), locale, await getSiteUrl()), locale) : {} }
    catch { return {} }
  }
  const [state, locale] = await Promise.all([readPublishedPage(pageId), getServerLocale()])
  const seo = state.content?.seo
  if (!seo || state.unavailable) return {}
  return withGlobalSocial(seoMetadata(seo, locale, await getSiteUrl()), locale)
}
