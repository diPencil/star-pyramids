import 'server-only'
import type { Metadata } from 'next'
import type { PageDocumentId } from '../additional-page-content'
import { readPublishedPage } from './page-sections'
import { getServerLocale } from './locale'

export async function pageContentMetadata(pageId: PageDocumentId): Promise<Metadata> {
  const [state, locale] = await Promise.all([readPublishedPage(pageId), getServerLocale()])
  const seo = state.content?.seo
  if (!seo || state.unavailable) return {}
  const copy = seo.text[locale]
  return {
    ...(copy.title ? { title: copy.title } : {}),
    ...(copy.description ? { description: copy.description } : {}),
    ...(copy.title || copy.description || seo.image ? { openGraph: { ...(copy.title ? { title: copy.title } : {}), ...(copy.description ? { description: copy.description } : {}), ...(seo.image ? { images: [{ url: seo.image }] } : {}) }, twitter: { card: 'summary_large_image', ...(copy.title ? { title: copy.title } : {}), ...(copy.description ? { description: copy.description } : {}), ...(seo.image ? { images: [seo.image] } : {}) } } : {}),
  }
}
