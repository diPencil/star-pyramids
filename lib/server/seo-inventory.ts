import 'server-only'
import { cmsPageRegistry } from '../cms-coverage'
import { SEO_PAGES, currentSeo, isSeoPage } from '../seo-manager'
import { readSeoState } from './seo-manager'
import { listRecordSeo } from './record-seo'
import { CRUISE_HERO_IDS } from '../compact-hero-defaults'
export type SeoInventoryRow = { id: string; name: string; route: string; kind: 'cms' | 'business' | 'private' | 'template'; editor: string | null; title: string; description: string; image: string; index: boolean | null; canonicalIssue: boolean; translationIssue: boolean; updatedAt: string | null }
export async function seoInventory(): Promise<SeoInventoryRow[]> {
  // Resolve the current database first. Never reconstruct deleted business pages
  // from the template registry or the bundled demonstration catalogue.
  const records = await listRecordSeo()
  const activeCruises = new Set(records.filter(entry => entry.record.kind === 'tour' && entry.record.published).map(entry => entry.cruiseType))
  const actualPages = cmsPageRegistry.filter(page => !page.route.includes('[') && (!(CRUISE_HERO_IDS as readonly string[]).includes(page.key) || activeCruises.has(page.key)))
  const pages = await Promise.all(actualPages.map(async (page): Promise<SeoInventoryRow> => {
    const base: SeoInventoryRow = { id: page.key, name: page.name, route: page.route, kind: 'template', editor: page.sections.find(section => section.editor)?.editor ?? null, title: '', description: '', image: '', index: null, canonicalIssue: false, translationIssue: false, updatedAt: null }
    if (isSeoPage(page.key)) {
      const state = await readSeoState(page.key)
      const seo = currentSeo(state, page.key)
      return { ...base, kind: 'cms', editor: '/admin/website-cms/seo/' + page.key, title: seo.text.en.title, description: seo.text.en.description, image: seo.image, index: seo.index !== false, canonicalIssue: !!seo.canonical && seo.canonical !== SEO_PAGES[page.key]!.route, translationIssue: ['es', 'it'].some(locale => !seo.text[locale as 'es' | 'it'].title || !seo.text[locale as 'es' | 'it'].description), updatedAt: state.updatedAt }
    }
    if (/^\/(account|admin|checkout|cart|login|register|forgot-password|reset-password|booking|verify-voucher|search)(\/|$)/.test(page.route)) return { ...base, kind: 'private', index: false, editor: null }
    return base
  }))
  // These repositories apply the same publication policy as the public pages.
  // A failed collection rejects the dashboard: it must not present a false zero.
  return [...pages, ...records.filter(entry => entry.record.published && entry.record.publicUrl).map(({ record, state }): SeoInventoryRow => {
    const seo = state.published
    return { id: record.kind + ':' + record.slug, name: record.name, route: record.publicUrl!, kind: 'business', editor: '/admin/website-cms/seo/dynamic/' + record.kind + '/' + record.slug, title: seo?.text.en.title || record.name + ' | STAR PYRAMIDS', description: seo?.text.en.description || record.description || record.name, image: seo?.image || record.image || '', index: seo?.index !== false, canonicalIssue: !!seo?.canonical && seo.canonical !== record.publicUrl, translationIssue: false, updatedAt: state.updatedAt ?? record.updatedAt ?? null }
  })]
}
