import { ENABLED_LOCALES, type EnabledLocale } from './locale-config'
import { seoMetadata, type SeoContent } from './seo-content'

export type SeoDiagnostic = { id: string; route: string; locale?: EnabledLocale; severity: 'issue' | 'recommendation' | 'unverified'; code: string; message: string }
export type DiagnosticPage = { id: string; route: string; published: boolean; seo: SeoContent | null; title?: string; description?: string; image?: string; canonicalPaths?: string[]; baselineVerified?: boolean }
export function diagnoseSeo(pages: DiagnosticPage[], knownPaths: ReadonlySet<string>): SeoDiagnostic[] {
  const checks: SeoDiagnostic[] = []
  const titles = new Map<string, string[]>()
  const add = (page: DiagnosticPage, severity: SeoDiagnostic['severity'], code: string, message: string, locale?: EnabledLocale) => checks.push({ id: page.id + ':' + code + ':' + (locale ?? 'all'), route: page.route, severity, code, message, ...(locale ? { locale } : {}) })
  for (const page of pages) {
    if (!page.published) { add(page, 'recommendation', 'not-public', 'Unpublished source: excluded from public metadata and sitemap.'); continue }
    const seo = page.seo
    for (const locale of ENABLED_LOCALES) {
      const title = seo?.text[locale].title || (locale === 'en' ? page.title : '')
      const description = seo?.text[locale].description || (locale === 'en' ? page.description : '')
      if (!title) add(page, locale === 'en' && page.baselineVerified ? 'issue' : 'unverified', 'missing-title', 'No override or verified source title is available in this language; an unmeasured fallback is not treated as a confirmed defect.', locale)
      if (!description) add(page, locale === 'en' && page.baselineVerified ? 'issue' : 'unverified', 'missing-description', 'No override or verified source description is available in this language; an unmeasured fallback is not treated as a confirmed defect.', locale)
      if (title) { const key = locale + ':' + title.trim().toLowerCase().replace(/\s+/g, ' '); titles.set(key, [...(titles.get(key) ?? []), page.route]) }
    }
    if (!(seo?.image || page.image)) add(page, 'recommendation', 'missing-image', 'No source social image; check whether a configured global image supplies the fallback.')
    if (seo?.canonical && !knownPaths.has(seo.canonical)) add(page, 'issue', 'broken-canonical', 'Saved canonical destination is no longer an available public route.')
    else if (seo?.canonical && seo.canonical !== page.route) add(page, 'recommendation', 'non-self-canonical', 'Canonical points elsewhere; this URL is excluded from the sitemap. Verify this is intentional.')
    if (seo?.index === false) add(page, 'recommendation', 'noindex', 'Published SEO explicitly disables indexing and sitemap inclusion.')
  }
  for (const [key, routes] of titles) {
    const unique = [...new Set(routes)]
    if (unique.length < 2) continue
    for (const route of unique) checks.push({ id: route + ':duplicate-title:' + key.slice(0, 2), route, locale: key.slice(0, 2) as EnabledLocale, severity: 'issue', code: 'duplicate-title', message: 'The same effective title is configured for ' + unique.length + ' public URLs in this language.' })
  }
  checks.push({ id: 'locale-routing', route: '/', severity: 'recommendation', code: 'cookie-locales', message: 'EN/ES/IT use one URL with cookies. Only actual English and x-default alternate URLs are declared; no localized routes are missing from that routing policy.' })
  checks.push({ id: 'browser-performance', route: '/', severity: 'unverified', code: 'core-web-vitals', message: 'Live LCP, CLS and INP require representative browser measurements; no score is estimated.' })
  checks.push({ id: 'google-connection', route: '/', severity: 'unverified', code: 'google-data', message: 'Search Console is not authenticated. Verification-token setup does not provide Google indexing, traffic or ranking data.' })
  return checks
}
export function recordSeoPreview(input: { name: string; route: string; description?: string; image?: string }, seo: SeoContent & { structuredData?: boolean }, locale: EnabledLocale, origin: string) {
  const override = seoMetadata(seo, locale, origin)
  const title = seo.text[locale].title || (locale === 'en' ? input.name + ' | STAR PYRAMIDS' : '')
  const description = seo.text[locale].description || (locale === 'en' ? input.description ?? '' : '')
  const canonical = origin + (seo.canonical || input.route)
  const metadata = { title: { absolute: title }, description, alternates: { canonical, languages: { en: canonical, 'x-default': canonical } }, ...override }
  const structuredData = seo.structuredData === false ? null : { '@context': 'https://schema.org', '@type': 'WebPage', name: title || input.name, url: canonical, ...(description ? { description } : {}), ...(seo.image || input.image ? { image: seo.image || input.image } : {}) }
  return { metadata, structuredData, locale, publicUrl: canonical }
}
