import { PAGE_DOCUMENTS, isPageDocumentId } from './additional-page-content'
import { heroCatalogue } from './hero-catalogue'
import { originalPageContent, type PageContentState } from './page-sections'
import { validateSeoContent, type SeoContent } from './seo-content'
import { HeroValidationError } from './website-heroes'

export type SeoPageId = keyof typeof PAGE_DOCUMENTS | typeof heroCatalogue[number]['id'] | 'planner'
export const SEO_PAGES = Object.fromEntries([
  ...heroCatalogue.filter(page => !page.route.includes('[')).map(page => [page.id, { name: page.name, route: page.route }]),
  ...Object.entries(PAGE_DOCUMENTS).filter(([id, page]) => id !== 'shared' && !page.route.includes('[')),
  ['planner', { name: 'Make Your Trip', route: '/make-your-trip' }],
]) as Partial<Record<SeoPageId, { name: string; route: string }>>
export function isSeoPage(id: string): id is SeoPageId { return Object.hasOwn(SEO_PAGES, id) }
export function originalSeoPage(id: SeoPageId) {
  if (isPageDocumentId(id)) return originalPageContent(id)
  // Catalogue-only templates have no second presentation editor. Their SEO
  // occupies the same page-document format, with no duplicated page sections.
  return { sections: [], seo: originalPageContent('homepage').seo }
}
export type SeoAction = 'save-draft' | 'publish' | 'restore'
export function transitionSeo(state: PageContentState, id: SeoPageId, action: SeoAction, input?: unknown): PageContentState {
  const next = { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString() }
  if (action === 'save-draft') return { ...next, seoDraft: validateSeoContent(input) }
  const source = state.published ?? originalSeoPage(id)
  if (action === 'publish') {
    if (!state.seoDraft) throw new HeroValidationError('Save an SEO draft before publishing.')
    return { ...next, seoManaged: true, published: { ...source, seo: validateSeoContent(state.seoDraft) } }
  }
  if (action === 'restore') return { ...next, seoManaged: false, seoDraft: null, published: state.published ? { ...source, seo: originalSeoPage(id).seo } : null }
  throw new Error('Unsupported SEO action.')
}
export function currentSeo(state: PageContentState, id: SeoPageId): SeoContent {
  return state.published && (state.mode === 'published' || state.seoManaged) ? state.published.seo : originalSeoPage(id).seo
}
